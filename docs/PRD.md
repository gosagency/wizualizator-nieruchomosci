# PRD: Wizualizator nieruchomości (B2B)

Stan na 25.09.2026. Źródło: brief aplikacji „ze zdjęć do 3D i wideo” + testy w Higgsfield i demo 3D.

## 1. Problem i obietnica

Zdjęcia z telefonu nie sprzedają mieszkania. Kupujący nie widzi układu, a puste lub zaniedbane wnętrze odstrasza. Profesjonalne wizualizacje kosztują od kilkuset do kilku tysięcy złotych i trwają dni.

**Obietnica:** agent wgrywa zdjęcia i rzut, a w mniej niż 30 minut ma link do modelu 3D, umeblowane rendery i klipy do rolki. Bez grafika.

## 2. Klienci (firmy)

| Segment | Po co im to | Jak kupują |
|---|---|---|
| Biuro nieruchomości (3–30 agentów) | Więcej zapytań z ogłoszeń, wyróżnienie na tle konkurencji, pozyskiwanie ofert od właścicieli | Plan miesięczny na biuro, kredyty wspólne |
| Deweloper | Sprzedaż przed oddaniem budynku, wizualizacje wielu lokali z jednego rzutu | Plan roczny / pakiet na inwestycję |
| Agent niezależny | To samo co biuro, mniejsza skala | Plan startowy |

## 3. Role w organizacji

| Rola | Może |
|---|---|
| Właściciel (owner) | Wszystko + płatności, usunięcie organizacji |
| Admin | Zespół (zaproszenia, role), branding, limity kredytów agentów, wszystkie oferty |
| Agent | Własne oferty, generowanie w ramach limitu, publikacja linku |

## 4. Główny przepływ

1. Agent zakłada ofertę: adres, typ, metraż, pokoje, piętro, cena, styl aranżacji.
2. Wgrywa zdjęcia (3–6 na pomieszczenie) i rzut. Zaznacza zgodę właściciela.
3. Rysuje/koryguje pokoje i ściany w prostym edytorze rzutu (prostokąty, okna, drzwi). Suma metrażu musi się zgadzać z ofertą (±0,5 m²).
4. Aplikacja pokazuje koszt w kredytach. Agent uruchamia rendery (1 na pomieszczenie).
5. Agent akceptuje rendery albo poprawia pojedynczy pokój.
6. Z zaakceptowanych renderów powstają klipy 5 s (jeden ruch kamery na pokój).
7. Publiczna strona oferty `/o/[slug]`: model 3D, rendery, klipy, dane oferty, branding biura, kontakt do agenta.
8. Pobieranie plików (rendery, klipy 9:16 i 16:9).

## 5. Funkcje

| Funkcja | Etap |
|---|---|
| Konta, organizacje, zaproszenia, role | MVP |
| Oferty, zdjęcia, zgoda właściciela | MVP |
| Edytor rzutu (prostokąty, ściany, okna, drzwi) | MVP |
| Model 3D (umeblowane/stan deweloperski, przekrój, dzień/wieczór) | MVP |
| Rendery i klipy przez Higgsfield + portfel kredytów | MVP |
| Publiczna strona oferty z brandingiem biura | MVP |
| Panel admina: zużycie kredytów per agent i per oferta | MVP |
| Płatności (Stripe): plany i dokupienie kredytów | Po MVP |
| Montaż klipów w jeden film z napisami i ceną | Po MVP |
| Własna domena / subdomena biura | Po MVP |
| Automatyczne rozpoznanie rzutu z obrazu | Po MVP |
| Integracja z Otodom / CRM biur | Po MVP |
| Deweloper: wiele lokali z jednego budynku | Po MVP |

## 6. Kredyty i koszty

Koszt Higgsfield z testów: render ≈ 2,75 kr (jakość high, 2K), klip 5 s 720p bez dźwięku ≈ 35 kr. Mieszkanie z 5 pomieszczeniami ≈ 190 kr Higgsfield.

- Organizacja ma portfel kredytów aplikacji. Każde generowanie: rezerwacja → zadanie → rozliczenie (lub zwrot przy błędzie).
- Admin ustawia miesięczny limit na agenta.
- Przelicznik kredyty aplikacji ↔ Higgsfield, marża i ceny planów: **do decyzji** (`docs/PYTANIA.md`).

## 7. Czego nie obiecujemy

- Dokładnych wymiarów: model jest poglądowy, nie zastępuje inwentaryzacji.
- Wiernej kopii wnętrza w filmie: AI może przesunąć mebel lub okno, dlatego agent akceptuje każdy materiał.
- Skanu 3D z samych zdjęć bez rzutu.

## 8. Wymagania niefunkcjonalne

- Publiczna strona oferty działa na telefonie (390 px), model 3D ładuje się < 3 s na 4G.
- Dane organizacji odizolowane (RLS, testy izolacji między dwiema organizacjami).
- Zgodność z RODO: zdjęcia mogą zawierać dane osobowe; usuwanie oferty usuwa pliki ze Storage.
- Logi generowań (kto, co, koszt, kiedy) dla admina.

## 9. Kryteria sukcesu pilota

- 3 biura używają aplikacji przy prawdziwych ofertach przez 4 tygodnie.
- Oferta od zdjęć do linku < 30 min; 8 na 10 renderów zaakceptowanych bez poprawek.
- Koszt generowania na ofertę ≤ 200 kr Higgsfield.
