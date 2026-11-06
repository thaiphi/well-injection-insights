// One command for the full offline test gate (README "Testing").
// Runs every check in order, continues after a failure so all results are
// reported, and exits non-zero if any check failed. CI runs this same script.
// No check makes network calls; the live Portfolio probe
// (scripts/check-portfolio.mjs) is deliberately excluded.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ci = process.env.GITHUB_ACTIONS === "true";

const checks = [
  ["Preservation gate (182 protected files)", ["scripts/verify-preservation.mjs", "."]],
  ["Assemble analytics app", ["scripts/prepare-swd.mjs"]],
  ["Root transfer, preservation and connection tests", ["--test", "tests/*.test.mjs"]],
  ["Hosting adapter unit tests (vitest)", ["node_modules/vitest/vitest.mjs", "run"]],
  ["Type-check hosting adapter", ["node_modules/typescript/bin/tsc", "--noEmit"]],
  ["Type-check analytics app", ["node_modules/typescript/bin/tsc", "-p", "swd-injection-analytics/tsconfig.json", "--noEmit"]],
  ["Build site", ["node_modules/vite/bin/vite.js", "build"]],
  ["Analytics engineering suite and carried oracles (isolated copy)", ["scripts/check-analytics.mjs", "--include-server"]],
];

const results = [];
for (const [name, args] of checks) {
  console.log(ci ? `::group::${name}` : `\n=== ${name}`);
  const started = Date.now();
  const { status, error } = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (ci) console.log("::endgroup::");
  const ok = status === 0;
  if (error) console.error(error.message);
  results.push({ name, ok, seconds: ((Date.now() - started) / 1000).toFixed(1) });
  if (!ok && ci) console.log(`::error::${name} failed (exit ${status})`);
}

console.log("\nSummary");
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.seconds}s)`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
process.exitCode = failed ? 1 : 0;
