(function () {
    'use strict';

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ============== Build net-anim SVGs ============== */
    // Per-dot motion vectors (direction + period). 6 directions so neighbours
    // tend to move oppositely → the network feels alive.
    const DIRECTIONS = [
        { x:  1.0, y:  0.75, period: 6 },
        { x: -1.0, y: -0.75, period: 6 },
        { x:  0.9, y: -0.9,  period: 7 },
        { x: -0.9, y:  0.9,  period: 7 },
        { x:  0.0, y:  1.1,  period: 5 },
        { x:  0.0, y: -1.1,  period: 5 },
    ];

    let netCounter = 0;
    const netInstances = [];

    function buildNetAnim(svgEl) {
        if (!svgEl) return;
        const netId = netCounter++;
        // Read viewBox (some nets are 1066×627 instead of 1114×627)
        const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
        const w = (vb && vb.width)  || 1114;
        const h = (vb && vb.height) || 627;
        const cx = w / 2, cy = h / 2;
        // Rectangular distance metric (Chebyshev on normalized axes).
        // 0 at center, 1 at any edge of the rectangle — contours are rectangles.
        const rectT = (x, y) => {
            const xT = Math.abs(x - cx) / cx;
            const yT = Math.abs(y - cy) / cy;
            return Math.min(Math.max(xT, yT), 1);
        };

        const nodes = [];
        const cols = 14, rows = 8;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const jitterX = (Math.random() - 0.5) * 30;
                const jitterY = (Math.random() - 0.5) * 30;
                const baseX = (w / (cols - 1)) * c + jitterX;
                const baseY = (h / (rows - 1)) * r + jitterY;
                const t = rectT(baseX, baseY);
                const distFromCenter = Math.hypot(baseX - cx, baseY - cy);
                let ampVal = 12 - 10.5 * t;
                if (distFromCenter <= 200) ampVal *= 3;
                const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
                nodes.push({
                    x: baseX,
                    y: baseY,
                    t,
                    radius: 8 - 7 * Math.sqrt(t),
                    opacity: 0.95 - 0.4 * t,
                    blurBin: Math.min(Math.round(Math.pow(t, 2.4) * 4), 4),
                    amp: ampVal,
                    dirX: dir.x,
                    dirY: dir.y,
                    period: dir.period,
                    phase: Math.random() * Math.PI * 2,
                });
            }
        }

        // Pre-compute which node pairs are connected (kept as index pairs so
        // lines can be re-rendered each frame using current node positions).
        const connections = [];
        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (d < 130) {
                    const tLine = rectT((a.x + b.x) / 2, (a.y + b.y) / 2);
                    const op = 0.65 - 0.6 * tLine;
                    connections.push({ i, j, op });
                }
            }
        }

        // Unique filter IDs per network (avoids id collisions across SVGs)
        const fId = (bin) => `netBlur${netId}_${bin}`;
        const defs = `<defs>
            <filter id="${fId(0)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0"/></filter>
            <filter id="${fId(1)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.5"/></filter>
            <filter id="${fId(2)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter>
            <filter id="${fId(3)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
            <filter id="${fId(4)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>`;

        const linesHtml = connections.map((c) => {
            const a = nodes[c.i], b = nodes[c.j];
            return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#FF1E1E" stroke-opacity="${c.op.toFixed(2)}" stroke-width="0.6"/>`;
        }).join('');

        const dotsHtml = nodes.map((n) => (
            `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.radius.toFixed(2)}" fill="#FF1E1E" opacity="${n.opacity.toFixed(2)}" filter="url(#${fId(n.blurBin)})"/>`
        )).join('');

        svgEl.innerHTML = defs + linesHtml + dotsHtml;

        if (prefersReduced) return;

        const circles = svgEl.querySelectorAll('circle');
        const lineEls = svgEl.querySelectorAll('line');
        const positions = new Float32Array(nodes.length * 2);

        // Pause animation when off-screen to save CPU (each net has ~112 nodes
        // and ~hundreds of lines; updating only visible ones keeps things smooth).
        let visible = false;
        const visObserver = new IntersectionObserver((entries) => {
            entries.forEach((e) => { visible = e.isIntersecting; });
        }, { rootMargin: '100px' });
        visObserver.observe(svgEl);

        netInstances.push({ nodes, connections, circles, lineEls, positions, isVisible: () => visible });
    }

    document.querySelectorAll('.net-anim').forEach(buildNetAnim);

    // Single shared rAF loop drives every visible network instance.
    if (!prefersReduced && netInstances.length) {
        function tickAll(timeMs) {
            const tSec = timeMs * 0.001;
            for (let n = 0; n < netInstances.length; n++) {
                const inst = netInstances[n];
                if (!inst.isVisible()) continue;
                const { nodes, connections, circles, lineEls, positions } = inst;
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    const phase = node.phase + (tSec * 2 * Math.PI / node.period);
                    const off = Math.sin(phase) * node.amp;
                    positions[i * 2]     = node.x + off * node.dirX;
                    positions[i * 2 + 1] = node.y + off * node.dirY;
                }
                for (let i = 0; i < circles.length; i++) {
                    circles[i].setAttribute('cx', positions[i * 2].toFixed(2));
                    circles[i].setAttribute('cy', positions[i * 2 + 1].toFixed(2));
                }
                for (let k = 0; k < lineEls.length; k++) {
                    const c = connections[k];
                    lineEls[k].setAttribute('x1', positions[c.i * 2].toFixed(2));
                    lineEls[k].setAttribute('y1', positions[c.i * 2 + 1].toFixed(2));
                    lineEls[k].setAttribute('x2', positions[c.j * 2].toFixed(2));
                    lineEls[k].setAttribute('y2', positions[c.j * 2 + 1].toFixed(2));
                }
            }
            requestAnimationFrame(tickAll);
        }
        requestAnimationFrame(tickAll);
    }

    /* ============== Counter animation ============== */
    function formatNumber(value, decimals, format) {
        if (decimals > 0) {
            return value.toFixed(decimals).replace('.', ',');
        }
        const rounded = Math.round(value);
        if (format === 'space') {
            return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        }
        return rounded.toString();
    }

    function animateCounter(el) {
        if (el.dataset.animated === '1') return;
        el.dataset.animated = '1';
        const target = parseFloat(el.dataset.target);
        const decimals = parseInt(el.dataset.decimals || '0', 10);
        const format = el.dataset.format || '';
        if (prefersReduced) {
            el.textContent = formatNumber(target, decimals, format);
            return;
        }
        const duration = 1600;
        const start = performance.now();
        function tick(now) {
            const elapsed = now - start;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = formatNumber(target * eased, decimals, format);
            if (t < 1) requestAnimationFrame(tick);
            else el.textContent = formatNumber(target, decimals, format);
        }
        requestAnimationFrame(tick);
    }

    /* ============== IntersectionObserver ============== */
    const ioOptions = { threshold: 0.4, rootMargin: '0px' };
    const isFigmaCapture = (location.hash || '').indexOf('figmacapture') !== -1;

    if (isFigmaCapture) {
        document.querySelectorAll('.animate-section').forEach((sec) => sec.classList.add('in-view'));
    } else {
        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    sectionObserver.unobserve(entry.target);
                }
            });
        }, ioOptions);
        document.querySelectorAll('.animate-section').forEach((sec) => {
            sectionObserver.observe(sec);
        });
    }

    // Numbers
    const numbersSection = document.getElementById('numbers');
    if (numbersSection) {
        if (isFigmaCapture) {
            numbersSection.querySelectorAll('.counter').forEach(animateCounter);
        } else {
            const numbersObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.querySelectorAll('.counter').forEach(animateCounter);
                        numbersObserver.unobserve(entry.target);
                    }
                });
            }, ioOptions);
            numbersObserver.observe(numbersSection);
        }
    }

    /* ============== Users chart (2-column waffle, clickable legend, wiggle) ============== */
    (function usersChart() {
        const peopleEl = document.getElementById('usersChartPeople');
        const subtabsEl = document.getElementById('usersChartSubtabs');
        const displayEl = document.getElementById('usersChartDisplay');
        const absEl = document.getElementById('usersChartAbs');
        const tabs = document.querySelectorAll('.users-chart-tab');
        if (!peopleEl || !subtabsEl || !displayEl || !absEl || !tabs.length) return;

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

        const TOTAL = 100;
        const ICON_COUNT = 11;
        // Crowd-perspective rows: DOM order back → front so the front row (last in DOM)
        // naturally overlaps the rows behind it. Counts sum to TOTAL.
        const ROWS = [
            { count: 14, scale: 0.75,   variant: '-r4' },
            { count: 14, scale: 0.85,   variant: '-r4' },
            { count: 13, scale: 0.95,   variant: '-r4' },
            { count: 13, scale: 1.05,   variant: '-r4' },
            { count: 13, scale: 1.15,   variant: '-r4' },
            { count: 12, scale: 1.3125, variant: '-r3' },
            { count: 11, scale: 1.485,  variant: '-r2' },
            { count: 10, scale: 1.80,   variant: '' }
        ];
        const randIcon = () => String(Math.floor(Math.random() * ICON_COUNT) + 1).padStart(2, '0');
        peopleEl.innerHTML = ROWS.map((row) =>
            '<div class="users-chart-row" style="--row-scale:' + row.scale + '">' +
            Array.from({ length: row.count }, () => {
                const id = randIcon();
                return '<span class="user-icon" aria-hidden="true">' +
                    '<img class="user-icon-img user-icon-img--inactive" src="' + id + '-i.svg" alt="" draggable="false">' +
                    '<img class="user-icon-img user-icon-img--active" src="' + id + row.variant + '.svg" alt="" draggable="false">' +
                    '</span>';
            }).join('') +
            '</div>'
        ).join('');
        const icons = peopleEl.querySelectorAll('.user-icon');
        const activeLayers = peopleEl.querySelectorAll('.user-icon-img--active');

        const COUNTER_DURATION = 1600;
        const ICON_STAGGER = 10;
        let counterRaf = null;

        function animateNumber(el, target) {
            if (counterRaf) cancelAnimationFrame(counterRaf);
            if (prefersReduced) {
                el.textContent = String(target);
                return;
            }
            const from = parseFloat((el.textContent || '0').replace(',', '.')) || 0;
            const start = performance.now();
            function tick(now) {
                const t = Math.min((now - start) / COUNTER_DURATION, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                el.textContent = String(Math.round(from + (target - from) * eased));
                if (t < 1) {
                    counterRaf = requestAnimationFrame(tick);
                } else {
                    el.textContent = String(target);
                    counterRaf = null;
                }
            }
            counterRaf = requestAnimationFrame(tick);
        }

        let activeFilter = 'pohlavi';
        let activeIdx = 0;

        function adjustedCounts(groups) {
            const counts = groups.map((g) => g.value);
            const sum = counts.reduce((a, b) => a + b, 0);
            if (sum < TOTAL) {
                let maxIdx = 0;
                for (let i = 1; i < counts.length; i++) {
                    if (counts[i] > counts[maxIdx]) maxIdx = i;
                }
                counts[maxIdx] += (TOTAL - sum);
            }
            return counts;
        }

        function applyColors() {
            const groups = DATA[activeFilter];
            const ag = groups[activeIdx];
            const activeCount = ag ? ag.value : 0;
            const inactiveCount = TOTAL - activeCount;
            // icons[] is in DOM order: back row first → front row last.
            // Active fills the FRONT (highest indices); stagger animates front-to-back.
            let order = 0;
            for (let i = activeLayers.length - 1; i >= 0; i--) {
                if (i >= inactiveCount) {
                    activeLayers[i].style.transitionDelay = (order * ICON_STAGGER) + 'ms';
                    activeLayers[i].style.opacity = '1';
                    order++;
                } else {
                    activeLayers[i].style.transitionDelay = '0ms';
                    activeLayers[i].style.opacity = '0';
                }
            }
        }

        function renderSubtabs() {
            const groups = DATA[activeFilter];
            subtabsEl.innerHTML = groups.map((g, i) =>
                '<button class="users-chart-subtab' + (i === activeIdx ? ' active' : '') +
                '" data-idx="' + i + '" role="tab" aria-selected="' + (i === activeIdx) + '">' +
                g.label + '</button>'
            ).join('');
            subtabsEl.querySelectorAll('.users-chart-subtab').forEach((btn) => {
                btn.addEventListener('click', () => {
                    activeIdx = parseInt(btn.dataset.idx, 10);
                    renderSubtabs();
                    applyColors();
                    updateLeft();
                });
            });
        }

        function updateLeft() {
            const groups = DATA[activeFilter];
            const ag = groups[activeIdx];
            if (!ag) return;
            const counts = adjustedCounts(groups);
            if (!displayEl.querySelector('.users-chart-display-num')) {
                displayEl.innerHTML = '<span class="users-chart-display-num">0</span>' +
                    '<span class="users-chart-display-pct">%</span>';
            }
            const numEl = displayEl.querySelector('.users-chart-display-num');
            animateNumber(numEl, counts[activeIdx]);
            absEl.textContent = '≈ ' + ag.abs + ' uživatelů';
        }

        function applyFilter(filter) {
            activeFilter = filter;
            activeIdx = 0;
            applyColors();
            renderSubtabs();
            updateLeft();
        }

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                tabs.forEach((t) => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                applyFilter(tab.dataset.filter);
            });
        });

        applyFilter('pohlavi');
    })();

    /* ============== Tile badges + Show more ============== */
    const TILE_BADGE_ICON = '<svg class="tile-badge-icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="7" r="5"/><path d="M2 19C2 15.6863 4.68629 13 8 13H16C19.3137 13 22 15.6863 22 19V22H2V19Z"/></svg>';

    function fillTileBadge(badge) {
        const pct = Math.floor(Math.random() * 100 + 1);
        badge.innerHTML = TILE_BADGE_ICON + '<span class="tile-badge-num">' + pct + '</span><span class="tile-badge-pct">%</span>';
    }

    document.querySelectorAll('.tile-badge').forEach(fillTileBadge);

    (function tilesShowMore() {
        const grid = document.querySelector('.tiles-grid');
        const ctaWrap = document.querySelector('.tiles-cta');
        const btn = ctaWrap && ctaWrap.querySelector('.btn');
        if (!grid || !btn) return;

        const POOL = [
            { title: 'Rodiny s dětmi plánující letní dovolenou', text: 'Rodiny aktivně srovnávající nabídky cestovních kanceláří, ubytování a aktivity pro děti v ČR i v zahraničí.' },
            { title: 'Sportovci-amatéři nakupující výbavu', text: 'Lidé pravidelně sportující na rekreační úrovni, kteří investují do běžecké, cyklistické nebo fitness výbavy.' },
            { title: 'Foodies a gurmáni', text: 'Vášniví milovníci kvalitního jídla, kteří nakupují prémiové potraviny, navštěvují restaurace a vyhledávají recepty.' },
            { title: 'Hudební nadšenci a fanoušci koncertů', text: 'Sledují aktuální dění v hudbě, kupují vstupenky na živé akce a investují do audio techniky.' },
            { title: 'Filmoví fanoušci a uživatelé streamovacích služeb', text: 'Aktivně využívají VOD platformy, kupují kino vstupenky a sledují filmové novinky a recenze.' },
            { title: 'Fitness a wellness zájemci', text: 'Cvičí pravidelně, řeší zdravý životní styl, doplňky stravy a vyhledávají wellness procedury.' },
            { title: 'Technologičtí early adopteři', text: 'Sledují novinky v elektronice, nakupují prémiové gadgety hned po uvedení a testují nové aplikace.' },
            { title: 'Hráči videoher a fanoušci esportu', text: 'Pravidelně hrají AAA tituly, nakupují herní příslušenství a sledují esportové soutěže a streamy.' },
            { title: 'Investoři a uživatelé finančních produktů', text: 'Sledují kapitálové trhy, srovnávají investiční produkty a aktivně používají brokerské aplikace.' },
            { title: 'Studenti a čerství absolventi', text: 'Mladí lidé v rané kariéře, kteří hledají vzdělávací kurzy, knihy, praxe a první kariérní pozice.' },
            { title: 'Mladí profesionálové ve městech', text: 'Začínající kariéristé v urbánním prostředí, řešící bydlení, módu, gastro a aktivní volný čas.' },
            { title: 'Aktivní senioři v online prostoru', text: 'Uživatelé 60+ kteří aktivně nakupují online, sledují zprávy a využívají digitální služby a aplikace.' },
            { title: 'Majitelé domácích mazlíčků', text: 'Pečují o psy a kočky, pravidelně nakupují krmivo a hračky, navštěvují veterináře a hlídací služby.' },
            { title: 'Zahrádkáři a domácí pěstitelé', text: 'Věnují se zahradě, balkonovým bylinkám a domácímu pěstování ovoce, zeleniny i okrasných rostlin.' },
            { title: 'Móda a sezónní obnova šatníku', text: 'Pravidelně obnovují šatník, sledují sezónní trendy a kupují oblečení i obuv online i offline.' },
            { title: 'Krása, kosmetika a péče o pleť', text: 'Pečují o pleť a vlasy, vyhledávají recenze kosmetiky, navštěvují kadeřnické a kosmetické salony.' },
            { title: 'Knihy, e-knihy a online vzdělávání', text: 'Pravidelně čtou, navštěvují knihovny, kupují e-knihy a investují do online kurzů a samostudia.' },
            { title: 'Hobby a kutilové', text: 'Tráví víkendy v dílně nebo na zahradě, opravují, vyrábějí a nakupují nářadí, materiál i návody.' },
            { title: 'Zájemci o fotovoltaiku a úsporu energie', text: 'Zvažují solární panely pro domácnost, srovnávají dodavatele a sledují aktuální dotační programy.' },
            { title: 'Elektromobilita a zelené technologie', text: 'Zvažují přechod na EV, řeší ekologická řešení pro domácnost a sledují udržitelné značky a produkty.' },
            { title: 'Plánovači svateb a slavnostních akcí', text: 'Připravují svatbu nebo větší rodinnou oslavu — řeší catering, fotografa, dekoraci a pronájem místa.' },
            { title: 'Kávomilové a domácí baristé', text: 'Investují do kvalitní kávy a zařízení, sledují speciality scénu a hledají roastery a kavárny v okolí.' },
            { title: 'Cyklisté a městská mobilita', text: 'Pravidelně dojíždějí na kole nebo elektrokole, řeší bezpečnost a nakupují cyklovybavení a doplňky.' },
            { title: 'Zdraví, prevence a doplňky stravy', text: 'Aktivně řeší prevenci, vitamíny a probiotika, sledují trendy v nutričních produktech a wellness.' }
        ];

        const used = new Set();

        function pickTiles(n) {
            const available = [];
            for (let i = 0; i < POOL.length; i++) if (!used.has(i)) available.push(i);
            const picked = [];
            while (picked.length < n && available.length) {
                const r = Math.floor(Math.random() * available.length);
                const realIdx = available.splice(r, 1)[0];
                used.add(realIdx);
                picked.push(POOL[realIdx]);
            }
            return picked;
        }

        function renderTile(data, i) {
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'tile tile-new';
            a.style.animationDelay = (i * 60) + 'ms';
            a.innerHTML = '<span class="tile-badge"></span>' +
                '<h4 class="tile-title">' + data.title + '</h4>' +
                '<p class="tile-text">' + data.text + '</p>';
            return a;
        }

        let firstClick = true;
        btn.addEventListener('click', () => {
            const tiles = pickTiles(9);
            if (!tiles.length) {
                ctaWrap.style.display = 'none';
                return;
            }
            tiles.forEach((data, i) => {
                const el = renderTile(data, i);
                grid.appendChild(el);
                fillTileBadge(el.querySelector('.tile-badge'));
            });
            if (firstClick) {
                const labelNode = btn.firstChild;
                if (labelNode && labelNode.nodeType === 3) labelNode.textContent = 'Zobrazit další ';
                firstClick = false;
            }
            if (used.size >= POOL.length) {
                ctaWrap.style.display = 'none';
            }
        });
    })();

    /* ============== FAQ accordion ============== */
    document.querySelectorAll('.faq-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
            const expanded = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!expanded));
        });
    });

    /* ============== Blog carousel ============== */
    (function blogCarousel() {
        const carousel = document.getElementById('blogCarousel');
        if (!carousel) return;
        const track = carousel.querySelector('.carousel-track');
        const cards = track.querySelectorAll('.blog-card');
        const prev = document.getElementById('blogPrev');
        const next = document.getElementById('blogNext');
        const dotsBox = document.getElementById('blogDots');

        const visibleCount = () => {
            const w = window.innerWidth;
            if (w < 768) return 1;
            if (w < 1024) return 2;
            return 3;
        };

        let index = 0;
        const totalPages = () => Math.max(1, cards.length - visibleCount() + 1);

        function buildDots() {
            const pageGroups = Math.ceil(cards.length / visibleCount());
            dotsBox.innerHTML = '';
            for (let i = 0; i < pageGroups; i++) {
                const dot = document.createElement('div');
                dot.className = 'dot' + (i === 0 ? ' active' : '');
                dotsBox.appendChild(dot);
            }
        }

        function update() {
            const cardWidth = cards[0].getBoundingClientRect().width;
            const gap = 16;
            const offset = -(index * (cardWidth + gap));
            track.style.transform = `translateX(${offset}px)`;
            const groupSize = visibleCount();
            const activeDot = Math.floor(index / groupSize);
            dotsBox.querySelectorAll('.dot').forEach((d, i) => {
                d.classList.toggle('active', i === activeDot);
            });
        }

        prev.addEventListener('click', () => {
            index = Math.max(0, index - visibleCount());
            update();
        });
        next.addEventListener('click', () => {
            index = Math.min(totalPages() - 1, index + visibleCount());
            update();
        });

        let resizeT;
        window.addEventListener('resize', () => {
            clearTimeout(resizeT);
            resizeT = setTimeout(() => { buildDots(); index = 0; update(); }, 150);
        });

        buildDots();
        update();
    })();

})();
