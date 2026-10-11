import { mountPortfolioPanel } from "./panel.mjs";

try {
  const response = await fetch("/backend/config.json", {
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error("Connection configuration unavailable");
  mountPortfolioPanel(document, await response.json());
} catch {
  mountPortfolioPanel(document, null);
  const status = document.getElementById("portfolio-status");
  if (status)
    status.textContent =
      "Portfolio connection configuration unavailable. Local calculations remain usable.";
}
