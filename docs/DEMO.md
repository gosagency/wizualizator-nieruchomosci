# Scenariusz pokazu (niedziela, 27.09.2026)

Odbiorca: dyrektor oddziału biura nieruchomości. Cel: umówić pilotaż w jego oddziale.

## Przed spotkaniem (10 minut)

0. **Film AI:** na laptopie w folderze projektu uruchom `npm run wideo:publikuj` i zostaw okno otwarte (laptop na zasilaczu, bez usypiania). Pierwsze ujęcie po starcie liczy się dłużej (wczytanie modelu).
1. Otwórz publiczny link w Chrome: https://wizualizator-nieruchomosci.vercel.app (albo lokalnie: `npm run demo` → `http://localhost:4000`).
2. Wejdź raz w **Ze zdjęcia do 3D**, żeby przeglądarka pobrała model głębi (ok. 30–50 MB, potem jest w pamięci podręcznej).
3. **Ustawienia**: wpisz nazwę biura klienta, wybierz kolor zbliżony do jego marki, wgraj logo (jeśli masz je ze strony biura).
4. Wejdź w ofertę przykładową, zakładka **Filmy** i nagraj wcześniej: „Spacer 3D · rolka 9:16” i „Spacer 3D · poziomy 16:9” (po ok. 26 s). Filmy mają wtedy już logo i kolory klienta.
5. Przygotuj 3–4 zdjęcia prawdziwego mieszkania (poziomo, z rogu pokoju, dobre światło), do wgrania na żywo.
6. Wyłącz powiadomienia, podłącz zasilanie. Internet jest potrzebny do publicznego linku i pierwszego pobrania modelu.

## Pokaz (12–15 minut)

| Krok | Co klikasz | Co mówisz |
|---|---|---|
| 1 | Panel **Oferty** | „To panel oddziału. Każda oferta ma model 3D, filmy i link. Tu widać też szacowaną oszczędność względem zleceń zewnętrznych.” |
| 2 | Oferta przykładowa → **Model 3D** | Obróć model, kliknij Sypialnię, przełącz „Stan deweloperski”, „Przekrój” i „Wieczór”. „Kupujący rozumie układ w 10 sekund, bez przyjazdu.” |
| 3 | **Filmy** | Puść rolkę 9:16. „Ten film zrobiła aplikacja sama, z logo biura, ceną i kontaktem do agenta. Bez filmowca, koszt 0 zł.” |
| 4 | **Zdjęcia i wizualizacje** | Przesuń suwak: stan deweloperski ↔ umeblowane. „Kupujący widzi, jak pokój może wyglądać. Powstało z modelu 3D, bez grafika.” |
| 4a | **Ze zdjęć do filmu i 3D** → **Film AI** (na żywo, na początku spotkania) | Wgraj 2–3 zdjęcia pokoi i kliknij „Utwórz film AI”. „Zdjęcie z telefonu zamienia się w ujęcie jak z kamery, a potem w film z logo biura. Otwarty model AI na naszym serwerze, bez opłat za generowanie.” Każde ujęcie liczy się ok. 5 min (4 s w HD), więc zleć 2 zdjęcia na początku i wróć do filmu pod koniec rozmowy. |
| 4b | **Ze zdjęć do filmu i 3D** → widok 3D (na żywo) | Wgraj zdjęcie pokoju. Pokaż „Widok 3D” (przesuń myszką) i „Mapa głębi”, nagraj „Rolka 9:16”. „Zwykłe zdjęcie z telefonu zamienia się w scenę 3D i film. Zdjęcie nie wychodzi z urządzenia, więc nie ma problemu z RODO.” Klient może to zrobić sam u siebie na telefonie pod tym samym linkiem. |
| 5 | **Nowa oferta** (na żywo) | Metraż, liczba pokoi, wgraj zdjęcia z pulpitu, podgląd 3D. „Agent nie rysuje rzutu: podaje metraż pokoi, resztę układa aplikacja.” |
| 6 | Nowa oferta → **Filmy** → Rolka ze zdjęć | „Po minucie agent ma rolkę do Instagrama.” |
| 7 | **Publikacja** i **Strona oferty ↗** | „Ten link wklejasz do Otodom w pole wirtualnego spaceru. Ten kod osadzasz na stronie biura.” Pokaż stronę oferty w widoku telefonu (F12 → ikona telefonu). |
| 8 | **Integracje** | „Portale, strona biura i social media działają od razu. Integracja z Waszym CRM jest następnym krokiem, dlatego proponuję pilotaż.” |

## Liczby do rozmowy (docs/RYNEK.md)

- Spacer 3D od fotografa: 500–1 500 zł za mieszkanie, trzeba umówić wizytę.
- Rolka od filmowca: 800–3 000 zł netto.
- Otodom: ogłoszenia z widokiem 3D mają 2× więcej wyświetleń i o 50% więcej zapytań.
- Polska konkurencja AI (AdresFlow, Nbot, Dekor Estate) robi tylko zdjęcia: bez modelu 3D, bez filmów, bez strony oferty. My robimy 3D i filmy bez płatnych usług, więc koszt na ofertę jest praktycznie zerowy.

## Pytania, które mogą paść

- **„Czy to wierny model?”** Nie, poglądowy: układ i proporcje z metrażu pokoi. Wszędzie jest napis „Wizualizacja poglądowa”. Z prawdziwym rzutem od dewelopera model będzie dokładniejszy.
- **„Czy potrzebujemy jakichś płatnych usług AI?”** Nie. Film AI robi otwarty model Wan 2.2 (licencja Apache-2.0) na naszym serwerze z kartą graficzną; model 3D, wizualizacje i spacer działają w przeglądarce (three.js, Depth Anything V2).
- **„Ile trwa film AI?”** Ok. 5 min na 4-sekundowe ujęcie HD na obecnym serwerze demonstracyjnym (laptop). Serwer z mocniejszą kartą skraca to do kilkudziesięciu sekund.
- **„Ile to kosztuje?”** Do ustalenia po pilotażu (docs/PYTANIA.md). Propozycja: abonament oddziału plus pakiet ofert. Punkt odniesienia: 1 spacer + 1 rolka na rynku to 1 300–4 500 zł.
- **„RODO?”** Widok 3D liczy się na urządzeniu agenta. Do filmu AI zdjęcie trafia tylko na nasz serwer, nie do zewnętrznych firm AI. Publikacja wymaga zgody właściciela (checkbox przy ofercie). Usunięcie oferty usuwa pliki.
- **„Integracja z naszym CRM?”** Tak, przez API i webhooki, w ramach pilotażu.

## Czego nie mówić

- Nie obiecuj „wiernego skanu”: model z metrażu i scena ze zdjęcia są poglądowe.
- Film AI w wersji demo liczy się na laptopie: gdy laptop jest wyłączony, strona pokazuje „Serwer wideo offline” (reszta działa normalnie).
- Dane ofert są zapisywane w przeglądarce, na której je utworzono. Link `/o/…` do konkretnej oferty działa na tym urządzeniu; wspólna baza dla całego biura to etap po pilotażu (M1–M2).
