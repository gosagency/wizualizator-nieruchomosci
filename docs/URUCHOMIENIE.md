# Jak uruchomić Wizualizator nieruchomości

Instrukcja krok po kroku. **Część A** uruchamia całą aplikację (model 3D, filmy 3D, strona oferty) na dowolnym komputerze w około 5 minut. **Część B** dodaje „Film AI” (film z ruchem kamery ze zdjęcia) i wymaga komputera z Windows i kartą NVIDIA.

Komendy wpisujesz w **PowerShell** (Windows) albo w Terminalu (macOS/Linux), zawsze w folderze projektu.

---

## Część A: aplikacja (każdy komputer)

### 1. Zainstaluj Node.js

Pobierz wersję LTS ze strony https://nodejs.org (wymagana wersja 20.9 lub nowsza, sprawdzona na 24). Po instalacji sprawdź w nowym oknie PowerShell:

```powershell
node -v
npm -v
```

### 2. Rozpakuj projekt

Rozpakuj `wizualizator-nieruchomosci-kod.zip`, np. na pulpit. Powstanie folder `wizualizator-nieruchomosci`. Otwórz w nim PowerShell (w Eksploratorze: pasek adresu → wpisz `powershell` → Enter).

### 3. Zainstaluj biblioteki (raz)

```powershell
npm install
```

Trwa 1–3 minuty. Ostrzeżenia `npm warn` są normalne.

### 4. Uruchom

```powershell
npm run dev
```

Otwórz w Chrome lub Edge: **http://localhost:3000**. Zatrzymanie: Ctrl+C w oknie PowerShell.

Szybsza wersja „pokazowa” (bez narzędzi programistycznych), na porcie 4000:

```powershell
npm run demo
```

### Co zobaczysz

| Miejsce | Co robi |
|---|---|
| **Oferty** | Panel biura z ofertą przykładową „Podgórze 58”. |
| Oferta → **Model 3D** | Mieszkanie 3D: obracanie, klik w pokój, stan deweloperski, przekrój, dzień/wieczór. |
| Oferta → **Filmy** | Nagrywanie filmów w przeglądarce: spacer 3D (9:16, 16:9), rolka, film 3D ze zdjęć. |
| **Nowa oferta** | Kreator: metraż pokoi → automatyczny rzut i model 3D. |
| **Ze zdjęcia do 3D** | Wgrywasz zdjęcie pokoju → scena 3D (Depth Anything V2 w przeglądarce) i film. Panel „Film AI” wymaga części B. |
| **Ustawienia** | Nazwa, kolor i logo biura na stronach ofert i w filmach. |

Ważne:
- Dane zapisują się **w przeglądarce** (bez bazy danych). Inna przeglądarka = puste dane. „Ustawienia → Przywróć dane demo” czyści wszystko.
- Pierwsze wejście w „Ze zdjęcia do 3D” pobiera model głębi (30–50 MB), potrzebny jest internet.
- Plik `.env.local` **nie jest potrzebny** do wersji demo.

### Testy (opcjonalnie)

```powershell
npx playwright install chromium
npm run test
npm run typecheck
npm run lint
npm run e2e
```

Jeśli `npm run dev` jest już uruchomione, e2e odpal tak: `$env:E2E_BASE_URL="http://localhost:3000"; npm run e2e`.

---

## Część B: Film AI (Windows + karta NVIDIA)

Film AI zamienia zdjęcie w 4-sekundowe ujęcie HD z ruchem kamery. Liczy go otwarty model **Wan 2.2** (Apache-2.0) w programie **ComfyUI** na Twojej karcie graficznej. Bez płatnych usług.

### Wymagania

- Windows 10/11, karta **NVIDIA z min. 8 GB VRAM** (sprawdzone: RTX 5060 Laptop 8 GB), aktualny sterownik NVIDIA.
- Min. 16 GB RAM, ok. 20 GB wolnego miejsca na dysku.
- Czas: ok. 5 minut na jedno ujęcie na karcie 8 GB (szybsza karta = krócej).

Sprawdź kartę:

