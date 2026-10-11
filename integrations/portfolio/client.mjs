const PROJECT_REF = "phxiqnsebqaalvkanljb";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;

export function portfolioConfigError(config) {
  if (config?.projectRef !== PROJECT_REF || config?.url !== PROJECT_URL)
    return "The connection must point to the existing Portfolio project.";
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config?.publishableKey ?? ""))
    return "An active browser-safe publishable key is required.";
  return null;
}

/** Local asset only: private preview hosts require their existing same-origin session. */
export async function loadPortfolioConfig({ fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl("/backend/config.json", {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error("Connection configuration unavailable");
  const config = await response.json();
  const invalid = portfolioConfigError(config);
  if (invalid) throw Error(invalid);
  return config;
}

/** Read-only service probe. This does not verify sign-in, database access or saving. */
export async function checkPortfolioApi(
  config,
  { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {},
) {
  const result = (state, message) => ({
    state,
    message,
    checkedAt: new Date().toISOString(),
    databaseVerified: false,
    savingEnabled: false,
  });
  const invalid = portfolioConfigError(config);
  if (invalid) return result("misconfigured", invalid);
  try {
    const response = await fetchImpl(`${PROJECT_URL}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: config.publishableKey, Accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok)
      return result("unavailable", `Portfolio API check returned HTTP ${response.status}.`);
    const body = await response.json();
    if (body?.name !== "GoTrue" || typeof body?.version !== "string" || !body.version)
      return result("unavailable", "Portfolio returned an unexpected health response.");
    return result("reachable", "Portfolio Auth API reachable.");
  } catch (error) {
    return error?.name === "TimeoutError"
      ? result("timeout", "Portfolio API check timed out. Try again when online.")
      : result("unavailable", "Portfolio API unavailable. Check your connection and try again.");
  }
}
