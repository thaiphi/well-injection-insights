import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withPortfolioEntry } from "./portfolio-entry.mjs";
import { portfolioConfigError } from "../integrations/portfolio/client.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "swd-injection-analytics");
const publicRoot = join(root, "public");
const require = createRequire(import.meta.url);

function resetGenerated(path, boundary) {
  if (!path.startsWith(boundary + sep) || path === boundary) throw Error("Unsafe generated path");
  if (existsSync(path) && lstatSync(path).isSymbolicLink())
    throw Error("Generated path cannot be a symlink");
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

/** Keep the original application intact; assemble its existing static URL contract. */
export function prepareSwd() {
  const backend = join(root, "integrations", "portfolio");
  const config = JSON.parse(readFileSync(join(backend, "config.json"), "utf8"));
  const configError = portfolioConfigError(config);
  if (configError) throw Error(configError);
  const compiler = require.resolve("typescript/bin/tsc");
  const version = JSON.parse(
    readFileSync(require.resolve("typescript/package.json"), "utf8"),
  ).version;
  if (version !== "5.9.3")
    throw Error(`Analytics requires its preserved TypeScript 5.9.3 pin; found ${version}`);
  resetGenerated(join(app, "dist"), app);
  const compilation = spawnSync(process.execPath, [compiler, "-p", join(app, "tsconfig.json")], {
    cwd: app,
    stdio: "inherit",
  });
  if (compilation.error) throw compilation.error;
  if (compilation.status !== 0) throw Error(`Analytics compilation failed (${compilation.status})`);
  mkdirSync(publicRoot, { recursive: true });
  for (const directory of ["dist", "data", "reference", "exhibits"]) {
    resetGenerated(join(publicRoot, directory), publicRoot);
    cpSync(join(app, directory), join(publicRoot, directory), { recursive: true });
  }
  resetGenerated(join(publicRoot, "analytics"), publicRoot);
  for (const entry of readdirSync(join(app, "web"), { withFileTypes: true })) {
    const target =
      entry.name === "index.html"
        ? join(publicRoot, "analytics", "index.html")
        : join(publicRoot, entry.name);
    if (entry.isSymbolicLink()) throw Error("Web assets cannot be symlinks");
    cpSync(join(app, "web", entry.name), target, { recursive: true });
  }
  const htmlEntry = join(publicRoot, "analytics", "index.html");
  writeFileSync(htmlEntry, withPortfolioEntry(readFileSync(htmlEntry, "utf8")));
  resetGenerated(join(publicRoot, "backend"), publicRoot);
  for (const name of ["config.json", "client.mjs", "panel.mjs", "entry.mjs"])
    cpSync(join(backend, name), join(publicRoot, "backend", name));
  const originalPdf = join(app, "output", "pdf", "swd-technical-exhibit.pdf");
  if (existsSync(originalPdf)) {
    resetGenerated(join(publicRoot, "output"), publicRoot);
    mkdirSync(join(publicRoot, "output", "pdf"), { recursive: true });
    cpSync(originalPdf, join(publicRoot, "output", "pdf", "swd-technical-exhibit.pdf"));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareSwd();
