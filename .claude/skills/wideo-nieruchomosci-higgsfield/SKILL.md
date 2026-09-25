---
name: wideo-nieruchomosci-higgsfield
description: Rendery wnętrz i krótkie filmy „spacer po mieszkaniu” w Higgsfield dla ofert nieruchomości. Użyj, gdy trzeba zrobić wizualizację pokoju, home staging albo rolkę/wideo mieszkania ze zdjęć lub briefu.
---

# Wideo i rendery nieruchomości w Higgsfield

Ze zdjęć (albo z briefu) robisz: 1 render na pomieszczenie → 1 krótki klip na pomieszczenie → komplet klipów do rolki.
W kodzie aplikacji generowanie idzie wyłącznie przez adapter `lib/providers/` (MockProvider w dev i testach); te same prompty i parametry obowiązują adapter. Gdy Claude sam robi próbki w rozmowie, używa narzędzi: Higgsfield przez MCP (`generate_image`, `generate_video`, `jobs_wait`, `show_generation_by_ids`, `media_upload_widget`, `balance`, `models_explore`).

Oparte na: oficjalnym skillu `higgsfield-ai/skills` (higgsfield-generate, MIT) i `OSideMedia/higgsfield-ai-prompt-skill` (Seedance 2.5, kamera, troubleshooting, MIT) + nasz test z 25.09.2026.

## Zasady kosztów (zawsze)

1. `balance` na start. Przed każdym wideo `get_cost: true` i podaj koszt użytkownikowi w jednym zdaniu.
2. **Jedna próbka przed kompletem.** Najpierw 1 pomieszczenie (render + klip), pokaż, dopiero potem reszta.
3. **Render przed wideo.** Wideo robisz tylko z zaakceptowanego renderu.
4. Poprawka = tylko ten jeden element. Nie powtarzaj promptu bez zmiany „na szczęście” — zmieniaj jedną rzecz naraz.

Orientacyjne stawki z testu: render GPT Image 2.5 ≈ 0,25 kr; klip Seedance 2.5, 10 s, 720p, bez dźwięku ≈ 70 kr (5 s ≈ 35 kr, do potwierdzenia `get_cost`). Mieszkanie 5 pomieszczeń ≈ 176 kr.

## Dane wejściowe

- Zdjęcia pomieszczeń od użytkownika → `media_upload_widget` (jako jedyne narzędzie w tej turze). Nie czytaj plików z czatu shellem.
- Zdjęcia z linku → `media_import_url`, potem `media_id`.
- Brak zdjęć → render z opisu (brief: styl, kolory, metraż, strony świata, co ma zapamiętać klient).
- Zapytaj tylko o brakujące: styl, format (9:16 rolka / 16:9 ogłoszenie), które pomieszczenia.

## Krok 1 — render pomieszczenia

- Model: `gpt_image_2_5` (domyślny do fotorealizmu). Przed pierwszym użyciem `models_explore get` i ustaw najwyższą sensowną jakość — domyślnie wychodziła `quality: low`, co psuje też wideo.
- `aspect_ratio` jak docelowy film (9:16 lub 16:9).
- Ze zdjęciem: `medias` z rolą z katalogu modelu (referencja). W prompcie: „Keep the exact room layout, walls, windows, doors and floor from the reference photo. Replace only furniture and decor.”
- Szablon promptu (EN, 60–120 słów):
  `Photorealistic real estate interior photo of a [pomieszczenie] in a [metraż] m2 apartment in [miasto]. [Styl] style: [materiały, kolory]. [Układ: co gdzie stoi, 3–5 elementów]. [Okno/światło: strona świata, pora]. Eye-level view from the doorway, wide-angle, professional architectural photography, natural light, empty of people.`
- Pozytywne sformułowania („empty of people”, „clean walls”) zamiast list „no …”.

## Krok 2 — klip wideo z renderu

- Model: `seedance_2_5`, `mode: omni_reference`, `medias: [{role: start_image, value: <job_id renderu>}]`, `duration: 5` (max 10 na pomieszczenie), `resolution: 720p` (1080p na finał), `generate_audio: false`, `aspect_ratio` jak render.
- **Jeden ruch kamery na klip.** Łączenie „przejdź + obróć + przechyl” to główna przyczyna drgań i deformacji. (W naszym teście prompt miał 3 ruchy — nie powtarzaj.)
- Prompt 30–100 słów. Dłuższy = rozmycie i „pływanie” mebli.
- Szablon:
  `Real estate tour. Camera: slow steady [ruch] through the [pomieszczenie], starting at [punkt startu], ending at [punkt końca], over [5] seconds. Keep the room layout, furniture and materials exactly as in the start image. Stable horizon, natural daylight, photorealistic, calm pace.`
- Jeśli narzędzie zwróci `preset_recommendation` niepasujący do jasnego wnętrza (np. „IN THE DARK”), ponów z `declined_preset_id`.

| Pomieszczenie | Ruch kamery (jeden) |
|---|---|
| Salon | slow dolly in toward the window/balcony |
| Kuchnia / aneks | slow lateral dolly left along the counter |
| Sypialnia | slow dolly in toward the bed, eye level |
| Pokój dziecięcy | slow pan right across the room |
| Łazienka | static wide shot with gentle push in (unikaj ujęć na lustro) |
| Balkon / widok | slow dolly out from the window to reveal the view |
| Przedpokój → salon | dolly forward through the doorway (start_image przedpokój, end_image salon) |

Przejście między pokojami: `start_image` = render pokoju A, `end_image` = render pokoju B, ruch „dolly forward through the doorway”.

## Krok 3 — dostarczenie

- Niezależne klipy → `generate_video_batch`, potem `jobs_wait` (grupy ≤12, co ~60 s), na koniec jedno `show_generation_by_ids`.
- Pokaż klipy w kolejności spaceru: przedpokój → salon → kuchnia → sypialnia → pokój → łazienka → balkon.
- Klipy użytkownik skleja w edytorze (CapCut, Instagram) albo prosi o montaż osobno. Nie obiecuj montażu, którego nie zrobiłeś.
- Zawsze przypomnij: napis „Wizualizacja poglądowa”, meble nie są częścią oferty. Sprawdź klip przed publikacją — AI potrafi przesunąć okno lub mebel.

## Gdy coś nie wyszło

| Objaw | Przyczyna | Poprawka (jedna zmiana) |
|---|---|---|
| Meble „pływają”, ściany się wyginają | Za długi prompt albo kilka ruchów kamery | Skróć do < 80 słów, zostaw jeden ruch |
| Drgania, obrót horyzontu | Złożony ruch | „slow steady dolly in” + „stable horizon” |
| Zmienia się układ pokoju | Klip za długi | 5 s zamiast 10 s |
| Dziwne odbicia | Lustra, duże przeszklenia w kadrze | Zmień punkt kamery w renderze |
| Szary, płaski obraz | Render w niskiej jakości | Podnieś `quality` renderu, nie wideo |
| Pojawiają się ludzie | Negatywne sformułowanie | „empty room, quiet interior” |

## Czego nie obiecujemy

Dokładnych wymiarów, wiernej kopii wnętrza w filmie, zdjęć „jak prawdziwe” bez oznaczenia. To wizualizacja poglądowa.
