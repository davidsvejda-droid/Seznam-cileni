# Konverzace — Seznam Cílení (pokračování)

**Datum:** 2026-04-30
**Repo:** /Users/davidsvejda/Desktop/c_Seznam-cileni
**Branch:** main

Navazuje na `konverzace-2026-04-28.md`. Tato session se týká kompletního přepsání sekce „Přehled uživatelů na Seznamu" do 2-sloupcového layoutu s kruhovým rozložením panáčků.

---

## 1. Velký rewrite — 2-column layout s klikatelnou legendou

**Zadání (1. pokus):** Nahradit chart komponentu novou strukturou:
- Levá polovina: velké %, abs počet, lorem ipsum text
- Pravá polovina: tabs (NOVÝ STYL: transparent bg + border, aktivní = červené pozadí), 100 panáčků v 10×10 mřížce s **náhodnou distribucí indexů per skupina** (ne sekvenčně), legenda klikatelná
- Postavičky s fixním random offsetem ±2-4 px, subtilní wiggle animace každé 3-5 s
- Data: pohlaví/věk/socio s celočíselnými %, abs počty (placeholder)
- Lorem ipsum odstavec za h2 jako placeholder

**Implementace 1:**
- Nový tabs styl s transparent background, border `rgba(255,255,255,0.2)`, aktivní `#FF1E1E`
- Phyllotaxis-like distribuce: Fisher-Yates shuffle indexů 0–99, pak slice po skupinách
- `adjustedCounts()` — zbytek do max skupiny (věk: 1+1+25+43+24=94 → 40–59 dostane +6 = 49)
- Wiggle: `setTimeout` rekurze, 1–2 ikony po 600ms
- Klikatelná legenda + tabs

---

## 2. Revert + 2. pokus

**„vrať původní vzhled, rozložení filtrů před touto změnou"** → vrátil 5×20 layout s 1600ms count-up animation, sequential stagger, tabs centered, subtabs vpravo

**Pak ale znovu:** „Nahraď [...] novou komponentou [...] **Neměň vzhled, styl ani layout přepínačů**"

→ Stejný 2-column layout, ale tabs zachované jak byly:
- `.users-chart-tabs-row` s primárními taby (vlevo)
- Body pod nimi: `.users-chart-left` (display + abs + text) + `.users-chart-right` (matrix + legend)
- Tabs styl: pill, dark bg, aktivní = bílé pozadí + červený text (původní)

---

## 3. Sekundární přepínač zpět nahoru

**Zadání:** Subtabs zpět do tabs-row, stejný styl jako primární.

- HTML: `<div class="users-chart-subtabs">` znovu v tabs-row
- CSS: subtabs styly stejné jako primary tabs (pill, white-active, red text)
- JS: `renderSubtabs()` synchronizovaný s legendou
- `margin-left: auto` na subtabs → vpravo

---

## 4. Odstranění duplicitní legendy

**Zadání:** Odstranit duplicitní přepínač pod gridem.

- HTML: `<div class="users-chart-legend">` odstraněn
- CSS: `.users-chart-legend*` styly smazány
- JS: `renderLegend()` odstraněna, `legendEl` reference vyčištěny

---

## 5. Drobné úpravy

- **Věk labely** — odstraněno slovo „let" ze všech 5 položek (17 a méně, 18–24, 25–39, 40–59, 60 a více)
- **Vrátit původní paletu** — Ženy `#FF1E1E`, Muži `#FF8888`, věk od `#FFE5E5` (17-) po `#FF1E1E` (60+), socio `#FF1E1E/#FF8888/#FFBBBB`

---

## 6. Highlight jen aktivní skupiny

**Zadání:** Barevně zobrazit jen ikony odpovídající vybrané hodnotě, zbytek = původní neaktivní.

- `applyColors()` upravená: `groupAssignment[i] === activeIdx` → barva, jinak `rgba(255, 187, 187, 0.1)`
- CSS výchozí `.user-icon` color zpět na neaktivní
- Klik na subtab volá `applyColors()` → grid se přebarví podle vybrané hodnoty
- Random distribuce zůstává (jen jiná podmnožina je viditelná podle aktivního výběru)

---

## 7. Ikona panáčka

- **Vrácen one1.svg** (vyšší, aspect 16/44) místo one.svg (square 1/1)
- **Zmenšení o 50 %** — `max-width` matrix z 360 → 220 px
- **Pak zvětšení o 25 %** — 220 → ... (po dalších úpravách kompenzováno)

---

## 8. Kruhové rozložení

**Zadání 1:** „uprav grid v grafu panáčků, aby byli spíš v kruhu"

- 1. pokus: `clip-path: circle(50% at 50% 50%)` na `.users-chart-people` + `aspect-ratio: 1/1` (square container) + `place-items: center`
- Ikony v rozích visually clipped

**Zadání 2:** „neořezávej panáčky maskou, ale vyskládej je v gridu tak, aby tvořili kruh"

- **Implementace:** 13×13 grid (169 buněk), v JS spočítat 100 buněk **nejblíž středu** (vzdálenost L²), seřadit a každé ikoně přiřadit konkrétní `grid-row` a `grid-column`
- Buňky v rozích mřížky zůstanou prázdné (whitespace) → 100 panáčků tvoří kruhový disk
- Žádné ořezávání, každá ikona = 1 % zachováno
- `clip-path` odstraněn

---

## 9. Velikosti ikon a rozteče

