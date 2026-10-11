export function staticEntry(searchStr = "", hash = "") {
  return `/analytics/index.html${searchStr}${hash ? `#${hash.replace(/^#/, "")}` : ""}`;
}
