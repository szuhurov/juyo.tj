# AGENTS.md

Agent instructions for this repository live in **[CLAUDE.md](CLAUDE.md)**. Read
it first — it covers the project, the stack, the commands, and the architecture.

Supporting material, all under `.claude/`:

| Path | What it is |
| --- | --- |
| `.claude/rules/` | Behavioural rules — safety, verification, git, security, quality, parallel work. Start with `.claude/rules/README.md`. |
| `.claude/skills/` | Task-specific workflows (`juyo-nextjs`, `juyo-api-contract`, `juyo-supabase-data`, …). |
| `.claude/agents/` | Delegable roles: read-only reviewers and write-scoped workers. |
| `.claude/claims/` | Local, git-ignored coordination between concurrent sessions. |
| `docs/ai-workflow.md` | How the pieces fit together. |

These files are written for Claude Code but are plain Markdown — any agent can
read them. The rules and the evidence notes in `.claude/rules/README.md` apply
regardless of which tool you are.

**Do not commit, push, or deploy unless explicitly asked.**
