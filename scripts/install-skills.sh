#!/usr/bin/env bash
# Instaluje zewnętrzne skille do projektu (macOS / Linux / Git Bash).
set -euo pipefail

# 1. Skille i komendy projektu: claude-setup -> .claude
mkdir -p .claude/skills .claude/commands
if [ -d claude-setup ]; then
  cp -R claude-setup/skills/. .claude/skills/
  cp -R claude-setup/commands/. .claude/commands/
  rm -rf claude-setup
fi

# 2. Skille zewnetrzne

npx skills add vercel-labs/agent-skills
npx skills add supabase/agent-skills
npx skills add higgsfield-ai/skills

tmp="$(mktemp -d)"
git clone --depth 1 https://github.com/CloudAI-X/threejs-skills "$tmp/threejs-skills"
cp -R "$tmp/threejs-skills/skills/." .claude/skills/
rm -rf "$tmp"

echo "Gotowe. W Claude Code dodaj jeszcze: /plugin marketplace add anthropics/skills"
