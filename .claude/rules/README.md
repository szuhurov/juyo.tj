# Rules

Behavioural rules for AI agents working in this repository. `CLAUDE.md` is the
high-level entry point; these files hold the detail so `CLAUDE.md` stays short.

Skills and subagents reference these files instead of restating them. When a
rule and a skill disagree, the rule wins.

## Always on

Read these before writing anything, on every task:

| File | Responsibility |
| --- | --- |
| [safety-session.rules.md](safety-session.rules.md) | No rollback, claim checks, preserving other people's work |
| [project.rules.md](project.rules.md) | When tests are required, minimum verification per area |
| [git-workflow.rules.md](git-workflow.rules.md) | Commit format, staging discipline, no commit unless asked |

## Load when relevant

| File | Load when |
| --- | --- |
| [security.rules.md](security.rules.md) | Touching auth, API routes, uploads, env vars, Supabase clients, anything user-visible with personal data |
| [quality.rules.md](quality.rules.md) | Touching UI, translations, accessibility, performance, caching |
| [parallel-work.rules.md](parallel-work.rules.md) | Delegating to subagents, or more than one session is active |

## Evidence discipline

These rules describe **this** repository as it actually is. Several plausible
technologies are *not* used here despite appearances:

- **Zod is installed but unused.** `zod` is in `package.json` and `README.md`
  advertises it, but nothing in `app/`, `lib/`, `components/` or `tests/`
  imports it. Validate manually; do not introduce Zod as if it were an
  established pattern.
- **`react-hook-form` is only wired into `components/ui/form.tsx`.** No feature
  code consumes it. Forms elsewhere are hand-rolled.
- **No Server Actions.** Zero `"use server"` in the codebase. Mutations go
  through Route Handlers under `app/api/` or React Query hooks.
- **No CI.** There is no `.github/`, no `vercel.json`. Verification is local.
- **No locale routing.** i18n is a client context plus a cookie, not `[locale]`
  segments.

Before asserting that a library or pattern is used, confirm it with a search.
Do not carry conventions over from other projects.
