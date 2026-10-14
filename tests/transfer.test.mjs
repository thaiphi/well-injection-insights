import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { verifyPreservation } from "../scripts/verify-preservation.mjs";
import { resolve, join } from "node:path";
import { staticEntry } from "../scripts/static-entry.mjs";
import { PORTFOLIO_ENTRY } from "../scripts/portfolio-entry.mjs";

const root = resolve(".");
const app = join(root, "swd-injection-analytics");
const publicRoot = join(root, "public");

test("every original source, fixture, evidence and PDF passes immutable or reviewed-delta preservation", async () => {
  const result = await verifyPreservation(root);
  assert.equal(result.checked, 182, "all transferred originals remain accounted for");
  assert.deepEqual(result.violations, [], "pending, altered or unreviewed bytes cannot pass acceptance");
});

test("static assembly preserves original web assets, compiled model and public evidence bytes", async () => {
  async function compare(source, target) {
    for (const entry of await readdir(source, { withFileTypes: true })) {
      if (entry.isDirectory()) await compare(join(source, entry.name), join(target, entry.name));
      else
        assert.deepEqual(
          await readFile(join(target, entry.name)),
          await readFile(join(source, entry.name)),
          join(target, entry.name),
        );
    }
  }
  for (const directory of ["dist", "data", "reference", "exhibits"])
    await compare(join(app, directory), join(publicRoot, directory));
  for (const entry of await readdir(join(app, "web"))) {
    const source = join(app, "web", entry);
    const target =
      entry === "index.html" ? join(publicRoot, "analytics", entry) : join(publicRoot, entry);
    if ((await stat(source)).isDirectory()) await compare(source, target);
    else if (entry === "index.html") {
      const generated = await readFile(target, "utf8");
      assert.equal(generated.split(PORTFOLIO_ENTRY).length, 2);
      assert.equal(generated.replace(PORTFOLIO_ENTRY, ""), await readFile(source, "utf8"));
    } else assert.deepEqual(await readFile(target), await readFile(source), entry);
  }
  assert.deepEqual(
    await readFile(join(app, "output/pdf/swd-technical-exhibit.pdf")),
    await readFile(join(publicRoot, "output/pdf/swd-technical-exhibit.pdf")),
  );
  for (const name of ["config.json", "client.mjs", "panel.mjs", "entry.mjs"])
    assert.deepEqual(
      await readFile(join(publicRoot, "backend", name)),
      await readFile(join(root, "integrations/portfolio", name)),
    );
  for (const privatePath of [
    "src",
    "tests",
    "scripts",
    "docs",
    "tmp",
    "AGENTS.md",
    "package.json",
  ]) {
    await assert.rejects(stat(join(publicRoot, privatePath)), { code: "ENOENT" });
  }
});

test("home entry retains handoff query and workspace fragment on a full-document redirect", () => {
  assert.equal(staticEntry(), "/analytics/index.html");
  assert.equal(
    staticEntry("?rrcHandoff=abc", "data/data"),
    "/analytics/index.html?rrcHandoff=abc#data/data",
  );
  assert.equal(staticEntry("?x=%2B", "#fluid/pvt"), "/analytics/index.html?x=%2B#fluid/pvt");
});

