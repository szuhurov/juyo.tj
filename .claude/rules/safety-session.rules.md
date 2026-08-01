# Session safety rules

Always on. These protect work that is already on disk — yours, the user's, and
other concurrent sessions'.

## Never roll back

Do not run any of the following unless the user explicitly asks for that
specific operation in that specific moment:

- `git reset` (any mode), `git checkout -- <path>`, `git restore`
- `git clean`
- `git stash` that would hide uncommitted work
- `git rebase`, `git commit --amend`, `git push --force`, any history rewrite
- deleting or truncating a file you did not create in this session

Uncommitted changes in this repo are frequently real, in-progress work. There
is no CI and no remote backup of the working tree. A rollback is unrecoverable.

If reverting genuinely seems necessary, stop and say so. Let the user decide.

## Before writing anything

1. Run `git status --short`. Know what was already dirty before you started.
2. Check `.claude/claims/` for `status: active` claims (the SessionStart hook
   prints them, but check again if the session has been running a while).
3. If an active claim owned by another session covers a file you need, **stop
   writing to that file** and report the conflict. A claim is not a lock you
   may override.

## Unexpected changes are external

If `git status` shows modifications you did not make, treat them as the user's
or another session's work:

- Never revert them.
- Never stage them.
- Never "clean them up" as a side effect of your task.
- Mention them in your final report so the user knows they were there.

At the time of writing, `CLAUDE.md` carried an uncommitted modification. That is
normal and must be preserved.

## Claims

A claim announces "this session intends to write these files". Create one when
you begin a task that spans multiple files or is likely to run long enough that
another session could start.

Location: `.claude/claims/YYYYMMDD-HHMMSS-<slug>.md` (UTC timestamp).
This directory is git-ignored — claims are local coordination, never committed.

```md
# Claim

status: active
owner: claude-code
created: <ISO-8601 UTC>
updated: <ISO-8601 UTC>
task: <one line>
files:
- path/or/glob/**
notes:
- <anything the next session should know>
```

Rules:

- `status:` is `active` or `done`. Nothing else.
- Update `updated:` whenever you change the claim.
- Flip to `done` as the last step of the task, before your final report.
- Never edit, delete, or flip **someone else's** claim.
- A stale `active` claim is not yours to clean up — report it, ask the user.
- If your scope grows, update your own claim first, then check for new overlaps.

## Scope discipline

Do only the task you were given. Do not opportunistically reformat, upgrade
dependencies, fix unrelated lint warnings, or "tidy" adjacent code. Note them
for the user instead.