```powershell
nvidia-smi
```

### 1. Zainstaluj ComfyUI (wersja przenośna)

1. Wejdź na https://github.com/Comfy-Org/ComfyUI/releases/latest i pobierz **`ComfyUI_windows_portable_nvidia.7z`** (ok. 1,9 GB).
2. Utwórz folder `ComfyUI` w swoim katalogu użytkownika (`C:\Users\<twoja_nazwa>\ComfyUI`) i rozpakuj tam archiwum. W PowerShell:

```powershell
New-Item -ItemType Directory -Force $HOME\ComfyUI
tar -xf $HOME\Downloads\ComfyUI_windows_portable_nvidia.7z -C $HOME\ComfyUI
```

Powinien powstać folder `C:\Users\<twoja_nazwa>\ComfyUI\ComfyUI_windows_portable`. (Inne miejsce też zadziała, patrz „Inne ścieżki” niżej.)

### 2. Dodaj obsługę modeli GGUF

Potrzebny jest Git (https://git-scm.com). Potem:

```powershell
cd $HOME\ComfyUI\ComfyUI_windows_portable
git clone https://github.com/city96/ComfyUI-GGUF ComfyUI\custom_nodes\ComfyUI-GGUF
.\python_embeded\python.exe -m pip install -r ComfyUI\custom_nodes\ComfyUI-GGUF\requirements.txt
```

### 3. Pobierz modele (ok. 12,5 GB)

Pobierz 4 pliki i włóż je do wskazanych folderów w `ComfyUI_windows_portable\ComfyUI\models\`:

| Plik | Rozmiar | Folder | Link |
|---|---|---|---|
| `Wan2.2-TI2V-5B-Q6_K.gguf` | 4,2 GB | `unet` | https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF/resolve/main/Wan2.2-TI2V-5B-Q6_K.gguf |
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | 6,7 GB | `text_encoders` | https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors |
| `wan2.2_vae.safetensors` | 1,4 GB | `vae` | https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors |
| `rife_v4.26.safetensors` | 23 MB | `frame_interpolation` | https://huggingface.co/Comfy-Org/frame_interpolation/resolve/main/frame_interpolation/rife_v4.26.safetensors |

Albo jedną komendą w PowerShell (pobiera wszystko do właściwych folderów):

```powershell
$m = "$HOME\ComfyUI\ComfyUI_windows_portable\ComfyUI\models"
curl.exe -L -o "$m\unet\Wan2.2-TI2V-5B-Q6_K.gguf" https://huggingface.co/QuantStack/Wan2.2-TI2V-5B-GGUF/resolve/main/Wan2.2-TI2V-5B-Q6_K.gguf
curl.exe -L -o "$m\text_encoders\umt5_xxl_fp8_e4m3fn_scaled.safetensors" https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors
curl.exe -L -o "$m\vae\wan2.2_vae.safetensors" https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors
curl.exe -L -o "$m\frame_interpolation\rife_v4.26.safetensors" https://huggingface.co/Comfy-Org/frame_interpolation/resolve/main/frame_interpolation/rife_v4.26.safetensors
```

Po pobraniu sprawdź, czy pliki mają podane rozmiary (przerwane pobieranie da za mały plik).

### 4. Pobierz tunel Cloudflare (do udostępniania przez internet)

1. Wejdź na https://github.com/cloudflare/cloudflared/releases/latest i pobierz **`cloudflared-windows-amd64.exe`**.
2. Zmień nazwę na `cloudflared.exe` i włóż do `C:\Users\<twoja_nazwa>\ComfyUI\tools\`.

Konto Cloudflare nie jest potrzebne.

### 5. Uruchom Film AI

W folderze projektu (drugie okno PowerShell, obok `npm run dev`):

```powershell
npm run wideo
```

Skrypt:
1. instaluje nasz węzeł ComfyUI (przypina pierwszą i ostatnią klatkę do zdjęcia, żeby meble nie znikały),
2. uruchamia ComfyUI (tylko lokalnie, 127.0.0.1:8188),
3. uruchamia serwer wideo (127.0.0.1:8787),
4. otwiera darmowy tunel i wypisuje publiczny adres `https://….trycloudflare.com`.

Zostaw to okno otwarte. Ctrl+C wyłącza wszystko.

### 6. Wypróbuj u siebie

Otwórz (z działającym `npm run dev`):

**http://localhost:3000/wyprobuj?serwer=http://127.0.0.1:8787**

Wgraj zdjęcie pokoju → panel „Film AI z ruchem kamery” powinien pokazać „Serwer wideo online” → **Utwórz film AI**. Pierwsze ujęcie po starcie trwa dłużej (wczytanie modelu do karty).

Żeby ktoś inny mógł tworzyć filmy przez internet, dopisz jego stronę do dozwolonych i użyj adresu tunelu, np. w PowerShell:

```powershell
$env:ALLOWED_ORIGINS = "https://twoja-strona.vercel.app,http://localhost:3000"
$env:SITE_URL = "https://twoja-strona.vercel.app"
npm run wideo
```

Link dla klienta wypisze się na końcu (z dopiskiem `?serwer=https://….trycloudflare.com`). Adres tunelu zmienia się przy każdym starcie.

---

## Własna publiczna strona (opcjonalnie)

Żeby mieć własny adres `https://….vercel.app`:

```powershell
npm install -g vercel
vercel login
vercel link
vercel deploy --prod
```

Potem `npm run wideo:publikuj` może sam wpisywać adres tunelu do Twojego projektu Vercel i wdrażać stronę (wymaga, żeby projekt był w repozytorium git z commitem: skrypt wdraża ostatni commit).

---

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---|---|
| PowerShell: „uruchamianie skryptów jest wyłączone” przy `npm` | Użyj `npm.cmd` zamiast `npm` (np. `npm.cmd install`) albo otwórz „Wiersz polecenia” (cmd). |
| Port 3000 zajęty | `npm run dev -- -p 3001` i dopisz `http://localhost:3001` do `ALLOWED_ORIGINS` przy Filmie AI. |
| „Serwer wideo offline” | Czy okno z `npm run wideo` działa? Sprawdź http://127.0.0.1:8787/health w przeglądarce. W linku musi być `?serwer=…`. |
| „origin not allowed” / błąd CORS | Adres strony musi być na liście `ALLOWED_ORIGINS` (domyślnie localhost:3000, 3010, 4000). |
| Brak `Wan22FirstLastLatent` w ComfyUI | Uruchom ponownie `npm run wideo` (kopiuje węzeł do `custom_nodes`), a jeśli ComfyUI już działało, zamknij je i uruchom skrypt jeszcze raz. |
| „Brak modelu RIFE” | Pobierz `rife_v4.26.safetensors` do `models\frame_interpolation` (krok B3). |
| Brak pamięci / bardzo wolno | Zamknij Chrome, Discorda, gry. Krótsze ujęcia: `$env:FRAMES="33"; npm run wideo`. |
| ComfyUI w innym folderze | `$env:COMFY_DIR="D:\sciezka\ComfyUI_windows_portable"; $env:CLOUDFLARED="D:\sciezka\cloudflared.exe"; npm run wideo` |
| Błąd CUDA / karta niewidoczna | Zaktualizuj sterownik NVIDIA; ComfyUI portable używa CUDA 13. |

---

## Gdzie co jest w kodzie

- `app/` strony (Next.js 16, App Router), `components/` komponenty UI, `components/model3d/` scena 3D (three.js).
- `lib/plan/autoLayout.ts` rzut mieszkania z metrażu pokoi.
- `lib/video/` nagrywanie filmów w przeglądarce, `lib/depth/` głębia ze zdjęcia, `lib/aiVideo/` połączenie z serwerem Film AI.
- `video-worker/` serwer Film AI (Node) + przepis ComfyUI + nasz węzeł `comfy_nodes`.
- `docs/` opis produktu (PRD), plan prac (ROADMAP), rynek, scenariusz pokazu.
- Zasady pracy z projektem dla AI: `CLAUDE.md`.
