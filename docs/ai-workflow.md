# AI workflow

How AI agents are configured to work in this repository, and what you need to
know to change that configuration.

Everything here is plain Markdown under `.claude/` and is committed. There is
**no install step** — Claude Code discovers `.claude/skills/` and
`.claude/agents/` automatically when you open the repo.

## The pieces

| Piece | Where | What it does | Loaded |
| --- | --- | --- | --- |
| Project instructions | `CLAUDE.md` | Stack, commands, architecture, conventions | Every session, automatically |
| Pointer for other tools | `AGENTS.md` | Redirects Codex/Cursor/etc. to `CLAUDE.md` | By tools that look for it |
| Rules | `.claude/rules/*.md` | Behavioural constraints — safety, verification, git, security, quality | On demand; the agent is told to read them |
| Skills | `.claude/skills/<name>/SKILL.md` | Task workflows — "how to do X in this codebase" | Automatically, when the task matches the skill's `description` |
| Subagents | `.claude/agents/<name>.md` | Delegable roles with enforced tool access | When the orchestrator delegates |
| Claims | `.claude/claims/*.md` | Coordination between concurrent sessions | Printed by a SessionStart hook |

Rules are the *constraints*. Skills are the *procedures*. Agents are the *roles*.
When a skill and a rule disagree, the rule wins.

## Rules

`.claude/rules/README.md` maps them. Three are always on:

- **`safety-session.rules.md`** — no rollback (`git reset`, `checkout --`,
  `restore`, `clean`, force-push, amend) without explicit permission; check
  `git status` and claims before writing; treat unexpected diffs as someone
  else's work.
- **`project.rules.md`** — which changes need tests, and the minimum
  verification per area. Includes the fact that `supabase/functions/**` is
  excluded from ESLint *and* `tsconfig.json`, so it needs `deno lint` /
  `deno check`.
- **`git-workflow.rules.md`** — Conventional Commits, explicit-path staging,
  and the standing rule that nothing is committed, pushed, or deployed unless
  you ask.

Loaded when relevant: `security.rules.md`, `quality.rules.md`,
`parallel-work.rules.md`.

`.claude/rules/README.md` also carries an **evidence discipline** section
listing things that look like they are used here but are not — Zod (installed,
zero imports), Server Actions (none), CI (none), locale routing (none). This
exists because agents routinely hallucinate these into plans.

## Skills

Ten, all prefixed `juyo-`:

| Skill | Triggers on |
| --- | --- |
| `juyo-nextjs` | Pages, layouts, components, React Query hooks |
| `juyo-api-contract` | Route Handlers in `app/api/`, request/response shapes |
| `juyo-test-writer` | Vitest unit/integration tests |
| `juyo-git-workflow` | Status, diffs, staging, commit messages, PRs |
| `juyo-clerk-auth` | Auth, route protection, admin gating, the clerk-sync webhook |
| `juyo-supabase-data` | Services, RLS, migrations, `search_items`, Edge Functions |
| `juyo-supabase-storage` | Uploads, storage paths, image cleanup |
| `juyo-i18n` | The tg/ru/en dictionaries in `lib/translations.ts` |
| `juyo-e2e-playwright` | Playwright specs under `tests/e2e/` |
| `juyo-seo-pwa` | Metadata, sitemap, robots, manifest, service worker, push |

Claude picks a skill by matching the task against the `description` in its
frontmatter. You can also request one by name.

**Adding a skill:** create `.claude/skills/<name>/SKILL.md` with frontmatter
containing only `name` and `description` (`name` must equal the directory name,
`lowercase-hyphen-case`). Write the `description` to say both *what it does* and
*when to use it* — that string is the entire routing mechanism. Keep the body
short and project-specific; reference rules rather than restating them.

## Subagents

The session talking to you is always the **orchestrator**. It owns the plan, the
integration, and the final report. Subagents are delegable roles, not owners.

**Read-only reviewers** — `tools:` omits `Edit` and `Write`, so the restriction
is enforced by the harness rather than promised in prose:

