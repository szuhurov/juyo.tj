# Parallel work rules

Load when delegating to subagents, or when more than one session is active on
this repo.

## The main agent orchestrates

The session talking to the user is the orchestrator. It owns the plan, the
integration, the final verification, and the report. Subagents in
`.claude/agents/` are delegable roles — they never own the task.

The orchestrator does not hand off and walk away. It reads what came back,
checks it against the repo, and is accountable for the result.

## When to delegate

Delegate only when it genuinely helps:

- **Independent write areas.** Two workers may run in parallel only if their
  file scopes do not intersect at all. `lib/translations.ts` and
  `tests/e2e/**` — fine. Two workers both touching `lib/services/` — no.
- **Read-only review.** Reviewers can always run in parallel with each other,
  and after a change is written.
- **Broad search** where you need a conclusion, not file dumps.

Do not delegate because a task has several parts. Sequential work in one
session is usually faster and always more coherent.

## Every write-worker gets an explicit scope

A write-worker's prompt must contain a filled-in `Allowed write scope` — actual
paths or globs, decided by the orchestrator:

```
Allowed write scope:
- lib/translations.ts
- tests/lib/translations.test.ts
```

Rules:

- Scopes must not overlap between concurrent workers.
- A worker may not widen its own scope. If it needs a file outside the scope, it
  stops and returns `needs-orchestrator-decision` with the path and the reason.
- A worker may not create a claim covering files outside its scope.
- A worker may not commit, push, or deploy — ever. That is the orchestrator's
  call, and only when the user asked.

## Reviewers are read-only

`code-reviewer`, `security-reviewer`, `api-contract-reviewer` and `qa-verifier`
have no `Edit`/`Write` in their `tools:` frontmatter — the restriction is
enforced, not a promise. They must not:

- edit any file, including tests they think are wrong
- create, edit, or close claims
- run anything that mutates the repo or an external service

`qa-verifier` has `Bash` so it can run checks. It runs **read-only commands**:
lint, typecheck, tests, build. Not installs, not migrations, not deploys, not
git write operations.

## Claims and parallel work

Before a worker writes, it checks `.claude/claims/` — see
[safety-session.rules.md](safety-session.rules.md). The orchestrator holds the
claim for the overall task; workers inherit it rather than creating their own,
unless they are working on a genuinely separate long-lived task.

If a worker hits a file covered by another session's active claim, it stops and
reports the conflict. It does not negotiate, wait, or override.

## Required result format

Every subagent ends with:

```
Status: completed | blocked | needs-orchestrator-decision

Files changed:
- path — what changed (or "none")

Commands run:
- command — passed / failed / skipped (+ reason if skipped)

Risks:
- ... or "none identified"

Notes for the orchestrator:
- ...
```

Reviewers replace "Files changed" with findings:

```
Findings (most severe first):
- [high] path:line — what is wrong, and what goes wrong because of it
```

Severity: `high` (security, data loss, breaks users) · `medium` (real bug,
narrow blast radius) · `low` (maintainability, style with a concrete cost).
No finding without a file reference. No speculation presented as fact.

## Integration is the orchestrator's job

After workers return:

1. `git status --short` and read the actual diff — do not trust the summary.
2. Reconcile conflicts and inconsistencies yourself.
3. Run the verification from [project.rules.md](project.rules.md) on the
   combined result. Per-worker checks do not substitute for this.
4. Report honestly, including anything a worker flagged as blocked or skipped.

Never report a subagent's claimed result as verified fact without checking it.
