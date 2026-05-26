# Konverzace — Seznam Cílení landing page

**Datum:** 2026-04-28 / 2026-04-29 (pokračování)
**Repo:** /Users/davidsvejda/Desktop/c_Seznam-cileni
**Branch:** main

---

## Přehled session

Iterativní úpravy hotové landing page — hero CTA, segment tiles, blog karty s ilustracemi, sjednocení barevné palety karet, z-index hierarchie, kompletní přepsání sekce „Přehled uživatelů" na interaktivní waffle chart, sekundární filtr s velkým číslem, animace, layouty, výměna SVG ikony, export do Figmy.

Soubory měněné napříč session: `index.html`, `styles.css`, `script.js`.

---

## 1. Hero — primární tlačítko + outline sekundár

**Zadání:** Přidat primární CTA „Ukázat data" s kotvou na sekci grafů. „Více o cílení" převést na sekundární (1px border #FFF, bg #000, text #FFF).

**Změny:**
- `index.html` hero blok — wrapper `.hero-cta` se dvěma `<a>` tagy
- `styles.css` — nová třída `.btn-outline` (bg #000, border 1px #fff, color #fff), `.hero-cta` (flex, gap 12px), `scroll-padding-top: 72px` na html
- Sekce „Přehled uživatelů" má `id="charts"`, kotva `#charts` funguje rovnou

---

## 2. Segment tiles — odstranění přepínače + ikona panáčka

**Zadání:** Odstranit tabs Zájmy/Nákupní chování. Do `.tile-badge` přidat ikonu panáčka v bílé.

**Změny:**
- `index.html` — odstraněn `<div class="tabs">` blok
- `script.js` — odstraněn tabs handler, badge plněn SVG ikonou (clone of one.svg) v bílé + `% hodnota`
- `styles.css` — `.tile-badge` přepnuto na `inline-flex` s gap 6px

---

## 3. Blog karty — ilustrační obrázky 16:9

**Zadání:** Do každé blog karty přidat ilustrační obrázek nad nadpis v poměru 16:9.

**Iterace 1 — placeholder:** 6 karet, gradient placeholder per nth-child.

**Iterace 2 — konkrétní inline SVG ilustrace per titulek:**

| Karta | Titulek | Motiv |
|---|---|---|
| 1 | Czech ad ID / RTB | ID karta s QR vzorem + RTB spojnice |
| 2 | Raynet CRM / Boost.space | 2 válce databází + čárkované šipky |
| 3 | FedCM / přihlášení | Silueta uživatele s check badge + cursor |
| 4 | Sklik / cílení | Terč se šípem + segment dots |
| 5 | Trendy 2026 | Vzestupný area chart + label |
| 6 | Případová studie 40 % | 3 sloupce + šipka nahoru + +40% |

---

## 4. Sjednocení barvy karet

1. „Změň background blog karet na #393A40 40 %" → `rgba(57, 58, 64, 0.4)`
2. „Použij barvu pro všechny karty a boxy" → CSS proměnné `--color-card-bg` a `--color-card-bg-hover`, aplikováno na `.chart-card`, `.tile`, `.blog-card`, `.rozcestnik-tile`
3. „To samé pro background pod FAQ" → `.faq-list` na `var(--color-card-bg)`
4. „Karty mají být nad animovanými sítěmi" → solid `#393A40`, sítě neprosakují
5. „Změň barvu boxu na #3D2834 80 %" → `rgba(61, 40, 52, 0.8)`, hover `rgba(75, 50, 64, 0.85)`

---

## 5. Z-index hierarchie

**Zadání:** Animované sítě vždy pod ostatním obsahem.

- `.net-anim` → explicit `z-index: 0`
- Všechny karty (`.chart-card`, `.tile`, `.blog-card`, `.rozcestnik-tile`, `.faq-list`) → `position: relative; z-index: 1`
- `.container` má z-index 2

---

## 6. Interaktivní graf uživatelů — waffle chart (vývoj)

**Zadání původní:** Nahradit 3 původní grafy (donut/bars/people) jednou komponentou s přepínači a 100 postavičkami.

### 6.1. První verze — 100 ikon, 20×5

- HTML: `.users-chart` s `.users-chart-tabs` (Pohlaví/Věk/Socio), `.users-chart-people`, `.users-chart-legend`
- `distribute()` — largest remainder method (procentně přesné, zlomky se rozdělí skupinám s největším remainderem)
- IntersectionObserver na `#charts` (threshold 0.4) → po 200ms aplikuje default

### 6.2. Centrace + paleta barev

- `display: flex; flex-direction: column; align-items: center` na `.users-chart`
- Paleta: `#BF1616, #FF1E1E, #FF5555, #FF8888, #FFBBBB, #FFE5E5`
- Pohlaví: Ženy = `#FF1E1E`, Muži = `#FF8888`
- Věk (od 60+): `#FF1E1E, #FF5555, #FF8888, #FFBBBB, #FFE5E5`
- Socio: Nižší = `#FF1E1E`, Střední = `#FF8888`, Vyšší = `#FFBBBB`

### 6.3. Sekundární filtr + velké číslo

**Zadání:** Ke každému stavu primárního přepínače další kontextový přepínač (Ženy/Muži, věkové skupiny, socio třídy). Postavičky vykreslují jen aktivní skupinu, číslo+% velké vedle hlaviček (číslo H1 = 65px, % H3 = 18px).

- HTML: `<div class="users-chart-subtabs">` + `<div class="users-chart-display">`
- JS: state `activeFilter` + `activeSubIdx`, `renderSubtabs()` per filter
- `updateChart()` obarví jen `Math.round(value * 100/100)` ikon aktivní skupiny

### 6.4. 100 ikon, 10×10, číslo vlevo

- `Array(100)`, grid `repeat(10, 1fr)`, max-width 320px
- Display + matrix v `.users-chart-display-row` flex
- Číslo i % `#FFF`, % `font-weight: 400`

### 6.5. Hodnoty pod 1 % vždy 1 ikona, ikony −25 %

- JS: `ag.value > 0 && raw < 1 ? 1 : Math.round(raw)`
- max-width 240px (z 320), gap 4px

### 6.6. Neaktivní `#FFBBBB` 10 %

- `rgba(255, 187, 187, 0.1)` v JS i CSS výchozí

### 6.7. Sekundární přepínač = stejný styl jako primární

- subtabs: tmavé pill pozadí kontejneru, padding 10×20, weight 600, fs-sm, aktivní = bílé pozadí + červený text

### 6.8. Animace — sekvenční ikony + počítadlo jako hero

- `transitionDelay = i * 16ms` na aktivní ikony (stagger)
- `animateNumber()` reusing `formatNumber()` z hero, duration **1600 ms**, easing `1 - (1-t)³`, animuje plynule z aktuální hodnoty do nové, `cancelAnimationFrame` při překryvech

### 6.9. Horizontální gap 4px

- `gap: 4px 8px` (4 vertikálně, 8 horizontálně), max-width 260px

### 6.10. Right-align number aby grid neskákal

- `.users-chart-display`: `justify-content: flex-end`, `text-align: right`, `min-width: 220px`

### 6.11. Aktualizace one.svg → nová geometrie

- one.svg upraven externě: viewBox 0 0 24 24, circle cx=12 cy=7 r=5, nový path, fill #FF1E1E
- `personSvg` v JS i `TILE_BADGE_ICON` aktualizovány
- `.user-icon` aspect-ratio 1/1

### 6.12. Ikona +40 % v grafu

- max-width 260 → 335 (desktop) / 200 → 270 (mobile)

### 6.13. Tile-badge ikona +25 % (segment karty)

- 16px → 20px

---

## 7. Show more pool v segment tiles

**Zadání:** Po kliku „Zobrazit více" zobrazit dalších 9 karet s random contentem v kontextu cílení reklamy. Text tlačítka pak změnit na „Zobrazit další".

- Pool 24 segmentových karet (rodiny, foodies, fitness, kávomilové, cyklisté, e-mobilita, zahrádkáři, atd.)
- Klik přidá 9 random tiles (bez opakování), `.tile-new` fade-in animace, stagger 60ms per index
- Po 1. kliku text → „Zobrazit další"
- Pool exhausted → tlačítko skryto

---

## 8. Tile-badge styl evoluce

1. Original: malá ikona panáčka (12×14), red bg, 16px text
2. Iterace: bez bg, číslo 50px (jako hero number-value), % 24px, ikona 22px
3. „Odstraň ikonu, číslo červené #FF1E1E" — JS bez ikony, color FF1E1E
4. „Vrať ikonu před číslo" — 26px, currentColor (= červená)
5. „Zmenši o 50 %" — 13px
6. „Zvětši o 25 % + zarovnání na účaří" — 16px, `align-self: baseline`
7. „Aktualizuj one.svg geometrii" — nový SVG path
8. „Zvětši o 25 %" — 20px

---

## 9. Konverzace 2026-04-29

### 9.1. Export do Figmy

**Zadání:** Propojit s Figma file `Yi6BOdD2e54uHrKVBDMJ2i` (node 17101:108485) a importovat aktuální stav prototypu jako statickou stránku.

**Postup:**
- Spuštěn lokální server `python3 -m http.server 8765`
- `mcp__figma__generate_figma_design` s `outputMode: existingFile`, fileKey, nodeId
- Capture ID `83177e53-5e5f-4cc9-84e6-a455a22c0f87`
- Přidán `<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async>` do `<head>`
- Bypass IntersectionObserverů v `script.js` pro `figmacapture` URL hash (vše vykreslí staticky bez čekání na scroll)
- Otevřena URL s hash params, capture proběhl na první poll

**Výsledek:** https://www.figma.com/design/Yi6BOdD2e54uHrKVBDMJ2i?node-id=17123-946

**Trvalé změny:**
- Capture script v `index.html` — umožňuje znovu-zachycení přes toolbar
- Bypass v `script.js` — jen pro URL s `figmacapture`, neovlivňuje běžné uživatele

### 9.2. Nová ikona one1.svg, matice 5×20

**Zadání:**
- Nahradit one.svg za one1.svg v sekci Přehled uživatelů
- Matice 5 řádků × 20 sloupců
- Primární a sekundární filtr vedle sebe na řádek (responzivní stack)
- Číslo+% vycentrované nad maticí

**Změny:**
- `personSvg` v JS používá nový path z one1.svg (viewBox 0 0 16 44, hlava + tělo s pažemi)
- `.user-icon` aspect-ratio 16/44 (vyšší panáček)
- Grid 20 sloupců, max-width 540px (desktop) / 420px (mobile)
- HTML: nový wrapper `.users-chart-tabs-row` s `flex-wrap: wrap`
- Display + matrix odděleny, číslo nad maticí, oba centrované
- min-width na display odstraněn (číslo nad maticí, grid se nehýbe)

### 9.3. Věk — odstranit „let" z krajních hodnot, zarovnat vlevo

- „60 a více let" → „60 a více"
- „17 a méně let" → „17 a méně"
- `.users-chart-tabs-row` → `justify-content: flex-start`, `width: 100%`

### 9.4. Sekundární filtry vpravo

- `.users-chart-subtabs` → `margin-left: auto` — primární vlevo, sekundární vpravo

### 9.5. Větší mezery

- `.users-chart-tabs-row` margin-bottom: 32 → 48px
- `.users-chart` padding: 40px → 40px 40px 56px (spodní +16)

---

## CSS proměnné (finální stav)

```css
:root {
    --color-bg: #170A12;
    --color-surface: #1F1018;
    --color-surface-2: #2A1620;
    --color-red: #FF1E1E;
    /* ... */
    --color-card-bg: rgba(61, 40, 52, 0.8);
    --color-card-bg-hover: rgba(75, 50, 64, 0.85);
}
```

---

## Finální barvy waffle chart

**Pohlaví:**
- Ženy `#FF1E1E`
- Muži `#FF8888`

**Věk:**
- 60 a více `#FF1E1E`
- 40–59 let `#FF5555`
- 25–39 let `#FF8888`
- 18–24 let `#FFBBBB`
- 17 a méně `#FFE5E5`

**Socioekonomická klasifikace:**
- Nižší `#FF1E1E`
- Střední `#FF8888`
- Vyšší `#FFBBBB`

Neaktivní ikony: `rgba(255, 187, 187, 0.1)` (#FFBBBB @ 10 %)

---

## Layout chart card (final)

```
+-----------------------------------------------+
|  [Pohlaví][Věk][Socio]    [Ženy][Muži]         |  ← tabs row (left + right)
|                                                |
|              45,54 %                           |  ← display (centered)
|                                                |
|     [matrix 5×20 × 100 panáčků]                |  ← waffle grid
|                                                |
+-----------------------------------------------+
```

---

## Dead code (neuklízeno)

V `script.js` zůstávají nepoužité funkce: `animateDonut()`, `animateBars()`, `buildPeopleIcons()`, `revealPeopleIcons()`, `chartObserver` (selektor `.chart-card` nic nevybere). V `styles.css` ~220 řádků původních chart stylů — neškodí, ale lze vyčistit.

Capture script (Figma html-to-design) v `<head>` — pro produkci možno odstranit.

---

## Poznámky

- Číslo+% v displayi má `color: #FFF` (regular weight na %)
- Animace `animateNumber()` startuje vždy z aktuální hodnoty (ne z 0) — plynulé přechody mezi sub-taby
- Bypass IntersectionObserverů: pouze když URL hash obsahuje `figmacapture`
- one1.svg je vyšší/štíhlejší panáček (16×44), zatímco one.svg má proporce 24×24 (čtvercový)
- Tile-badge stále používá one.svg (čtvercový, 20×20px), waffle chart používá one1.svg (16×44)
