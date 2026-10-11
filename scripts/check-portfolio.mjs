import { readFileSync } from "node:fs";
import { checkPortfolioApi } from "../integrations/portfolio/client.mjs";

const config = JSON.parse(
  readFileSync(new URL("../integrations/portfolio/config.json", import.meta.url), "utf8"),
);
const result = await checkPortfolioApi(config);
console.log(JSON.stringify({ project: "Portfolio", ...result }, null, 2));
if (result.state !== "reachable") process.exitCode = 1;
