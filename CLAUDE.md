# Wizualizator nieruchomości (nazwa robocza)

Aplikacja B2B (SaaS) dla biur nieruchomości i deweloperów. Agent wgrywa zdjęcia i rzut mieszkania. Aplikacja zwraca link do interaktywnego modelu 3D, umeblowane rendery pomieszczeń i krótkie klipy wideo do ogłoszenia i social mediów.

Zasady Next.js 16 dla agentów: @AGENTS.md (czytaj dokumentację z `node_modules/next/dist/docs/`, np. middleware nazywa się teraz `proxy.ts`).

Pełny opis produktu: `docs/PRD.md`. Kolejność prac: `docs/ROADMAP.md`. Wzorzec modelu 3D: `docs/reference/demo-3d-podgorze.html`.

## Język

- Interfejs, komunikaty i treści dla użytkownika: **po polsku**.
- Kod, nazwy plików, tabel, zmiennych, commity: **po angielsku**.
- Odpowiadaj właścicielowi projektu po polsku, prosto i krótko.

## Stos

- Next.js (App Router) + TypeScript + Tailwind, wdrożenie na Vercel (domyślnie preview).
- Supabase: Auth, Postgres (RLS), Storage, Realtime do statusów zadań.
- three.js przez React Three Fiber + drei dla modelu 3D (ładowane dynamicznie, `ssr:false`).
- Generowanie obrazów i wideo: Higgsfield, **wyłącznie po stronie serwera**, przez adapter `lib/providers/`.
- Testy: Vitest (logika), Playwright (scenariusze end-to-end).
- Środowisko właściciela: Windows. Skrypty w `package.json` mają działać w PowerShell (bez składni bash w skryptach npm).

## Zasady, których nie łamiemy

1. **Multi-tenant od pierwszego dnia.** Każda tabela z danymi klienta ma `org_id`. RLS na każdej tabeli w `public`. Użytkownik widzi tylko dane swojej organizacji.
2. **Klucze tylko na serwerze.** `SUPABASE_SERVICE_ROLE_KEY`, klucz Higgsfield i Stripe nigdy w kodzie klienta ani w `NEXT_PUBLIC_*`.
3. **Kredyty to pieniądze.** Każde generowanie: najpierw koszt, potem zapis w `credit_ledger`, potem zadanie. Render przed wideo. W dev i testach domyślnie `MockProvider` (zero kredytów). Prawdziwy provider tylko przy `GENERATION_PROVIDER=higgsfield`.
4. **Uczciwość wobec kupujących.** Każdy render, model i film ma oznaczenie „Wizualizacja poglądowa”. Publikacja oferty wymaga zapisanej zgody właściciela nieruchomości.
5. **Małe kroki.** Jeden etap z `docs/ROADMAP.md` naraz. Po etapie: testy przechodzą, krótkie podsumowanie, co zrobione i co dalej. Nie zaczynaj kolejnego etapu bez potwierdzenia.
6. **Nie zgaduj API Higgsfield.** Zanim napiszesz adapter, sprawdź aktualną dokumentację (CLI `higgsfield`, API, limity). Brakujące informacje zapisz w `docs/PYTANIA.md`.

## Skille w projekcie (`.claude/skills/`)

- `wideo-nieruchomosci-higgsfield`: prompty, ustawienia modeli, koszty i kolejność render → klip.
- `model-3d-z-rzutu`: format danych pokoi i ścian, budowa sceny, światło, interakcja.
- `aplikacja-wizualizacje-stack`: architektura, model danych, RLS, zasady React i Vercel, testy.

Pełne skille zewnętrzne (Vercel, Supabase, Higgsfield, three.js, Anthropic) instaluje `scripts/install-skills.ps1` (Windows) lub `scripts/install-skills.sh`.

## Stan (25.09.2026): demo przed M1

- Działa demo bez bazy: `lib/demo/` (localStorage + IndexedDB). W M1–M2 zamieniamy na Supabase, model danych w `lib/demo/types.ts` odpowiada tabelom z roadmapy.
- **Decyzja właściciela (25.09.2026): bez płatnych usług AI, bez Higgsfield.** Wszystko działa w przeglądarce na otwartych narzędziach: model 3D z metrażu (`components/model3d/`), wizualizacje pokoi z modelu (`lib/video/views.ts`), zdjęcie → 3D przez Depth Anything V2 + transformers.js (`lib/depth/`, `components/photo3d/`), filmy (`lib/video/`). Film AI ze zdjęcia: otwarty Wan 2.2 TI2V-5B w lokalnym ComfyUI na GPU właściciela (`video-worker/`, `npm run wideo:publikuj`, tunel cloudflared), klient w `lib/aiVideo/`. Nie proponuj wydawania kredytów Higgsfield. Zasady 3 i 6 oraz etap M4 z roadmapy są wstrzymane.
- Rzut z samego metrażu pokoi: `lib/plan/autoLayout.ts`.
- Publiczny adres: https://wizualizator-nieruchomosci.vercel.app (Vercel, konto właściciela, produkcja, bo podglądy są chronione logowaniem). Wdrożenie: czysta kopia `git archive HEAD` bez `.claude`, `.agents`, `skills-lock.json`, `scripts`, potem `vercel deploy --prod --yes` w tej kopii.
- Rynek i konkurencja: `docs/RYNEK.md`. Scenariusz pokazu: `docs/DEMO.md`.

## Komendy

```
npm run dev        # aplikacja lokalnie
npm run test       # Vitest
npm run e2e        # Playwright (serwer na :3100; E2E_BASE_URL=http://localhost:3010 przy działającym dev)
npm run demo       # build + start na :4000 (pokaz)
npm run wideo      # serwer Film AI (ComfyUI + worker + tunel); -- --publikuj zapisuje adres w Vercel i wdraża
npm run deploy     # wdrożenie ostatniego commita na Vercel (produkcja)
npm run typecheck  # next typegen + tsc
npm run lint       # ESLint
npm run db:start   # lokalna baza Supabase (wymaga Dockera)
npm run db:reset   # baza od zera + migracje
```

## Definicje

- **Organizacja**: biuro nieruchomości albo deweloper; płaci za plan, ma kredyty, logo i kolory.
- **Oferta**: jedna nieruchomość (dane, pokoje, ściany, zdjęcia, wygenerowane materiały, publiczny link).
- **Generowanie**: jedno zadanie u providera (render albo klip) ze statusem i kosztem.
- **Kredyty aplikacji**: waluta w aplikacji; przelicznik na kredyty Higgsfield i marża w `docs/PYTANIA.md` do decyzji.