- **+25 %** — max-width 360 → 432 px (cell-height ~22 → ~28 px)
- **+40px padding-left** na `.users-chart-left` (číslo, %, abs, text odsazené)
- **+25 % znovu** — 432 → 522 px (cell-height ~28 → ~35 px)

---

## 10. Animace (finální)

**Zadání:** „uprav animaci vykreslování aktivních panáčku, aby se vykreslovali postupně, ale rychle a uprav animaci čísla s procentem, aby byla stejná jako u čísel pod hero sekcí"

**Ikony — sekvenční stagger:**
- `applyColors()` přiřadí aktivním ikonám `transitionDelay = order × 10 ms` v pořadí jak prochází gridem
- Pořadí ovlivněno jejich pozicí v `placedCells` — ikony nejblíž středu se rozsvítí první → radiální reveal
- Pro ~50 aktivních ikon = ~500 ms total

**Číslo — hero count-up:**
- Nová `animateNumber()` lokálně v IIFE
- Easing `1 - (1-t)³`, duration **1600 ms** (stejné jako hero)
- Animuje z aktuální hodnoty (ne z 0) → plynulé přechody mezi subtaby
- `cancelAnimationFrame` při překryvech
- `prefers-reduced-motion` fallback (set instantly)

---

## Finální datová struktura

```js
const DATA = {
    pohlavi: [
        { label: 'Ženy', value: 45, abs: '3,5 mil.', color: '#FF1E1E' },
        { label: 'Muži', value: 54, abs: '4,1 mil.', color: '#FF8888' }
    ],
    vek: [
        { label: '17 a méně', value: 1,  abs: '~10 tis.',  color: '#FFE5E5' },
        { label: '18–24',     value: 1,  abs: '~43 tis.',  color: '#FFBBBB' },
        { label: '25–39',     value: 25, abs: '~1,9 mil.', color: '#FF8888' },
        { label: '40–59',     value: 43, abs: '~3,3 mil.', color: '#FF5555' },
        { label: '60 a více', value: 24, abs: '~1,8 mil.', color: '#FF1E1E' }
    ],
    socio: [
        { label: 'Nižší',   value: 33, abs: '~2,5 mil.', color: '#FF1E1E' },
        { label: 'Střední', value: 44, abs: '~3,3 mil.', color: '#FF8888' },
        { label: 'Vyšší',   value: 23, abs: '~1,7 mil.', color: '#FFBBBB' }
    ]
};
```

---

## Finální layout

```
+------------------------------------------------------+
|  [Pohlaví][Věk][Socio]              [Subtabs vpravo]  |
|                                                       |
|  ┌─ Levá ─────────┐    ┌─ Pravá ────────────┐        |
|  | 45 %           |    |     ⬛⬛⬛⬛⬛           |        |
|  | ≈ 3,5 mil.     |    |   ⬛⬛⬛⬛⬛⬛⬛⬛           |        |
|  | uživatelů      |    |  ⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛          |        |
|  | (lorem text)   |    |   ⬛⬛⬛⬛⬛⬛⬛⬛           |        |
|  | padding-left:  |    |     ⬛⬛⬛⬛⬛           |        |
|  | 40px           |    |     (kruh z 100)    |        |
|  └────────────────┘    └─────────────────────┘        |
+------------------------------------------------------+
```

- **Levá polovina:** padding-left 40px, číslo 80px (count-up), % 28px, abs ~16px (color soft), text 14px (color soft)
- **Pravá polovina:** 13×13 grid s 100 nejstředovějšími buňkami obsazenými, max-width 522px, ikony aspect 16/44, height: 100% cell

---

## Klíčové funkce v JS

- `adjustedCounts(groups)` — sečte hodnoty, zbytek do max skupiny → součet 100
- `generateAssignment()` — Fisher-Yates shuffle indexů 0–99, postupně přiřadí groupům
- `applyColors()` — pro aktivní `activeIdx` skupinu zobrazí, ostatním inactive barvu, sequential stagger 10ms
- `renderSubtabs()` — pills podle DATA[activeFilter], aktivní = bílá-bg + red text
- `updateLeft()` — animateNumber pro num, abs textContent
- `applyFilter(filter)` — kompletní reset (assignment + colors + subtabs + display)
- `animateNumber(el, target)` — count-up 1600ms s easing, current → target
- `scheduleWiggle()` — random ikona ±4px translateY, 600ms, každé 3-5 s

---

## Pre-computed grid layout

```js
const GRID_SIZE = 13;
const gridCells = [];
for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
        const dx = c - (GRID_SIZE - 1) / 2;
        const dy = r - (GRID_SIZE - 1) / 2;
        gridCells.push({ r: r + 1, c: c + 1, dist: dx * dx + dy * dy });
    }
}
gridCells.sort((a, b) => a.dist - b.dist || (a.r - b.r) || (a.c - b.c));
const placedCells = gridCells.slice(0, TOTAL); // 100 closest
// Each icon assigned grid-row/column from placedCells[i]
```

---

## Poznámky / dluhy

- Capture script (`<script src="...mcp.figma.com..." async>`) v `<head>` — z předchozí Figma session, lze odstranit pro produkci
- `figmacapture` URL hash bypass logika v JS — neovlivňuje běžné uživatele
- Dead chart code (animateDonut, animateBars, buildPeopleIcons, atd.) v `script.js` zůstává nepoužitý
- Inactive icon color: `rgba(255, 187, 187, 0.1)` (FFBBBB @ 10 %)
- Wiggle používá CSS proměnné `--ox`/`--oy` per ikona pro fixní organic offset, kombinováno s keyframe `translate(-4px)` na 50%
