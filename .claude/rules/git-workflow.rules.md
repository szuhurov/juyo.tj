# Git workflow rules

Always on.

## Never commit unprompted

Standing user preference: **verify locally, but do not commit, push, or deploy
unless explicitly told to.**

- No `git add`, `git commit` — unless the user asks in that message.
- No `git push` — same.
- No `vercel deploy --prod`. Vercel auto-deploy is **disabled** for this
  project; a push to `main` changes nothing in production. Deploying is a
  separate, explicit request.
- "Looks good" or "thanks" is not a request to commit.

Finish the work, report it, and leave the working tree for the user.

## Commit message format

When the user *does* ask for a commit: English Conventional Commits.

```
type(scope): summary
```

**This is a new convention for this repo.** The existing history is
inconsistent — it mixes descriptive English subjects with placeholder junk
(`asdf`, `sdfg`, `n`). Do not imitate the history; follow the format below and
do not retroactively rewrite old commits.

Types: `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `chore`,
`build`, `revert`.

Scopes, taken from the actual directory layout:

`app`, `api`, `admin`, `items`, `qr`, `profile`, `notifications`, `auth`,
`i18n`, `search`, `supabase`, `edge`, `push`, `scripts`, `tests`, `docs`, `ai`,
`deps`, `config`

Summary: imperative, lowercase, no trailing period, under ~72 chars.

```
fix(api): re-check item ownership before hard delete
feat(i18n): add ru/en strings for the report dialog
refactor(services): extract shared supabase chain builder
docs(ai): document the claims workflow
```

Body when the *why* is non-obvious — what broke, what constraint forced the
approach. Do not restate the diff.

Every commit ends with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## One changeset per commit

A commit is one logical change. If the work touched an API route, a migration
and three translation keys for one feature, that is one commit. If it also
fixed an unrelated lint warning, that is a second commit — or better, was out
of scope to begin with.

## Staging discipline

Before staging, always:

```bash
git status --short
git diff
```

Then stage **explicit paths**, never `git add -A` or `git add .`:

```bash
git add app/api/items/[id]/route.ts lib/services/item-service.ts
```

Rules:

- Never stage files you did not change in this session.
- Never stage pre-existing dirty files that were dirty before you started
  (`CLAUDE.md` is frequently one of these).
- Never stage `.env*`, `.claude/settings.local.json`, `.claude/claims/`,
  `*.log`, `.vercel/`, or anything in `.gitignore`.
- If a needed change is entangled with unrelated dirty work, say so and let the
  user untangle it.

## Branches

`main` is the default branch. If asked to commit while on `main`, create a
branch first unless the user explicitly wants the commit on `main`.

## Forbidden without a separate, explicit request

`git commit --amend`, `git rebase`, `git push --force`, `git reset`,
`git checkout -- <path>`, `git restore`, `git clean`, tag deletion, branch
deletion, or anything else that discards or rewrites existing work. See
[safety-session.rules.md](safety-session.rules.md).

Never bypass hooks (`--no-verify`) or signing. If a hook fails, fix the cause.

## Pull requests

Only when asked. Use `gh`. Body ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
