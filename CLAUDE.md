# Project conventions

Original browser-based driving-learning product for learners in North Macedonia.

## Stack
- Vite + TypeScript (strict), vanilla DOM UI, three.js for 3D scenes. No UI framework.
- Commands: `npm run dev`, `npm run typecheck`, `npm run build`.

## Structure
- `src/i18n/locales/{mk,sq,en}.json` — all user-facing copy. Every locale has the same keys.
- `src/lessons/registry.ts` — list of lessons; each lesson lives in `src/lessons/<id>/`.
- `src/game/` — shared driving pieces (input, touch controls, renderer setup, car model).
- `src/ui/` — screens (home, briefing, result, fallback) and DOM helpers.

## Constraints
- Use only supplied copy and translations. Never invent, translate, or reword user-facing text, legal rules, or lesson content; keep supplied wording exact, including typos.
- Lessons are learning simulations, never described as official exams or assessments, and never a replacement for an instructor. No invented points, thresholds, or pass/fail standards — practice checklists only.
- No external services, APIs, CDNs, analytics, remote fonts, or paid assets. Everything ships locally.
- Keep dependencies minimal; no physics engine. Original simple geometry, fictional locations only.
- Do not browse the internet or ask other models for rules, copy, or translations.
- Do not add tests unless asked; verify with `npm run typecheck` / `npm run build`.
- Scope is incremental: don't add accounts, payments, dashboards, analytics, or leaderboards unless asked.
