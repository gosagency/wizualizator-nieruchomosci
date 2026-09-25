# Serwer wideo (Film AI)

Zamienia zdjęcie pokoju w kilkusekundowy film z ruchem kamery. Działa na Twojej karcie graficznej, bez płatnych usług.

- Model: **Wan 2.2 TI2V-5B** (Alibaba, licencja Apache-2.0), wersja GGUF Q6_K (city96/ComfyUI-GGUF).
- Jakość: natywne 1280×704 (pion 704×1280), **pierwsza i ostatnia klatka przypięte do zdjęcia** (własny węzeł `comfy_nodes`: `Wan22FirstLastLatent` + `ZoomCrop`), więc film kończy się na prawdziwym pokoju i meble nie znikają. Płynność: RIFE v4.26 (MIT) ×2 → 24 kl./s.
- Model RIFE: `https://huggingface.co/Comfy-Org/frame_interpolation/resolve/main/frame_interpolation/rife_v4.26.safetensors` → `ComfyUI/models/frame_interpolation/`.
- Silnik: **ComfyUI** (GPL-3.0) w wersji przenośnej, `%USERPROFILE%\ComfyUI\ComfyUI_windows_portable`.
- Tunel: **cloudflared** (Apache-2.0), darmowy, bez konta. Adres zmienia się przy każdym starcie.

## Uruchomienie

```powershell
npm run wideo:publikuj
```

Uruchamia ComfyUI, serwer wideo i tunel, zapisuje adres tunelu w Vercel i wdraża stronę (ok. 2 min). Od tej chwili publiczny link https://wizualizator-nieruchomosci.vercel.app/wyprobuj ma aktywny „Film AI”. Zostaw okno otwarte; Ctrl+C wyłącza.

Bez `--publikuj` skrypt tylko wypisuje link z dopiskiem `?serwer=…` (bez wdrażania).

## Wydajność (RTX 5060 Laptop 8 GB)

| Klip | Czas |
|---|---|
| 1280×704, 49 klatek + RIFE → 4 s (domyślnie) | ok. 5 min |
| 832×480, 81 klatek (3,4 s, stary tryb) | ok. 200 s |

Zmiana długości: zmienne `FRAMES` i `STEPS` przed `npm run wideo`. Zamknięcie Chrome/Discorda/Steama zwalnia RAM i przyspiesza pierwsze wczytanie modelu.

## Bezpieczeństwo

- ComfyUI słucha tylko na 127.0.0.1; do internetu wystawiony jest wyłącznie `server.mjs`.
- Zadania przyjmowane tylko ze strony aplikacji (lista `ALLOWED_ORIGINS`), max 6 w kolejce, max 3 na osobę, zdjęcie do 8 MB.
