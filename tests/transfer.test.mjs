import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { staticEntry } from "../scripts/static-entry.mjs";

const root = resolve(".");
const app = join(root, "swd-injection-analytics");
const publicRoot = join(root, "public");

test("every transferred original source, fixture, evidence and PDF keeps its exact hash", async () => {
  const manifest = JSON.parse(await readFile("migration/source-manifest.json", "utf8"));
  assert.equal(manifest.files.length, 182);
  for (const entry of manifest.files) {
    const bytes = await readFile(join(app, entry.path));
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.path);
  }
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
    else assert.deepEqual(await readFile(target), await readFile(source), entry);
  }
  assert.deepEqual(
    await readFile(join(app, "output/pdf/swd-technical-exhibit.pdf")),
    await readFile(join(publicRoot, "output/pdf/swd-technical-exhibit.pdf")),
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
