# Roadmapa

Jeden etap naraz. Etap jest skończony, gdy spełnia kryteria odbioru i testy przechodzą. Po każdym etapie: commit, krótkie podsumowanie po polsku, pytanie o zgodę na następny.

## M0: Fundament

- Next.js (App Router, TS, Tailwind, ESLint), struktura katalogów `app/`, `lib/`, `components/`, `supabase/`.
- Supabase lokalnie (`supabase init`, migracje w repo), klient serwerowy i przeglądarkowy (`@supabase/ssr`).
- Vitest + Playwright skonfigurowane, 1 test każdego rodzaju.
- `.env.example` uzupełniony, README z instrukcją uruchomienia na Windows.

**Odbiór:** `npm run dev`, `npm run test`, `npm run e2e` działają na czystym klonie.

## M1: Organizacje i zespół

- Logowanie (e-mail magic link), tabela `profiles`.
- `organizations`, `memberships (org_id, user_id, role: owner|admin|agent)`, zaproszenia e-mail.
- RLS na wszystkim; helper SQL `is_member(org_id)` i `has_role(org_id, role)`.
- Przełącznik organizacji w UI (użytkownik może być w kilku).

**Odbiór:** test izolacji: użytkownik z organizacji A nie widzi niczego z organizacji B (Vitest na bazie lokalnej).

## M2: Oferty i zdjęcia

- `offers`, `rooms`, `walls`, `photos` (wszystkie z `org_id`), Storage bucket `offer-photos` z politykami per organizacja.
- Formularz oferty, upload zdjęć z telefonu (kompresja do ~2500 px po stronie klienta), zgoda właściciela.
- Edytor rzutu: prostokąty pokoi w metrach, ściany z otworami (okno/drzwi/przejście). Walidacja: suma metrażu = metraż oferty ±0,5 m².

**Odbiór:** e2e: agent tworzy ofertę 3-pokojową, wgrywa 3 zdjęcia, rysuje pokoje, zapisuje.

## M3: Model 3D i publiczna strona

- Port `docs/reference/demo-3d-podgorze.html` do komponentu React Three Fiber, dane z `rooms` i `walls`.
- Przełączniki: umeblowane/stan deweloperski, pełne ściany/przekrój, dzień/wieczór; klik w pokój.
- Publiczna strona `/o/[slug]`: dane oferty, model, branding organizacji (logo, kolor), znak „Wizualizacja poglądowa”.

**Odbiór:** e2e na 390 px: link otwiera model, klik w pokój pokazuje metraż.

## M4: Generowanie i kredyty

- Interfejs `GenerationProvider` (`estimateCost`, `submit`, `getStatus`), `MockProvider` (domyślny) i `HiggsfieldProvider`.
- Najpierw ustal i zapisz, jak aplikacja łączy się z Higgsfield (API/CLI, autoryzacja serwisowa, limity) i uzupełnij `docs/PYTANIA.md`.
- `generations`, `credit_wallets`, `credit_ledger` (rezerwacja, obciążenie, zwrot); limit na agenta.
- Kolejka zadań w tle + statusy na żywo (Supabase Realtime). Render → akceptacja → klip. Poprawka jednego pokoju.
- Prompty i parametry wyłącznie według skilla `wideo-nieruchomosci-higgsfield`.

**Odbiór:** z MockProvider pełny przepływ w e2e bez kredytów. Jeden ręczny test na prawdziwym providerze (1 render + 1 klip, ≈ 38 kr) za zgodą właściciela projektu.

## M5: Panel admina i pilotaż

- Zużycie kredytów per agent i oferta, lista generowań, limity.
- Pobieranie renderów i klipów, galeria na stronie publicznej.
- Wdrożenie preview na Vercel + Supabase w chmurze.

**Odbiór:** pierwsze biuro pilotażowe zakłada konto i publikuje ofertę bez naszej pomocy.

## Po MVP

Płatności Stripe (plany, dokupienie kredytów), montaż filmu z napisami i ceną, subdomeny biur, rozpoznawanie rzutu z obrazu, eksport do Otodom, moduł dla deweloperów.
