import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// A missing implementation must fail as a missing behavior during the first red run.
let client, panel, assembly;
try {
  client = await import("../integrations/portfolio/client.mjs");
} catch (e) {
  if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
}
try {
  panel = await import("../integrations/portfolio/panel.mjs");
} catch (e) {
  if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
}
try {
  assembly = await import("../scripts/portfolio-entry.mjs");
} catch (e) {
  if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
}
const config = {
  projectName: "Portfolio",
  projectRef: "phxiqnsebqaalvkanljb",
  url: "https://phxiqnsebqaalvkanljb.supabase.co",
  publishableKey: "sb_publishable_test_only",
};
const health = {
  name: "GoTrue",
  version: "v2.197.0",
  description: "GoTrue is a user registration and authentication API",
};
function checker() {
  assert.equal(typeof client?.checkPortfolioApi, "function", "API connection behavior must exist");
  return client.checkPortfolioApi;
}

test("connection probes only Portfolio Auth health without uploading data or cookies", async () => {
  const result = await checker()(config, {
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://phxiqnsebqaalvkanljb.supabase.co/auth/v1/health");
      assert.equal(init.method, "GET");
      assert.equal(init.credentials, "omit");
      assert.deepEqual(init.headers, {
        apikey: "sb_publishable_test_only",
        Accept: "application/json",
      });
      assert.equal(init.body, undefined);
      assert.equal(init.redirect, "error");
      return Response.json(health);
    },
  });
  assert.equal(result.state, "reachable");
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
  assert.equal(result.databaseVerified, false);
  assert.equal(result.savingEnabled, false);
});

test("wrong project, unsafe URL and privileged keys fail before making a request", async () => {
  for (const changed of [
    { url: "https://evil.example" },
    { url: "http://phxiqnsebqaalvkanljb.supabase.co" },
    { projectRef: "wrong" },
    { publishableKey: "sb_secret_no" },
    { publishableKey: "eyJhbGciOiJIUzI1NiJ9.legacy" },
    { publishableKey: "" },
  ]) {
    let calls = 0;
    const result = await checker()(
      { ...config, ...changed },
      {
        fetchImpl: async () => {
          calls++;
          return Response.json(health);
        },
      },
    );
    assert.equal(result.state, "misconfigured");
    assert.equal(calls, 0);
  }
});

test("HTTP errors and misleading success bodies never report reachability", async () => {
  for (const response of [
    new Response("denied", { status: 401 }),
    new Response("error", { status: 503 }),
    Response.json({ ok: true }),
    new Response("<html>proxy</html>", { headers: { "content-type": "text/html" } }),
  ]) {
    const result = await checker()(config, { fetchImpl: async () => response });
    assert.equal(result.state, "unavailable");
    assert.equal(result.databaseVerified, false);
  }
});

test("network failure is contained and timeout aborts the pending request", async () => {
  const offline = await checker()(config, {
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(offline.state, "unavailable");
  const keepAlive = setTimeout(() => {}, 100);
  try {
    const timed = await checker()(config, {
      timeoutMs: 5,
      fetchImpl: async (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
        ),
    });
    assert.equal(timed.state, "timeout");
  } finally {
    clearTimeout(keepAlive);
  }
});

test("panel is opt-in, prevents duplicate checks and retains session-only disclosure", async () => {
  assert.equal(typeof panel?.mountPortfolioPanel, "function");
  const dom = new JSDOM('<section id="data-workspace"><p>Existing source controls</p></section>');
  let calls = 0,
    finish;
  panel.mountPortfolioPanel(dom.window.document, config, () => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  panel.mountPortfolioPanel(dom.window.document, config, () => {
    throw Error("duplicate mount");
  });
  const button = dom.window.document.querySelector("#portfolio-check");
  assert.equal(calls, 0);
  assert.match(dom.window.document.body.textContent, /browser session/);
  button.click();
  button.click();
  assert.equal(calls, 1);
  assert.equal(button.disabled, true);
  finish({
    state: "reachable",
    checkedAt: "2026-10-11T12:00:00Z",
    databaseVerified: false,
    savingEnabled: false,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(button.disabled, false);
  assert.match(dom.window.document.querySelector('[role="status"]').textContent, /API reachable/);
  assert.match(dom.window.document.body.textContent, /saving is not configured/);
  assert.equal(dom.window.document.querySelectorAll("#portfolio-connection").length, 1);
  dom.window.close();
});

test("panel failure permits retry and does not remove accepted source content", async () => {
  assert.equal(typeof panel?.mountPortfolioPanel, "function");
  const dom = new JSDOM(
    '<section id="data-workspace"><p id="accepted">Accepted history</p></section>',
  );
  panel.mountPortfolioPanel(dom.window.document, config, async () => {
    throw Error("unexpected");
  });
  const button = dom.window.document.querySelector("#portfolio-check");
  button.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(button.disabled, false);
  assert.match(dom.window.document.querySelector('[role="status"]').textContent, /unavailable/i);
  assert.equal(dom.window.document.querySelector("#accepted").textContent, "Accepted history");
  dom.window.close();
});

test("hosting injects exactly one module and fails closed if the entry contract changes", () => {
  assert.equal(typeof assembly?.withPortfolioEntry, "function");
  assert.equal(
    assembly.withPortfolioEntry("<html><body>original</body></html>"),
    '<html><body>original<script type="module" src="/backend/entry.mjs"></script>\n</body></html>',
  );
  assert.throws(() => assembly.withPortfolioEntry("no body"));
  assert.throws(() => assembly.withPortfolioEntry("</body></body>"));
  assert.throws(() =>
    assembly.withPortfolioEntry(
      '<script type="module" src="/backend/entry.mjs"></script>\n</body>',
    ),
  );
});
