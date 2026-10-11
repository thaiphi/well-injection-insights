import { checkPortfolioApi } from "./client.mjs";

export function mountPortfolioPanel(document, config, checkApi = checkPortfolioApi) {
  const workspace = document.getElementById("data-workspace");
  if (!workspace || document.getElementById("portfolio-connection")) return;
  const panel = document.createElement("details");
  panel.id = "portfolio-connection";
  panel.className = "panel";
  // Static markup only. Keys, API responses and imported data are never rendered as HTML.
  panel.innerHTML = `<summary>Data storage · Portfolio</summary>
    <p>Imported files, assumptions and results remain in this browser session. Cloud saving is not configured.</p>
    <p class="small">Backend: Portfolio on Supabase. Checking API reachability sends no imported files or analysis results. Calculations work independently of this connection.</p>
    <button type="button" id="portfolio-check">Check API reachability</button>
    <p id="portfolio-status" role="status" aria-live="polite">Connection configured · not checked in this session.</p>
    <p class="small">A successful check confirms service reachability only. It does not confirm sign-in, database permissions or cloud storage.</p>`;
  workspace.append(panel);
  const button = panel.querySelector("button");
  const status = panel.querySelector('[role="status"]');
  let checking = false;
  button.addEventListener("click", async () => {
    if (checking) return;
    checking = true;
    button.disabled = true;
    status.textContent = "Checking Portfolio API…";
    try {
      const result = await checkApi(config);
      status.textContent =
        result.state === "reachable"
          ? `Portfolio Auth API reachable · checked ${new Date(result.checkedAt).toLocaleString()}. Cloud saving is not configured.`
          : (result.message ?? "Portfolio API unavailable. Try again.");
    } catch {
      status.textContent = "Portfolio API unavailable. Try again.";
    } finally {
      checking = false;
      button.disabled = false;
    }
  });
}
