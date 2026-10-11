import { createFileRoute, redirect } from "@tanstack/react-router";
import { staticEntry } from "../../scripts/static-entry.mjs";

// Full-document navigation preserves the original application's URL contracts.
export const Route = createFileRoute("/")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: staticEntry(location.searchStr, location.hash),
      reloadDocument: true,
    });
  },
});
