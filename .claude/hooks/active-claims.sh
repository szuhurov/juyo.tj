#!/usr/bin/env bash
# SessionStart hook — surface active claims from other Claude Code sessions.
#
# Claims are how concurrent sessions avoid editing the same files (see
# .claude/rules/safety-session.rules.md). A written rule alone is not enough:
# without this hook an agent simply never looks in .claude/claims/.
#
# Silent + exit 0 when there is nothing to report, so a normal solo session
# sees no noise.
set -euo pipefail

if ! repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || [ -z "$repo_root" ]; then
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
claims_dir="$repo_root/.claude/claims"

[ -d "$claims_dir" ] || exit 0

active=()
for f in "$claims_dir"/*.md; do
  [ -e "$f" ] || continue
  if grep -qiE '^status:[[:space:]]*active[[:space:]]*$' "$f"; then
    active+=("$f")
  fi
done

[ ${#active[@]} -gt 0 ] || exit 0

echo "Active Claude Code claims in this repo — another session may be editing these files."
echo "Read the claim before writing; do not edit files inside someone else's active scope."
echo
for f in "${active[@]}"; do
  echo "--- ${f#"$repo_root/"}"
  # task + files block only; the rest is noise at session start.
  sed -n '/^task:/,/^notes:/p' "$f" | sed '/^notes:/d'
  echo
done
