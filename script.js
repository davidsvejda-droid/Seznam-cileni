(function () {
    'use strict';

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ============== Person icon ============== */
    const PERSON_SVG = `<img src="one.svg" alt="" width="20" height="24">`;

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

    /* ============== Donut animation ============== */
    function animateDonut(card) {
        const arc = card.querySelector('.donut-arc');
        if (!arc || arc.dataset.animated === '1') return;
        arc.dataset.animated = '1';
        const finalOffset = parseFloat(arc.dataset.finalOffset || '0');
        const woman = card.querySelector('.donut-icon-woman');
        const man = card.querySelector('.donut-icon-man');
        const legendItems = card.querySelectorAll('.legend-item');
        const womanLegend = legendItems[0];
        const manLegend = legendItems[1];

        if (prefersReduced) {
            arc.style.strokeDashoffset = finalOffset;
            [woman, womanLegend, man, manLegend].forEach((el) => el && el.classList.add('show'));
            return;
        }
        requestAnimationFrame(() => {
            arc.style.strokeDashoffset = finalOffset;
        });
        // After donut finishes drawing (~1.4s), reveal woman, then man +0.3s
        setTimeout(() => {
            if (woman) woman.classList.add('show');
            if (womanLegend) womanLegend.classList.add('show');
            setTimeout(() => {
                if (man) man.classList.add('show');
                if (manLegend) manLegend.classList.add('show');
            }, 300);
        }, 1400);
    }

    /* ============== Bars animation ============== */
    function animateBars(card) {
        card.querySelectorAll('.bar-wrap').forEach((wrap, i) => {
            const bar = wrap.querySelector('.bar');
            const label = wrap.querySelector('.bar-label');
            if (!bar || bar.dataset.animated === '1') return;
            bar.dataset.animated = '1';
            const h = parseInt(bar.dataset.height, 10);
            if (prefersReduced) {
                bar.style.height = h + 'px';
                bar.classList.add('animated');
                if (label) label.classList.add('show');
                return;
            }
            setTimeout(() => {
                bar.style.height = h + 'px';
                if (label) label.classList.add('show');
                setTimeout(() => bar.classList.add('animated'), 600);
            }, i * 300);
        });
    }

    /* ============== People icons ============== */
    function buildPeopleIcons(card) {
        card.querySelectorAll('.people-col').forEach((col) => {
            const iconsBox = col.querySelector('.people-icons');
            if (!iconsBox || iconsBox.dataset.built === '1') return;
            iconsBox.dataset.built = '1';
            const total = parseInt(col.dataset.icons, 10);
            const cols = parseInt(col.dataset.cols, 10);
            const rows = parseInt(iconsBox.dataset.rows || '0', 10);
            const extra = parseInt(iconsBox.dataset.extra || '0', 10);
            // Build pyramid: bottom rows are full (cols), top row is `extra` icons centered.
            // people-icons uses column-reverse, so rendering order builds from bottom up.
            const rowsHtml = [];
            for (let r = 0; r < rows; r++) {
                let rowHtml = '<div class="people-row">';
                for (let c = 0; c < cols; c++) {
                    rowHtml += `<div class="person-icon">${PERSON_SVG}</div>`;
                }
                rowHtml += '</div>';
                rowsHtml.push(rowHtml);
            }
            if (extra > 0) {
                let rowHtml = '<div class="people-row">';
                for (let c = 0; c < extra; c++) {
                    rowHtml += `<div class="person-icon">${PERSON_SVG}</div>`;
                }
                rowHtml += '</div>';
                rowsHtml.push(rowHtml);
            }
            // Single icon for tiny cols
            if (rows === 0 && extra === 0 && total === 1) {
                iconsBox.innerHTML = `<div class="person-icon">${PERSON_SVG}</div>`;
                return;
            }
            iconsBox.innerHTML = rowsHtml.join('');
        });
    }

    function revealPeopleIcons(card) {
        if (card.dataset.peopleRevealed === '1') return;
        card.dataset.peopleRevealed = '1';
        const icons = card.querySelectorAll('.person-icon');
        if (prefersReduced) {
            icons.forEach((i) => i.classList.add('visible'));
            return;
        }
        icons.forEach((icon, i) => {
            setTimeout(() => icon.classList.add('visible'), i * 18);
        });
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

    // Charts
    const chartCards = document.querySelectorAll('.chart-card');
    const chartObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const card = entry.target;
                card.classList.add('in-view');
                if (card.classList.contains('chart-donut-card')) {
                    setTimeout(() => animateDonut(card), 400);
                }
                if (card.classList.contains('chart-bars-card')) {
                    setTimeout(() => animateBars(card), 300);
                }
                if (card.classList.contains('chart-people-card')) {
                    buildPeopleIcons(card);
                    setTimeout(() => revealPeopleIcons(card), 300);
                }
                chartObserver.unobserve(card);
            }
        });
    }, ioOptions);
    chartCards.forEach((card) => chartObserver.observe(card));

    // Pre-build people icons in case the section is already in view (no intersection trigger)
    document.querySelectorAll('.chart-people-card').forEach(buildPeopleIcons);

    /* ============== Users chart (interactive 1000-person waffle) ============== */
    (function usersChart() {
        const peopleEl = document.getElementById('usersChartPeople');
        const subtabsEl = document.getElementById('usersChartSubtabs');
        const displayEl = document.getElementById('usersChartDisplay');
        const tabs = document.querySelectorAll('.users-chart-tab');
        if (!peopleEl || !subtabsEl || !displayEl || !tabs.length) return;

        const DATA = {
            pohlavi: [
                { label: 'Ženy', value: 45.54, color: '#FF1E1E' },
                { label: 'Muži', value: 54.45, color: '#FF8888' }
            ],
            vek: [
                { label: '60 a více', value: 24.34, color: '#FF1E1E' },
                { label: '40–59 let', value: 43.23, color: '#FF5555' },
                { label: '25–39 let', value: 25.43, color: '#FF8888' },
                { label: '18–24 let', value: 0.56, color: '#FFBBBB' },
                { label: '17 a méně', value: 0.13, color: '#FFE5E5' }
            ],
            socio: [
                { label: 'Nižší', value: 33, color: '#FF1E1E' },
                { label: 'Střední', value: 44, color: '#FF8888' },
                { label: 'Vyšší', value: 23, color: '#FFBBBB' }
            ]
        };

        const personSvg = '<svg class="user-icon" viewBox="0 0 16 44" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13.4286 10.9389H2.57176C1.15147 10.9389 0 12.0704 0 13.466L0 24.3233C0 25.7612 1.18609 26.9267 2.64936 26.9267H3.40168V40.0284C3.40168 41.007 4.20892 41.8 5.2046 41.8H10.7954C11.7911 41.8 12.5983 41.0068 12.5983 40.0284V26.9267H13.3506C14.8139 26.9267 16 25.7612 16 24.3233V13.466C16.0002 12.0702 14.8489 10.9389 13.4286 10.9389Z"/><path d="M8.00065 9.1194C10.5634 9.1194 12.641 7.07795 12.641 4.5597C12.641 2.04145 10.5634 0 8.00065 0C5.43789 0 3.36035 2.04145 3.36035 4.5597C3.36035 7.07795 5.43789 9.1194 8.00065 9.1194Z"/></svg>';
        peopleEl.innerHTML = Array(100).fill(personSvg).join('');
        const icons = peopleEl.querySelectorAll('.user-icon');

        const COUNTER_DURATION = 1600;
        const ICON_STAGGER = 16;
        let counterRaf = null;

        function animateNumber(el, target, decimals) {
            if (counterRaf) cancelAnimationFrame(counterRaf);
            if (prefersReduced) {
                el.textContent = formatNumber(target, decimals, '');
                return;
            }
            const from = parseFloat((el.textContent || '0').replace(',', '.')) || 0;
            const start = performance.now();
            function tick(now) {
                const t = Math.min((now - start) / COUNTER_DURATION, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                el.textContent = formatNumber(from + (target - from) * eased, decimals, '');
                if (t < 1) {
                    counterRaf = requestAnimationFrame(tick);
                } else {
                    el.textContent = formatNumber(target, decimals, '');
                    counterRaf = null;
                }
            }
            counterRaf = requestAnimationFrame(tick);
        }

        let activeFilter = 'pohlavi';
        let activeSubIdx = 0;

        function renderSubtabs() {
            const groups = DATA[activeFilter];
            subtabsEl.innerHTML = groups.map((g, i) =>
                '<button class="users-chart-subtab' + (i === activeSubIdx ? ' active' : '') +
                '" data-idx="' + i + '" role="tab" aria-selected="' + (i === activeSubIdx) + '">' +
                g.label + '</button>'
            ).join('');
            subtabsEl.querySelectorAll('.users-chart-subtab').forEach((btn) => {
                btn.addEventListener('click', () => {
                    activeSubIdx = parseInt(btn.dataset.idx, 10);
                    renderSubtabs();
                    updateChart();
                });
            });
        }

        function updateChart() {
            const groups = DATA[activeFilter];
            const ag = groups[activeSubIdx];
            if (!ag) return;
            const total = icons.length;
            const raw = (ag.value * total) / 100;
            const count = ag.value > 0 && raw < 1 ? 1 : Math.round(raw);
            let i = 0;
            for (; i < count && i < total; i++) {
                icons[i].style.transitionDelay = (i * ICON_STAGGER) + 'ms';
                icons[i].style.color = ag.color;
            }
            for (; i < total; i++) {
                icons[i].style.transitionDelay = '0ms';
                icons[i].style.color = 'rgba(255, 187, 187, 0.1)';
            }
            if (!displayEl.querySelector('.users-chart-display-num')) {
                displayEl.innerHTML = '<span class="users-chart-display-num">0</span>' +
                    '<span class="users-chart-display-pct">%</span>';
            }
            const numEl = displayEl.querySelector('.users-chart-display-num');
            const decimals = (ag.value % 1 !== 0) ? 2 : 0;
            animateNumber(numEl, ag.value, decimals);
        }

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                tabs.forEach((t) => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                activeFilter = tab.dataset.filter;
                activeSubIdx = 0;
                renderSubtabs();
                updateChart();
            });
        });

        renderSubtabs();

        const chartsSection = document.getElementById('charts');
        const captureMode = (location.hash || '').indexOf('figmacapture') !== -1;
        if (chartsSection && 'IntersectionObserver' in window && !prefersReduced && !captureMode) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setTimeout(updateChart, 200);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.4 });
            observer.observe(chartsSection);
        } else {
            updateChart();
        }
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
