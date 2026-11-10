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

For a new computer/session, read [HANDOVER.md](HANDOVER.md). An unchanged accessible copy of the historical shared delegation workflow is at [handover/context/agent-workflow.md](handover/context/agent-workflow.md); use it when the nested instructions' original sibling path is unavailable. Copied governing documents retain historical wording; current owner authorization and dated verified outcomes still govern.

The application is in `swd-injection-analytics/`. The outer TanStack project is a hosting adapter, not a replacement engineering implementation. Read the nested instructions for engineering changes; their sibling workflow links describe the original local workspace and are historical when unavailable here. Do not regenerate calculations, discard reference fixtures, or replace imports/exports with illustrative output.

`migration/source-manifest.json` records the exact transferred working files. The initial transfer must pass byte/hash preservation. Later intentional engineering changes require a reviewed new baseline rather than silently weakening this gate. Keep original references, source licenses, tests, assumptions, units and evidence classifications intact.

Use direct Node paths for checks. `scripts/prepare-swd.mjs` compiles the nested app using TypeScript 5.9.3 and assembles its existing static routes. Do not edit generated `public/` assets. Preserve full-document navigation: an iframe changes the handoff and browsing context. Do not provision a backend or publish the app merely to make the transfer preview work.

The owner's backend is the existing **Portfolio Supabase** project (`phxiqnsebqaalvkanljb`), not Lovable Cloud. Its connection boundary is in `integrations/portfolio/`. Keep data/session state and numerical code independent of API availability. Do not infer cloud saving from service reachability, provision another backend, change permissions, add data uploads or migrate schemas without an explicitly scoped request. Only publishable keys may appear in browser configuration.

## Agent team

The main session is the orchestrator. It talks to the owner, scopes each issue, writes the design and plan, dispatches subagents, integrates their work and owns all Git. It runs at most two subagents at a time, with non-overlapping write paths, each briefed with the seven fields in [handover/context/agent-workflow.md](handover/context/agent-workflow.md). That document's Codex model names are historical; in Claude Code the roles are defined in `.claude/agents/`:

| Role | File | Does |
|---|---|---|
| Product manager | the orchestrator itself | Turns an issue into a design under `docs/superpowers/specs/` and gets the owner's approval before any code |
| Software engineer | [.claude/agents/engineer.md](.claude/agents/engineer.md) | Implements one issue, test first, inside a file allowlist |
| QA | [.claude/agents/qa.md](.claude/agents/qa.md) | Runs the full gate and a browser check against the issue's acceptance criteria |
| Reviewer | [.claude/agents/reviewer.md](.claude/agents/reviewer.md) | Independent read-only review (owner decision D13) |

Reusable procedures are skills in `.claude/skills/`: [preservation-layer](.claude/skills/preservation-layer/SKILL.md) records a reviewed layer for protected files, and [browser-check](.claude/skills/browser-check/SKILL.md) drives the app in headless Chrome for evidence. Agents that do not read `.claude/` follow the same files as plain instructions.

Flow for each issue: design approved by the owner → plan → engineer → reviewer → QA → preservation layer recorded → owner accepts the layer → owner instructs push and merge. Subagents never stage, commit or push.

## Issue tracking

Work from a GitHub issue in thaiphi/well-injection-insights. Requirements are tracked as `ANA-Exx` issues (#1–#10, milestones by phase). Reference the issue number in delegation briefs and PRs, and use `Closes #n` in the PR body. Before an issue is closed, record its evidence on the issue: acceptance-test output, preservation-gate result and the owner's acceptance. Opening PRs, posting evidence and closing issues still need the owner's go-ahead, like merge and push.
