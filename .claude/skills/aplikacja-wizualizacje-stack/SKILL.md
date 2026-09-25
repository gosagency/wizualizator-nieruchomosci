---
name: aplikacja-wizualizacje-stack
description: Zasady budowy aplikacji „ze zdjęć do 3D i wideo” dla agentów nieruchomości — Next.js na Vercel, Supabase (baza, pliki, logowanie), zadania Higgsfield w tle, testy Playwright. Użyj przy planowaniu, kodowaniu, przeglądzie lub wdrażaniu tej aplikacji albo przy briefie dla Codexa.
---

# Aplikacja wizualizacji nieruchomości — stos i zasady

Streszcza oficjalne skille: `vercel-labs/agent-skills` (react-best-practices, deploy-to-vercel), `supabase/agent-skills` (supabase, postgres-best-practices), `anthropics/skills` (webapp-testing), `higgsfield-ai/skills` (higgsfield-generate). Wszystkie MIT / Apache. Pełne wersje do Codexa / Claude Code instaluj w repo aplikacji:

```bash
npx skills add vercel-labs/agent-skills
npx skills add supabase/agent-skills
npx skills add higgsfield-ai/skills
git clone --depth 1 https://github.com/CloudAI-X/threejs-skills .agents/threejs-skills
# anthropics/skills (Claude Code): /plugin marketplace add anthropics/skills
```

Powiązane skille: `wideo-nieruchomosci-higgsfield` (prompty i koszty), `model-3d-z-rzutu` (moduł 3D).

## Architektura MVP

```
Telefon/komputer agenta ──► Next.js (Vercel)
                              ├─ Supabase Auth (logowanie agenta)
                              ├─ Supabase Storage (zdjęcia, rendery, klipy)
                              ├─ Supabase Postgres (oferty, pokoje, zadania)
                              └─ Worker w tle ──► Higgsfield (render → wideo)
Klient końcowy ──► publiczny link /o/[slug] (model 3D + film, bez logowania)
```

## Model danych (Postgres)

| Tabela | Kluczowe pola |
|---|---|
| `organizations` | id, name, slug, logo_path, brand_color, plan |
| `memberships` | org_id, user_id, role (owner/admin/agent), credit_limit_monthly |
| `offers` | id, org_id, created_by, slug, adres, metraż, pokoje, cena, styl, status, consent_owner (bool) |
| `rooms` | id, offer_id, name, area_m2, rects (jsonb), floor, features (text[]) |
| `walls` | id, offer_id, ax, c, a, b, t, openings (jsonb) |
| `photos` | id, room_id, storage_path |
| `generations` | id, org_id, room_id, kind (render/clip), provider_job_id, status (queued/running/done/failed), credits, result_path, approved (bool) |

- Multi-tenant: każda tabela z danymi klienta ma `org_id`. RLS włączone na każdej tabeli w `public`; polityki `TO authenticated` + członkostwo w organizacji (helper `is_member(org_id)`, `has_role(org_id, role)` jako `security definer` ze stałym `search_path`). Agent edytuje własne oferty, admin wszystkie w organizacji. Nie używaj `auth.role()` ani `user_metadata` w autoryzacji.
- UPDATE wymaga też polityki SELECT — inaczej cicho zmienia 0 wierszy.
- Publiczny link: osobny widok `WITH (security_invoker = true)` lub funkcja zwracająca tylko opublikowaną ofertę.
- Indeksy na kluczach obcych (`offer_id`, `room_id`) i na `generations(status)`.
- Supabase zmienia się często — przed implementacją sprawdź `https://supabase.com/changelog.md`.

## Zadania Higgsfield

- Klucz / sesja Higgsfield **tylko po stronie serwera**. Nigdy w kodzie przeglądarki ani w `NEXT_PUBLIC_*`.
- Oficjalny skill działa przez CLI `higgsfield` (`generate create … --wait`, `generate cost …`). Dostęp przez API dla aplikacji (klucz serwisowy, limity, cennik) — potwierdzić z Higgsfield przed budową.
- Kolejność zawsze: render → akceptacja agenta → klip. Koszt zapisuj w `generations.credits`; limit poprawek na ofertę.
- Generowanie trwa minuty: kolejka + status w bazie + powiadomienie (Realtime lub e-mail). Nie trzymaj żądania HTTP otwartego.
- Warstwa pośrednia `providers/video.ts` z jednym interfejsem, żeby dało się podmienić model/dostawcę.

## React / Next.js — zasady o najwyższym wpływie

- Bez wodospadów: niezależne zapytania przez `Promise.all`, `await` dopiero tam, gdzie wynik jest potrzebny.
- Moduł 3D (three.js) ładuj dynamicznie (`next/dynamic`, `ssr:false`) — tylko na stronie modelu.
- Importuj bezpośrednio, bez plików-beczek (`index.ts` re-eksportujących wszystko).
- Autoryzuj server actions jak endpointy API.
- Minimalne dane do komponentów klienckich; ciężkie media przez podpisane URL-e ze Storage.
- Upload zdjęć z telefonu: kompresja po stronie klienta (max ~2500 px), bezpośrednio do Storage.

## Wdrożenie (Vercel)

- Domyślnie **preview**, produkcja tylko na wyraźną prośbę.
- Najpierw sprawdź: `git remote`, `.vercel/project.json`, `vercel whoami`. Docelowo: repo połączone z Vercel, deploy przy każdym pushu.
- Zmienne: `SUPABASE_URL`, klucz publishable w kliencie; `service_role` i klucz Higgsfield tylko w env serwera.

## Testy (Playwright)

- Skrypty Pythona z Playwright, Chromium headless; zawsze `wait_for_load_state('networkidle')` przed akcjami.
- Najpierw rekonesans (zrzut ekranu / DOM), potem selektory, potem akcje.
- Scenariusz krytyczny: logowanie → nowa oferta → upload 3 zdjęć → render (zamockowany provider) → akceptacja → publiczny link otwiera model 3D na szerokości 390 px.
- Zadania Higgsfield w testach mockuj — nie wydawaj kredytów w CI.

## Definicja „gotowe” dla MVP

Test izolacji: użytkownik organizacji A nie widzi danych organizacji B. Oferta od zdjęć do linku i filmu < 30 min; koszt ≤ 200 kredytów; publiczny link działa na telefonie; napis „Wizualizacja poglądowa” na każdym renderze i w modelu; zgoda właściciela zapisana przed publikacją.
