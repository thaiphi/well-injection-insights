<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Preserved engineering application

The application is in `swd-injection-analytics/`. The outer TanStack project is a hosting adapter, not a replacement engineering implementation. Read the nested instructions for engineering changes; their sibling workflow links describe the original local workspace and are historical when unavailable here. Do not regenerate calculations, discard reference fixtures, or replace imports/exports with illustrative output.

`migration/source-manifest.json` records the exact transferred working files. The initial transfer must pass byte/hash preservation. Later intentional engineering changes require a reviewed new baseline rather than silently weakening this gate. Keep original references, source licenses, tests, assumptions, units and evidence classifications intact.

Use direct Node paths for checks. `scripts/prepare-swd.mjs` compiles the nested app using TypeScript 5.9.3 and assembles its existing static routes. Do not edit generated `public/` assets. Preserve full-document navigation: an iframe changes the handoff and browsing context. Do not provision a backend or publish the app merely to make the transfer preview work.

The owner's backend is the existing **Portfolio Supabase** project (`phxiqnsebqaalvkanljb`), not Lovable Cloud. Its connection boundary is in `integrations/portfolio/`. Keep data/session state and numerical code independent of API availability. Do not infer cloud saving from service reachability, provision another backend, change permissions, add data uploads or migrate schemas without an explicitly scoped request. Only publishable keys may appear in browser configuration.
