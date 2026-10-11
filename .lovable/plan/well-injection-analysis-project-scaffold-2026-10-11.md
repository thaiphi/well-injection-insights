# Well Injection Analysis — Project Scaffold

## Goal
Set up a clean, minimal starter project named "Well Injection Analysis" that you can sync to GitHub and hand off to Codex for further development.

## What will be built

1. **Home page (`src/routes/index.tsx`)** — replace the blank-page placeholder with a simple, professional landing screen for "Well Injection Analysis":
   - App title and short description
   - Placeholder sections for future modules (e.g. Data Upload, Analysis, Visualization) as simple cards
   - Minimal styling via Tailwind + existing design tokens

2. **Metadata (`src/routes/__root.tsx`)** — update head tags from "Lovable App" to "Well Injection Analysis" (title, description, og:title, og:description).

3. **Project naming** — update `package.json` name field to `well-injection-analysis`.

## What is intentionally NOT included
- No backend, database, or auth (Lovable Cloud not enabled; not needed for a scaffold)
- No analysis logic, charts, or GIS — left for Codex to implement
- No extra dependencies

## Technical details
- TanStack Start v1 + React 19 + Tailwind CSS v4 (existing stack, unchanged)
- Semantic design tokens only; no hardcoded colors
- After approval, you can connect GitHub via the Plus (+) menu → GitHub → Connect project, and the two-way sync will push this scaffold to your repo.
