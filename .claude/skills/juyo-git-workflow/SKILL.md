---
name: juyo-git-workflow
description: Inspect status and diffs, plan staging, write Conventional Commit messages, and draft PR summaries for JUYO. Use when the user explicitly asks to commit, stage, branch, or open a pull request — or when you need to review what is currently changed in the working tree.
---

# JUYO git workflow

Follow [git-workflow.rules.md](../../rules/git-workflow.rules.md). That file is
authoritative; this is the procedure.

## The standing rule

**Do not commit, push, or deploy unless the user asked in that message.** Read
the working tree freely; write to git only on request.

Vercel auto-deploy is disabled for this project. Pushing to `main` ships
nothing. `vercel deploy --prod` is a separate, explicit request.

## Reviewing the working tree

```bash
git status --short
git diff              # unstaged
git diff --cached     # staged
git log --oneline -10
```

Expect pre-existing dirt. Files that were modified before your session started
are not yours to stage, revert, or clean.

## Staging

Stage explicit paths. Never `git add -A`, never `git add .`:

```bash
git add app/api/items/[id]/route.ts lib/services/item-service.ts
git diff --cached     # read it before committing
```

Check the staged set contains nothing from `.gitignore` — `.env*`,
`.claude/settings.local.json`, `.claude/claims/`, `.vercel/`, `*.log`,
`*.tsbuildinfo`.

## Commit message

```
type(scope): summary

Optional body explaining why, when the reason is not obvious from the diff.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Types: `feat` `fix` `refactor` `perf` `style` `test` `docs` `chore` `build` `revert`

Scopes: `app` `api` `admin` `items` `qr` `profile` `notifications` `auth`
`i18n` `search` `supabase` `edge` `push` `scripts` `tests` `docs` `ai` `deps`
`config`

Imperative, lowercase, no trailing period, ~72 chars.

The existing history does **not** follow this — it is full of placeholder
subjects (`asdf`, `sdfg`). Follow the format anyway; do not rewrite history to
match.

Multi-line messages need a heredoc, not `-m` with embedded newlines:

```bash
git commit -F - <<'EOF'
fix(api): re-check item ownership before hard delete

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

## One changeset per commit

One logical change per commit. If the work spans an API route, a migration, and
translations for a single feature — one commit. Unrelated fixes get their own,
or should not have been in scope.

## Branching

`main` is the default. If asked to commit while on `main`, create a branch first
unless the user explicitly wants it on `main`.

```bash
git checkout -b fix/item-ownership-check
```

## Pull requests

Only when asked. `gh pr create`, with the body ending:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Summarize what changed and why, and list what was verified. Do not claim checks
you did not run.

## Never without an explicit, separate request

`git commit --amend`, `git rebase`, `git push --force`, `git reset`,
`git checkout -- <path>`, `git restore`, `git clean`, `--no-verify`.

If a hook fails, fix the cause.
