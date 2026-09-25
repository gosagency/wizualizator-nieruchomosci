# Wizualizator nieruchomości

Aplikacja B2B dla biur nieruchomości i deweloperów: ze zdjęć i rzutu do modelu 3D, renderów i klipów wideo. Opis produktu: [docs/PRD.md](docs/PRD.md), kolejność prac: [docs/ROADMAP.md](docs/ROADMAP.md).

**Nowy w projekcie?** Instrukcja krok po kroku: [docs/URUCHOMIENIE.md](docs/URUCHOMIENIE.md). Zasady dla agentów AI (Codex, Claude Code): [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md).

## Wymagania (Windows)

- Node.js 20+ (testowane na 24) i Git
- Docker Desktop: tylko do lokalnej bazy Supabase (`npm run db:start`). Wymaga WSL 2.

## Uruchomienie

```powershell
npm install
npx playwright install chromium   # raz, przeglądarka do testów e2e
Copy-Item .env.example .env.local # potem uzupełnij klucze
npm run dev                       # http://localhost:3000
```

Aplikacja startuje też bez `.env.local`. Wtedy działa bez logowania i bazy.

## Demo (bez bazy i bez AI)

```powershell
npm run demo   # buduje i uruchamia http://localhost:4000
```

Tryb demonstracyjny zapisuje oferty w przeglądarce (localStorage + IndexedDB, `lib/demo/`). Model 3D, spacer 3D i rolka ze zdjęć działają bez dostawcy AI. Scenariusz pokazu: [docs/DEMO.md](docs/DEMO.md).

## Komendy

| Komenda | Co robi |
|---|---|
| `npm run dev` | aplikacja lokalnie |
| `npm run test` | testy logiki (Vitest) |
| `npm run e2e` | testy end-to-end (Playwright, sam startuje serwer na porcie 3100; przy działającym `npm run dev` ustaw `E2E_BASE_URL`) |
| `npm run demo` | wersja produkcyjna do pokazu na porcie 4000 |
| `npm run typecheck` | sprawdzenie typów |
| `npm run lint` | ESLint |
| `npm run db:start` | lokalna baza Supabase (Docker); wypisuje URL i klucze do `.env.local` |
| `npm run db:reset` | baza od zera + wszystkie migracje z `supabase/migrations` |

## Struktura

```
app/              strony i API (Next.js App Router)
components/       komponenty UI, model3d/ (three.js)
lib/plan/         rzut: typy, automatyczny układ z metrażu, przykład Podgórze 58
lib/video/        nagrywanie filmów w przeglądarce (spacer 3D, rolka ze zdjęć)
lib/demo/         dane demo w przeglądarce (do zastąpienia Supabase w M1–M2)
lib/providers/    dostawcy AI: interfejs, MockProvider, Higgsfield (szkielet)
lib/supabase/     klienci Supabase: client.ts (przeglądarka), server.ts (serwer), proxy.ts (sesja)
proxy.ts          odświeżanie sesji przy każdym żądaniu (w Next 16 zastępuje middleware)
supabase/         config.toml i migracje SQL
tests/unit/       Vitest
e2e/              Playwright
```
