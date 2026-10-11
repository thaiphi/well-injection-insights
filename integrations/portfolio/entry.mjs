import { mountPortfolioPanel } from "./panel.mjs";
import { loadPortfolioConfig } from "./client.mjs";

try {
  mountPortfolioPanel(document, await loadPortfolioConfig());
} catch {
  mountPortfolioPanel(document, null);
  const status = document.getElementById("portfolio-status");
  if (status)
    status.textContent =
      "Portfolio connection configuration unavailable. Local calculations remain usable.";
}