- `code-reviewer` — correctness, regressions, maintainability
- `security-reviewer` — auth, secrets, service-role client, uploads, personal data
- `api-contract-reviewer` — response shapes and native-app compatibility
- `qa-verifier` — runs lint/typecheck/tests/build and reports verbatim; has
  `Bash` for checks only, and may not install, migrate, deploy, or write to git

**Write-scoped workers** — `nextjs-worker`, `server-worker`, `test-worker`,
`data-storage-worker`, `e2e-worker`, `i18n-worker`.

Every write-worker template contains an empty `Allowed write scope` block that
the orchestrator must fill in with concrete paths. A worker that finds the block
empty stops. A worker that needs a file outside its scope returns
`needs-orchestrator-decision` rather than widening it.

No worker may commit, push, deploy, apply a migration, or install a dependency.

**Parallel work is allowed only when write scopes do not intersect at all.**
Two workers both touching `lib/services/` is not parallel work, it is a merge
conflict. `lib/translations.ts` is a single 2000-line file — only one worker may
hold it.

## Claims

`.claude/claims/` is git-ignored local coordination for when more than one
session is open on the repo.

A claim is `YYYYMMDDHHMMSS-<slug>.md` with `status: active|done`, the task, and
the file globs it covers. Lifecycle:

1. Before multi-file work, the session writes a claim with `status: active`.
2. Other sessions see it at startup and avoid those files.
3. On completion, the owner flips it to `status: done`.

`.claude/hooks/active-claims.sh` runs as a `SessionStart` hook and prints any
active claims. It is silent when there are none, so solo sessions see nothing.
Without the hook the whole mechanism is dead letter — agents do not spontaneously
check a directory.

**Never edit, close, or delete another session's claim.** A stale `active` claim
is something to report, not to clean up.

## Verification

There is **no CI** in this repo — no `.github/`, no `vercel.json`. Whatever is
not run locally is not run at all.

```bash
npm run lint
npx tsc --noEmit        # no npm script exists for this
npm run test
npm run build
npm run test:e2e        # starts its own dev server
```

`supabase/functions/**` is invisible to both ESLint and `tsc`. Check it with
`deno lint` and `deno check`.

Agents are required to report what they ran, and to name any check they skipped
along with the concrete reason. "Tests: not required — documentation-only
change" is an acceptable line; silence is not.

## Commits and deploys

Standing rule, encoded in `git-workflow.rules.md` and repeated in every worker:
**verify locally, but do not commit, push, or deploy unless explicitly asked.**

Vercel auto-deploy is disabled for this project — pushing to `main` ships
nothing. Deploying is `vercel deploy --prod`, and it is always a separate,
explicit request.

## What was deliberately not created

Decided from what is actually in the repo, not from what a typical Next.js
project has:

| Not created | Why |
| --- | --- |
| `juyo-vercel-deploy` skill | No `vercel.json`, no CI. Deploying is one manual command, already documented in `CLAUDE.md`. |
| `juyo-devops` skill | No `.github/`, no root Dockerfile. `scripts/telegram-import/Dockerfile` is an isolated importer, not a repo-wide ops surface. |
| `juyo-code-reviewer` / `juyo-security-reviewer` skills | Built as **agents** instead. Claude Code already ships `/code-review` and `/security-review`; and only the agent form can enforce read-only via `tools:`. |
| A dedicated edge-functions skill | Covered inside `juyo-supabase-data` plus a rule in `project.rules.md`, to avoid skill sprawl. Revisit if Edge Function work becomes frequent. |
| A skills install script | Unnecessary. Claude Code reads `.claude/skills/` from the repo directly. |
| Zod / Server Action / locale-routing guidance | None of them are used here. Writing rules for them would invent patterns that do not exist. |

## Changing this setup

- Rules and skills are read by an agent at the moment it needs them, so
  precision matters more than completeness. Prefer a short, correct rule over a
  long, hedged one.
- Anything asserting a fact about the codebase should be checkable. If you write
  "search goes through the `search_items` RPC", make sure that is still true.
- After changing skills or agents, start a new session — frontmatter is read at
  startup. `/agents` lists what the harness actually picked up.
- Keep `CLAUDE.md` short. Detail belongs in `.claude/rules/` and
  `.claude/skills/`; `CLAUDE.md` is loaded into every session's context.
