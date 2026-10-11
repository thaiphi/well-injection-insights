import { cp, mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "swd-injection-analytics");
const require = createRequire(import.meta.url);
await mkdir(join(root, "tmp"), { recursive: true });
const snapshot = await mkdtemp(join(root, "tmp", "analytics-check-"));
for (const name of await readdir(source)) {
  if (!["node_modules", "dist", "tmp", ".git"].includes(name))
    await cp(join(source, name), join(snapshot, name), { recursive: true });
}
const results = [];
function run(name, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: snapshot,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  const gate = {
    name,
    args,
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    error: result.error?.message,
    output,
  };
  results.push(gate);
  console.log(JSON.stringify({ ...gate, output: output.trim().split("\n").slice(-10).join("\n") }));
  if (result.status !== 0) process.exitCode = 1;
}
run("analytics-build", [
  require.resolve("typescript/bin/tsc"),
  "-p",
  join(snapshot, "tsconfig.json"),
]);
if (!process.exitCode) {
  const tests = (await readdir(join(snapshot, "tests")))
    .filter(
      (name) =>
        name.endsWith(".test.mjs") &&
        (process.argv.includes("--include-server") || name !== "server.test.mjs"),
    )
    .sort()
    .map((name) => `tests/${name}`);
  run("analytics-tests", ["--test", ...tests]);
  run("carried-oracles", ["scripts/check-carried-oracles.mjs"]);
}
await writeFile(join(snapshot, "gates.json"), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify({ snapshot }));
