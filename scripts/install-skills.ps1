# Instaluje zewnętrzne skille do projektu (Windows PowerShell).
# Uruchom w głównym folderze projektu: ./scripts/install-skills.ps1
$ErrorActionPreference = "Stop"

# 1. Skille i komendy projektu: claude-setup -> .claude
New-Item -ItemType Directory -Force ".claude\skills", ".claude\commands" | Out-Null
if (Test-Path "claude-setup") {
  Copy-Item "claude-setup\skills\*" ".claude\skills\" -Recurse -Force
  Copy-Item "claude-setup\commands\*" ".claude\commands\" -Recurse -Force
  Remove-Item "claude-setup" -Recurse -Force
}

# 2. Skille zewnetrzne

npx skills add vercel-labs/agent-skills
npx skills add supabase/agent-skills
npx skills add higgsfield-ai/skills

# three.js (CloudAI-X) nie ma instalatora: kopiujemy folder skills do .claude/skills
$tmp = Join-Path $env:TEMP "threejs-skills"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
git clone --depth 1 https://github.com/CloudAI-X/threejs-skills $tmp
Copy-Item (Join-Path $tmp "skills\*") ".claude\skills\" -Recurse -Force
Remove-Item $tmp -Recurse -Force

Write-Host "Gotowe. W Claude Code dodaj jeszcze: /plugin marketplace add anthropics/skills"
