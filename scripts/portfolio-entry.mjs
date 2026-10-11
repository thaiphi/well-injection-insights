export const PORTFOLIO_ENTRY = '<script type="module" src="/backend/entry.mjs"></script>\n';

export function withPortfolioEntry(html) {
  if (html.split("</body>").length !== 2 || html.includes(PORTFOLIO_ENTRY))
    throw Error("Analytics HTML entry contract changed; refusing an ambiguous backend injection");
  return html.replace("</body>", `${PORTFOLIO_ENTRY}</body>`);
}
