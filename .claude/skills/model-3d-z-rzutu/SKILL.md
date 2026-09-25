---
name: model-3d-z-rzutu
description: Interaktywny model 3D mieszkania w przeglądarce (three.js) z rzutu i metrażu pokoi. Użyj, gdy trzeba zrobić „domek dla lalek”, wirtualny spacer, model 3D oferty albo moduł 3D w aplikacji.
---

# Model 3D mieszkania z rzutu (three.js)

Wynik: strona, na której klient obraca mieszkanie, klika pokój (nazwa + m²), przełącza umeblowanie / stan deweloperski, przekrój ścian i porę dnia.
Wzorzec: demo „Podgórze 58 w 3D” (25.09.2026). Dobre praktyki three.js z `CloudAI-X/threejs-skills` (fundamentals, geometry, lighting, textures, interaction).

## 1. Dane z rzutu → JSON

Zanim napiszesz kod, spisz mieszkanie w metrach. Oś X = wschód, Z = południe, (0,0) = narożnik NW.

```js
const ROOMS = [ // prostokąty [x0,x1,z0,z1]; pokój w kształcie L = kilka prostokątów
  {id:'salon', name:'Salon z aneksem', area:'20,8', c:[2.6,2.0], rects:[[0,5.2,0,4.0]], floor:'oak', f:['Wyjście na balkon']},
  {id:'bal', name:'Balkon', area:'3,1', c:[-0.65,2.0], rects:[[-1.3,0,0.8,3.2]], floor:'deck', extra:true}
];
const WALLS = [ // ax:'x' ściana wzdłuż X na z=c; ax:'z' wzdłuż Z na x=c; t: 0.2 zewn., 0.1 wewn.
  {ax:'x', c:0, a:-0.1, b:9.3, t:.2, op:[{a:3.4,b:4.6,y0:1.05,y1:2.3,g:1}]},    // okno (g=szkło)
  {ax:'x', c:6.3, a:-0.1, b:9.3, t:.2, op:[{a:4.6,b:5.5,y0:0,y1:2.1,door:1}]},  // drzwi wejściowe
  {ax:'z', c:3.6, a:4.05, b:6.2, t:.1, op:[{a:4.3,b:5.1,y0:0,y1:2.05}]}         // przejście
];
```

Kontrola przed renderem: suma `area` pokoi (bez balkonu) = metraż z oferty (±0,5 m²); każde okno ma stronę świata zgodną z briefem; drzwi łączą pokoje logicznie. Brak wymiarów → zapytaj albo oznacz model jako orientacyjny.

## 2. Budowa sceny

**Wersja artefakt / pojedynczy HTML:** skrypty UMD `cdnjs …/three.js/r128/three.min.js` + `cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js` (examples/js usunięto od r150+).
**Wersja aplikacji:** `npm i three`, moduły ES (r160+), `import { OrbitControls } from 'three/addons/controls/OrbitControls.js'`, `renderer.outputColorSpace = THREE.SRGBColorSpace`, tekstury kolorów `tex.colorSpace = THREE.SRGBColorSpace`. W React → React Three Fiber + drei.

Ściany z otworami — dziel odcinek na pełne bloki, nadproża i parapety:

```js
function buildWalls(H){ // H=2.7 pełne, 1.0 przekrój
  WALLS.forEach(w=>{ let cur=w.a;
    w.op.slice().sort((p,q)=>p.a-q.a).forEach(o=>{
      wallBox(w,cur,o.a,0,H);                                  // pełna ściana do otworu
      if(o.y0>0) wallBox(w,o.a,o.b,0,Math.min(o.y0,H));        // parapet
      if(o.y1<H) wallBox(w,o.a,o.b,o.y1,H);                    // nadproże
      if(o.g) glassPane(w,o.a,o.b,o.y0,Math.min(o.y1,H));      // szyba, depthWrite:false
      cur=o.b; });
    wallBox(w,cur,w.b,0,H); });
}
```

- Materiał ściany jako tablica 6 materiałów: indeks 2 (góra boxa) ciemny → czytelny przekrój architektoniczny.
- Podłogi: `PlaneGeometry` obrócona `-PI/2`, UV liczone ze współrzędnych świata (`u = x/2, v = z/2`) + jedna tekstura `RepeatWrapping` — deski nie rozjeżdżają się między pokojami, bez klonowania tekstur.
- Tekstury proceduralne z `<canvas>` (deski, płytki) — zero plików zewnętrznych.
- Meble: prosta bryła z boxów/cylindrów w grupie `furn` (przełącznik „Stan deweloperski” = `furn.visible=false`). W aplikacji możesz podmienić na modele GLB (GLTFLoader + Draco) albo GLB z Higgsfield `generate_3d` ze zdjęcia mebla.

## 3. Światło

- `HemisphereLight` (0.6) + `DirectionalLight` jako słońce z cieniami (`mapSize 2048`, kamera cienia ±10 m, `bias -0.0004`) + słaby `AmbientLight`.
- Słońce ustaw zgodnie ze stroną świata z briefu (np. balkon na zachód → wieczorne słońce z -X, nisko, `0xff9a52`).
- Tryb „Wieczór”: słońce niskie i ciepłe, hemi 0.2, `PointLight` 0.55 w każdym pokoju, abażury `emissiveIntensity 0.9`, tło sceny ciemniejsze.
- `setPixelRatio(Math.min(devicePixelRatio,2))` — telefony.

## 4. Interakcja

- `OrbitControls`: `enableDamping`, `maxPolarAngle ≈ PI/2.15` (bez zaglądania pod podłogę), `minDistance 3`, `maxDistance 32`.
- Etykiety pokoi jako elementy HTML nad canvasem: co klatkę `v.set(cx,0.3,cz).project(camera)` → `left/top` w px; ukryj, gdy `v.z>1`.
- Klik w pokój (etykieta lub lista) → animacja kamery 900 ms (lerp pozycji i `controls.target`, easeInOut), podświetlenie podłogi przez `emissive`, panel z cechami pokoju.
- Widoki: „Cały lokal” (ukośnie z góry) i „Rzut z góry” (kamera pionowo, `z+0.01`, żeby uniknąć blokady gimbala).
- `prefers-reduced-motion` → skok kamery bez animacji. `ResizeObserver` na kontenerze.

## 5. Oznaczenia i uczciwość

Stały napis „Wizualizacja poglądowa” w rogu, dopisek „Umeblowanie nie jest częścią oferty. Wymiary orientacyjne.” Cena i zł/m² liczone z danych oferty, nie wymyślane.

## 6. Sprawdzenie przed wysłaniem

Jedno spojrzenie na wynik (zrzut lub podgląd): ściany domknięte w narożnikach, okna po właściwych stronach, etykiety nie nachodzą na siebie, działa na szerokości telefonu. Potem publikuj — bez pętli poprawek „na zapas”.
