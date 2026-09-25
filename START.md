# Start w Claude Code

## 1. Czego potrzebujesz (Windows)

- Node.js 20+ i Git
- Docker Desktop (lokalna baza Supabase)
- Claude Code: `npm install -g @anthropic-ai/claude-code`
- Konta: GitHub, Supabase, Vercel. Higgsfield dopiero w etapie M4.

## 2. Otwórz projekt

W PowerShell, w tym folderze:

```powershell
git init
git add .
git commit -m "Project starter: brief, roadmap, skills"
claude
```

## 3. Zainstaluj skille (raz)

Skrypt przenosi skille i komendę `/etap` z folderu `claude-setup` do `.claude`, potem instaluje skille zewnętrzne.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-skills.ps1
```

Potem w Claude Code wpisz:

```
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills
```

## 4. Pierwszy prompt (wklej do Claude Code)

```
Przeczytaj CLAUDE.md, docs/PRD.md, docs/ROADMAP.md i skille w .claude/skills.
Potem zrób etap M0 z roadmapy. Zanim zaczniesz pisać kod, pokaż mi krótki plan
(lista plików i komend) i poczekaj na moje OK. Pracujemy na Windows, PowerShell.
```

## 5. Kolejne etapy

W Claude Code wpisz `/etap M1` (potem `/etap M2` itd.). Komenda każe przeczytać roadmapę, zaplanować etap, poczekać na zgodę, zbudować, przetestować i podsumować.

## Wskazówki

- Jeden etap na raz. Po każdym: `git commit`.
- Nie wklejaj kluczy do czatu. Wpisuj je do `.env.local` (plik jest w `.gitignore`).
- Generowanie przez Higgsfield kosztuje kredyty. Do M4 aplikacja używa tylko MockProvider.
