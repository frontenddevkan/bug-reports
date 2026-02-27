// При каждой полной загрузке страницы гарантированно скроллим к самому верху,
// чтобы пользователь всегда оказывался в шапке и у роадмапа, а не где-то посередине.
window.history.scrollRestoration = 'manual';
window.addEventListener('load', () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' || 'auto' });
});

/**
 * УРОК: JavaScript — язык программирования для браузера
 * Он "оживляет" страницу: реагирует на клики, меняет контент, открывает окна.
 *
 * Что мы делаем:
 * 1. Находим кнопку и модальное окно по их id
 * 2. Вешаем "слушатель" на клик по кнопке
 * 3. При клике — показываем модальное окно
 * 4. При клике на крестик — скрываем
 * 5. В отдельной области показываем текстовый лог действий ("сереньким текстом")
 */

// document.getElementById — находит элемент по id
// Это как сказать браузеру: \"Дай мне элемент с id='createBugReportBtn'\"
const createBugReportBtn = document.getElementById('createBugReportBtn');
const bugReportModal = document.getElementById('bugReportModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const bugReportForm = document.getElementById('bugReportForm');
const bugReportsList = document.getElementById('bugReportsList');
const cancelFormBtn = document.getElementById('cancelFormBtn');
const makeScreenshotBtn = document.getElementById('makeScreenshotBtn');

// Локальное хранилище багрепортов (память + localStorage)
let bugReports = [];
let bugArtifacts = []; // простая коллекция артефактов (скриншоты) в текущей сессии
async function captureScreenshot() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Ваш браузер не поддерживает захват экрана (getDisplayMedia). Попробуйте в актуальной версии Chrome/Edge.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();

        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');

        bugArtifacts.push({
            type: 'screenshot',
            createdAt: new Date().toISOString(),
            dataUrl,
        });

        // Добавляем пометку в поле "Фактический результат", чтобы видно было, что скриншот привязан к описанию
        const actualField = document.getElementById('actual');
        if (actualField) {
            const stamp = new Date().toLocaleString();
            const prefix = actualField.value && !actualField.value.endsWith('\n') ? '\n' : '';
            actualField.value += `${prefix}[Скриншот от ${stamp} сохранён как артефакт сессии]`;
        }

        track.stop();
        alert('Скриншот сохранён как артефакт текущей сессии (позже выведем отдельный блок со списком).');
    } catch (err) {
        console.error('Ошибка при захвате экрана', err);
        alert('Не удалось сделать скриншот: ' + err.message);
    }
}

if (makeScreenshotBtn) {
    makeScreenshotBtn.addEventListener('click', () => {
        captureScreenshot();
    });
}

// Базовые чек‑листы (можно расширять)
const CHECKLISTS = {
    'web-smoke': {
        id: 'web-smoke',
        title: 'Web: Smoke‑чек‑лист',
        items: [
            'Страница открывается без ошибок HTTP (статусы 2xx/3xx, нет 4xx/5xx).',
            'Основные элементы интерфейса отображаются (шапка, меню, контент).',
            'Ключевые кнопки и ссылки кликабельны и ведут на ожидаемые страницы.',
            'Форма (если есть) отправляется без критических ошибок валидации/скриптов.',
            'После базовых действий нет явных ошибок в консоли браузера.'
        ]
    }
};

/**
 * Фоновая анимация "ток по сетке" (canvas)
 * - Линии сетки рисуются CSS (тонкие 0.1px)
 * - Здесь рисуем "узелки тока" (1px точки), бегущие по линиям
 * - Движение: вертикали сверху вниз за 6 секунд, горизонтали слева направо за 6 секунд
 * - Сдвиг (задержка) по линиям: 1-я линия 0s, 2-я 4s, 3-я 8s, 4-я 12s (и дальше по порядку)
 * - Вспышка: каждые 4 секунды точка становится максимально белой + усиливается бело‑синий ореол,
 *   и за 1 секунду возвращается к умеренной яркости
 */
function initBgChargeCanvas() {
    const canvas = document.getElementById('bgChargeCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Сетка и "ток" рисуются canvas'ом (для неравномерности, двойных линий и укороченных линий)
    const FLASH_PERIOD = 8.0; // каждые 8 секунд вспышка у каждого кружка
    const TRAVEL_PERIOD = 11.0; // замедляем ещё на ~4 секунды

    // Сетка мельче примерно в 2 раза; ещё немного увеличиваем шаги примерно на +4px
    // (было [10,10,12,10,8,10,12,10] -> стало [14,14,16,14,12,14,16,14])
    const SPACING_PATTERN = [14, 14, 16, 14, 12, 14, 16, 14];
    const LINE_THICKNESS = 0.7; // на 0.5px толще (0.2px -> 0.7px)
    const EXTRA_TRANSPARENCY = 0.0; // делаем линии на ~4% ярче (меньше прозрачности)

    // Offscreen слой со статической сеткой
    const gridLayer = document.createElement('canvas');
    const gridCtx = gridLayer.getContext('2d');
    if (!gridCtx) return;

    let viewportW = 0;
    let viewportH = 0;
    let vLines = [];
    let hLines = [];

    function makeGradient(isVertical, x, y, len, boost = 1) {
        const g = isVertical
            ? gridCtx.createLinearGradient(x, y, x, y + len)
            : gridCtx.createLinearGradient(x, y, x + len, y);
        // слабый белый -> полупрозрачный голубой -> глубокий синий
        const a0 = Math.max(0, 0.05 - EXTRA_TRANSPARENCY);
        const a1 = Math.max(0, 0.1 - EXTRA_TRANSPARENCY);
        const a2 = Math.max(0, 0.16 - EXTRA_TRANSPARENCY);
        g.addColorStop(0, `rgba(248,250,252,${Math.min(1, a0 * boost)})`);
        g.addColorStop(0.5, `rgba(56,189,248,${Math.min(1, a1 * boost)})`);
        g.addColorStop(1, `rgba(30,58,138,${Math.min(1, a2 * boost)})`);
        return g;
    }

    function buildLines(max, isVertical) {
        const lines = [];
        let pos = 0;
        let idx = 0;
        while (pos <= max + 1) {
            const spacing = SPACING_PATTERN[idx % SPACING_PATTERN.length];
            const half = idx % 4 === 3; // каждая 4-я линия — только 50%
            const doubled = idx % 3 === 2; // каждая 3-я линия двоится
            lines.push({ idx, pos, half, doubled });
            pos += spacing;
            idx++;
        }
        return lines;
    }

    function redrawGrid() {
        gridCtx.clearRect(0, 0, viewportW, viewportH);
        gridCtx.lineCap = 'butt';
        gridCtx.lineJoin = 'miter';
        gridCtx.lineWidth = LINE_THICKNESS;

        // вертикали
        vLines.forEach((l) => {
            const len = l.half ? viewportH * 0.5 : viewportH;
            const vBoost = (l.idx + 1) % 8 === 0 ? 1.35 : 1; // каждую 8-ю вертикаль делаем чуть белее
            gridCtx.strokeStyle = makeGradient(true, l.pos, 0, len, vBoost);
            gridCtx.beginPath();
            gridCtx.moveTo(l.pos + 0.5, 0);
            gridCtx.lineTo(l.pos + 0.5, len);
            gridCtx.stroke();

            if (l.doubled) {
                // дубль: смещение 1px вправо и вниз (для вертикали "вниз" визуально — это просто сдвиг по y старта)
                gridCtx.strokeStyle = makeGradient(true, l.pos + 1, 1, len, vBoost);
                gridCtx.beginPath();
                gridCtx.moveTo(l.pos + 1.5, 1);
                gridCtx.lineTo(l.pos + 1.5, len);
                gridCtx.stroke();
            }
        });

        // горизонтали
        hLines.forEach((l) => {
            const len = l.half ? viewportW * 0.5 : viewportW;
            const hBoost = (l.idx + 1) % 4 === 0 ? 1.35 : 1; // каждую 4-ю горизонталь делаем чуть белее
            gridCtx.strokeStyle = makeGradient(false, 0, l.pos, len, hBoost);
            gridCtx.beginPath();
            gridCtx.moveTo(0, l.pos + 0.5);
            gridCtx.lineTo(len, l.pos + 0.5);
            gridCtx.stroke();

            if (l.doubled) {
                // дубль: смещение 1px вправо и вниз
                gridCtx.strokeStyle = makeGradient(false, 1, l.pos + 1, len);
                gridCtx.beginPath();
                gridCtx.moveTo(1, l.pos + 1.5);
                gridCtx.lineTo(len, l.pos + 1.5);
                gridCtx.stroke();
            }
        });
    }

    function resize() {
        const dpr = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1));
        viewportW = window.innerWidth;
        viewportH = window.innerHeight;

        canvas.width = Math.floor(viewportW * dpr);
        canvas.height = Math.floor(viewportH * dpr);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        gridLayer.width = Math.floor(viewportW * dpr);
        gridLayer.height = Math.floor(viewportH * dpr);
        gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        vLines = buildLines(viewportW, true);
        hLines = buildLines(viewportH, false);
        redrawGrid();
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    function drawDot(x, y, intensity) {
        // 1.5px шарик + ореол (на вспышке шире на +2px и "размытей")
        const coreR = 0.75;
        const glowR = 4 + 2 * intensity; // шире на 2px на вспышке

        const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        g.addColorStop(0, `rgba(255,255,255,${0.28 + 0.62 * intensity})`);
        g.addColorStop(0.25, `rgba(255,255,255,${0.10 + 0.28 * intensity})`);
        g.addColorStop(0.55, `rgba(56,189,248,${0.05 + 0.20 * intensity})`);
        g.addColorStop(1, 'rgba(30,58,138,0)');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${0.22 + 0.68 * intensity})`;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fill();
    }

    function phase(t, period, delay) {
        const tt = (t - delay) / period;
        return ((tt % 1) + 1) % 1;
    }

    function flashIntensity(tSec, delaySec) {
        // каждые 8 секунд вспышка с затуханием за 1 секунду
        const local = ((tSec - delaySec) % FLASH_PERIOD + FLASH_PERIOD) % FLASH_PERIOD; // 0..8
        if (local > 1) return 0;
        // 1 -> 0 плавно за 1 секунду
        return 0.5 * (1 + Math.cos(Math.PI * local));
    }

    function delayForLine(lineIndex) {
        // базовое запаздывание + 8s на каждый следующий шарик (ещё более рассинхронено)
        return lineIndex * 8;
    }

    // Чтобы не перегружать страницу, анимацию делаем только на ограниченном числе линий,
    // а сама сетка (линии) уже нарисована в gridLayer.
    const MAX_DOTS = 14;

    function render(tSec) {
        // рисуем сетку одним drawImage (быстро)
        ctx.clearRect(0, 0, viewportW, viewportH);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(gridLayer, 0, 0, viewportW, viewportH);

        ctx.globalCompositeOperation = 'screen';

        // Вертикальные шарики: строго по линиям, направление чередуем.
        // Все кружки, кроме каждого второго (i % 2 === 1), замедляем ещё на 4 секунды.
        const vCount = Math.min(MAX_DOTS, vLines.length);
        for (let i = 0; i < vCount; i++) {
            // каждый третий вертикальный шарик убираем для ещё более лёгкой анимации
            if ((i + 1) % 3 === 0) continue;
            // второй огонёк, который движется снизу вверх (i === 1), сдвигаем правее на ~8 линий
            const lineIndex = i === 1 ? Math.min(vLines.length - 1, i + 8) : i;
            const line = vLines[lineIndex];
            const delay = delayForLine(i);
            const extra = i % 2 === 1 ? 0 : 4;
            const p = phase(tSec, TRAVEL_PERIOD + extra, delay);
            const len = line.half ? viewportH * 0.5 : viewportH;
            const down = i % 2 === 0; // каждая вторая — наоборот
            const y = down ? p * len : (1 - p) * len;
            const x = line.pos;
            // у каждого кружка своя фаза вспышки: шаг 5 секунд, чтобы не совпадали
            const intensity = flashIntensity(tSec, i * 5.0);
            drawDot(x, y, intensity);

            // Подсветка участка линии вокруг шарика: 4px до и 4px после по направлению движения
            const segHalf = 4;
            const yStart = Math.max(0, y - segHalf);
            const yEnd = Math.min(len, y + segHalf);
            ctx.strokeStyle = `rgba(248,250,252,${0.25 * intensity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 0.5, yStart);
            ctx.lineTo(x + 0.5, yEnd);
            ctx.stroke();
        }

        // Горизонтальные шарики: строго по линиям, направление чередуем.
        // Все кружки, кроме каждого второго (j % 2 === 1), замедляем ещё на 4 секунды.
        const hCount = Math.min(MAX_DOTS, hLines.length);
        for (let j = 0; j < hCount; j++) {
            // каждый третий горизонтальный шарик также убираем (индексы 2,5,8,...)
            if ((j + 1) % 3 === 0) continue;
            const line = hLines[j];
            const delay = delayForLine(j);
            const extra = j % 2 === 1 ? 0 : 4;
            const p = phase(tSec, TRAVEL_PERIOD + extra, delay);
            const len = line.half ? viewportW * 0.5 : viewportW;
            const right = j % 2 === 0;
            const x = right ? p * len : (1 - p) * len;
            const y = line.pos;
            // у каждого кружка своя фаза вспышки: шаг 5 секунд, чтобы не совпадали
            const intensity = flashIntensity(tSec, j * 5.0);
            drawDot(x, y, intensity);

            // Подсветка участка линии вокруг шарика: 4px до и 4px после по горизонтали
            const segHalfH = 4;
            const xStart = Math.max(0, x - segHalfH);
            const xEnd = Math.min(len, x + segHalfH);
            ctx.strokeStyle = `rgba(248,250,252,${0.25 * intensity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(xStart, y + 0.5);
            ctx.lineTo(xEnd, y + 0.5);
            ctx.stroke();
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    // Ограничиваем FPS, чтобы страница не "висела" на скролле/кликах
    let raf = 0;
    let last = 0;
    const FRAME_MS = 1000 / 30;
    function tick(now) {
        if (document.hidden) {
            raf = requestAnimationFrame(tick);
            return;
        }
        if (now - last >= FRAME_MS) {
            last = now;
            render(now / 1000);
        }
        raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    // cleanup не нужен для статической страницы
}

/**
 * Симулятор: подсветка текущего этапа SDLC (визуализация процесса дня)
 * Мы циклично подсвечиваем этапы и сохраняем индекс в localStorage,
 * чтобы при обновлении страницы продолжать примерно "с того же места".
 */
function initSdlcHighlight() {
    const steps = Array.from(document.querySelectorAll('.sdlc-step'));
    if (!steps.length) return;

    const storageKey = 'simulator.sdlcStepIndex';
    let idx = 0;
    try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? Number(raw) : 0;
        if (Number.isFinite(parsed) && parsed >= 0) idx = parsed % steps.length;
    } catch (_) {
        // ignore
    }

    function render() {
        steps.forEach((el, i) => el.classList.toggle('active', i === idx));
    }

    function tick() {
        idx = (idx + 1) % steps.length;
        try {
            localStorage.setItem(storageKey, String(idx));
        } catch (_) {
            // ignore
        }
        render();
    }

    render();
    setInterval(tick, 9000);
}

/**
 * Роадмап по грейдам (ручной + Auto QA):
 * - чекбоксы по уровням
 * - зелёные облака для завершённых
 * - особая подсветка текущего уровня
 * - прогресс‑бар по общему количеству отмеченных уровней
 */
function initRoadmap() {
    const steps = Array.from(document.querySelectorAll('.roadmap-step'));
    const progressEl = document.getElementById('roadmapTimelineProgress');
    if (!steps.length || !progressEl) return;

    const storageKey = 'simulator.roadmap.v2';
    let state = {};

    try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object') {
            state = parsed;
        }
    } catch (_) {
        // ignore
    }

    function apply() {
        const total = steps.length;
        let lastDoneIndex = -1;

        steps.forEach((step, index) => {
            const id = step.getAttribute('data-step-id');
            const done = !!state[id];
            step.classList.toggle('roadmap-step--done', done);
            step.classList.remove('roadmap-step--current');
            if (done) lastDoneIndex = index;
        });

        // Текущий шаг — следующий после последнего завершённого
        const currentIndex = Math.min(lastDoneIndex + 1, steps.length - 1);
        if (currentIndex >= 0) {
            steps[currentIndex].classList.add('roadmap-step--current');
        }

        // Прогресс по линии
        let percent = 0;
        if (total > 1 && lastDoneIndex >= 0) {
            percent = (lastDoneIndex / (total - 1)) * 100;
        }
        progressEl.style.width = `${percent}%`;
        progressEl.title = `Прогресс по роадмапу: ${Math.round(percent)}%`;
    }

    steps.forEach((step) => {
        const id = step.getAttribute('data-step-id');
        const circle = step.querySelector('.roadmap-circle');
        if (!circle) return;
        circle.addEventListener('click', () => {
            const currentlyDone = !!state[id];
            state[id] = !currentlyDone;
            try {
                localStorage.setItem(storageKey, JSON.stringify(state));
            } catch (_) {
                // ignore
            }
            apply();
        });
    });

    apply();
}

/**
 * Банк вопросов для теоретических тестов (основной раздел + всплывающий попап)
 */
const QUIZ_QUESTIONS = [
    {
        q: 'Что такое Acceptance criteria (приёмочные критерии)?',
        options: [
            { t: 'Набор условий, при выполнении которых заказчик считает фичу/продукт готовыми', ok: true, why: 'Приёмочные критерии — это условия “готовности”, согласованные с заказчиком/PO.' },
            { t: 'Список всех возможных багов в системе', ok: false, why: 'Нет. Приёмочные критерии — это условия готовности, а не список багов.' },
            { t: 'Список задач для разработчиков на спринт', ok: false, why: 'Нет. Это ближе к планированию спринта, а не к критериям приёмки.' },
        ],
    },
    {
        q: 'На каком этапе появляется “билд”, пригодный для тестирования?',
        options: [
            { t: 'Этап 4 — Разработка', ok: true, why: 'На этапе разработки создаётся рабочая сборка (билд), которую можно начинать тестировать.' },
            { t: 'Этап 1 — Идея', ok: false, why: 'На этапе идеи кода и сборки ещё нет.' },
            { t: 'Этап 2 — Сбор требований', ok: false, why: 'На этапе требований формируются требования и критерии, но билда ещё нет.' },
        ],
    },
    {
        q: 'Какая основная цель этапа тестирования (Этап 5)?',
        options: [
            { t: 'Проверить, что билд соответствует требованиям и нуждам клиента, и оценить качество', ok: true, why: 'QA проверяет соответствие требованиям и качество, оформляет баг‑репорты.' },
            { t: 'Выбрать языки программирования и базу данных', ok: false, why: 'Это относится к архитектуре/дизайну (Этап 3), а не к тестированию.' },
            { t: 'Сформулировать идею продукта', ok: false, why: 'Это Этап 1 (Идея).' },
        ],
    },
    {
        q: 'Что происходит на этапе верификации и что такое RC Build?',
        options: [
            { t: 'QA перепроверяют исправленные дефекты; при успешной верификации получаем RC‑билд — кандидат в релиз', ok: true, why: 'Этап 7 — верификация фиксов. Если все критические дефекты исправлены — сборка становится RC Build (release candidate).' },
            { t: 'Выбираются инструменты разработки и проектируется архитектура', ok: false, why: 'Это про архитектуру и дизайн (Этап 3), а не про верификацию.' },
            { t: 'Пишутся бизнес‑требования и приёмочные критерии', ok: false, why: 'Это делается на этапе сбора требований (Этап 2), до разработки и тестирования.' },
        ],
    },
    {
        q: 'Кто такой System Analyst (SA) в команде разработки?',
        options: [
            { t: '“Переводчик” между заказчиком и разработчиками: анализирует, что нужно бизнесу, и оформляет это в требования, понятные программистам', ok: true, why: 'SA постоянно общается и с заказчиком, и с разработчиками, и формализует требования на техническом языке.' },
            { t: 'Специалист, который пишет автотесты и поддерживает тестовую инфраструктуру', ok: false, why: 'Это больше похоже на роль Auto QA / инженер по автоматизации тестирования.' },
            { t: 'Человек, который принимает финальное решение о релизе продукта в продакшен', ok: false, why: 'Решение о релизе обычно принимается совместно бизнесом, PO и техническими лидерами, а не только SA.' },
        ],
    },
    {
        q: 'За что отвечает Product Owner (PO)?',
        options: [
            { t: 'За видение продукта и его ценность для пользователя: формирует бэклог и приоритизирует, что команда будет делать', ok: true, why: 'PO отвечает за то, чтобы команда делала именно тот продукт, который нужен пользователям и бизнесу.' },
            { t: 'Только за техническое качество кода и архитектуру приложения', ok: false, why: 'Техническое качество — зона ответственности разработчиков и архитекторов; PO фокусируется на ценности и приоритетах фич.' },
            { t: 'Исключительно за написание тест‑кейсов и баг‑репортов', ok: false, why: 'Тест‑кейсы и баг‑репорты — зона ответственности QA/QC, а не PO.' },
        ],
    },
    {
        q: 'В чём разница между UI‑ и UX‑дизайнером?',
        options: [
            { t: 'UI‑дизайнер отвечает за внешний вид и навигацию экранов, UX‑дизайнер — за удобство и логику взаимодействия на основе поведения пользователей', ok: true, why: 'UI — про “как это выглядит”, UX — про “как этим удобно пользоваться и какие сценарии проходят пользователи”.' },
            { t: 'UI‑дизайнер пишет бэкэнд‑код, а UX‑дизайнер отвечает за базы данных', ok: false, why: 'Это задачи разработчиков, а не дизайнеров.' },
            { t: 'UI‑дизайнер тестирует продукт, а UX‑дизайнер пишет техническую документацию', ok: false, why: 'Тестированием занимается QA, документацией — аналитики и разработчики; дизайнеры фокусируются на интерфейсе и опыте.' },
        ],
    },
    {
        q: 'Какую роль чаще всего выполняет DevOps‑инженер?',
        options: [
            { t: 'Связывает разработку, тестирование и эксплуатацию: автоматизирует сборки, деплой, мониторинг и инфраструктуру', ok: true, why: 'DevOps строит процессы и инструменты, которые позволяют быстро и надёжно доставлять изменения в прод.' },
            { t: 'Пишет пользовательские интерфейсы и анимации на фронтенде', ok: false, why: 'Это работа фронтенд‑разработчиков, а не DevOps.' },
            { t: 'Занимается только ручным тестированием веб‑приложений', ok: false, why: 'Ручным тестированием занимаются QA; DevOps фокусируется на автоматизации и инфраструктуре.' },
        ],
    },
    {
        q: 'Какая основная задача Project Manager (PM)?',
        options: [
            { t: 'Управлять проектом и командой так, чтобы цели были достигнуты в срок и нужного качества', ok: true, why: 'PM планирует, координирует команды и следит за выполнением плана, вовремя внося корректировки.' },
            { t: 'Писать весь код проекта и самостоятельно тестировать его', ok: false, why: 'Код пишут разработчики, тестированием занимается QA; PM управляет процессом, а не делает всю работу один.' },
            { t: 'Только настраивать сеть и сервера', ok: false, why: 'Сеть и сервера — зона NetOps/админов, а не PM.' },
        ],
    },
    {
        q: 'Что такое тестирование?',
        options: [
            { t: 'Процесс проверки продукта и поиска несоответствий требованиям/ожиданиям, чтобы снизить риски перед релизом', ok: true, why: 'Тестирование помогает выявлять дефекты и риски: проверяем соответствие требованиям и ожиданиям.' },
            { t: 'Процесс написания кода и разработки новых функций', ok: false, why: 'Это разработка. Тестирование — отдельная активность контроля качества.' },
            { t: 'Процесс оформления дизайна интерфейса', ok: false, why: 'Это задача UI/UX‑дизайна, а не тестирования.' },
        ],
    },
    {
        q: 'Чем отличается верификация от валидации?',
        options: [
            { t: 'Верификация — “делаем продукт правильно?” (соответствие требованиям), валидация — “делаем правильный продукт?” (нужен ли он пользователю)', ok: true, why: 'Классическая связка: verify = соответствие спецификации, validate = соответствие реальным нуждам.' },
            { t: 'Верификация — это релиз в прод, а валидация — это написание тест‑кейсов', ok: false, why: 'Нет. Это понятия про “правильность” относительно требований и потребностей.' },
            { t: 'Это одно и то же, просто разные слова', ok: false, why: 'Нет, это разные цели проверки.' },
        ],
    },
    {
        q: 'Что такое RC Build?',
        options: [
            { t: 'Release Candidate — сборка‑кандидат в релиз, прошедшая ключевые проверки и готовая к финальной валидации', ok: true, why: 'RC Build — кандидат в релиз: если критичные дефекты закрыты, сборка готовится к выпуску.' },
            { t: 'Сборка для дизайнеров, чтобы выбрать цвета и шрифты', ok: false, why: 'Дизайн обычно фиксируется раньше, RC относится к релизной готовности.' },
            { t: 'Сборка, где разрешено иметь любые критические дефекты', ok: false, why: 'Наоборот: RC предполагает отсутствие критичных дефектов (по критериям релиза).' },
        ],
    },
    {
        q: 'Что такое качественный продукт?',
        options: [
            { t: 'Продукт, который решает задачу пользователя, соответствует требованиям и стабильно работает в реальных условиях', ok: true, why: 'Качество — это не только “без багов”, а полезность + соответствие ожиданиям/AC + приемлемые риски.' },
            { t: 'Продукт без единого дефекта, даже косметического', ok: false, why: 'Абсолютно “без дефектов” почти недостижимо и не всегда нужно; важны приоритеты и риски.' },
            { t: 'Продукт с самым красивым интерфейсом', ok: false, why: 'Внешний вид важен, но качество шире: функциональность, надёжность, удобство и т.д.' },
        ],
    },
    {
        q: 'Что такое приёмочные критерии (Acceptance Criteria) и когда их формируют?',
        options: [
            { t: 'Условия “готовности” фичи/истории; формируются на этапе требований до разработки вместе с PO/BA/QA', ok: true, why: 'AC фиксируют, что именно должно быть сделано, чтобы задача считалась выполненной.' },
            { t: 'Список багов, найденных тестировщиком перед релизом', ok: false, why: 'Это баг‑репорты. AC — критерии готовности, а не дефекты.' },
            { t: 'Список автотестов, которые пишет разработчик', ok: false, why: 'Автотесты — инструмент проверки, но AC — договорённость о результатах.' },
        ],
    },
    {
        q: 'Почему ошибки дороже исправлять после релиза?',
        options: [
            { t: 'Нужно делать горячие фиксы/откаты, подключать поддержку, теряется доверие пользователей и растут бизнес‑потери', ok: true, why: 'Цена включает не только разработку, но и репутацию, SLA, поддержку и простои.' },
            { t: 'Потому что в проде нельзя менять код', ok: false, why: 'Менять можно, но это рискованнее и дороже по последствиям.' },
            { t: 'Потому что тестировщик уже “закрыл” проект', ok: false, why: 'Причина в последствиях для бизнеса и пользователей, а не в формальностях.' },
        ],
    },
];

/**
 * Тесты (основной раздел “Тесты” внизу страницы)
 */
function initQuiz() {
    const startBtn = document.getElementById('startQuizBtn');
    const quizArea = document.getElementById('quizArea');
    const progressEl = document.getElementById('quizProgress');
    const questionEl = document.getElementById('quizQuestion');
    const optionsEl = document.getElementById('quizOptions');
    const feedbackEl = document.getElementById('quizFeedback');
    const nextBtn = document.getElementById('nextQuizBtn');

    if (!startBtn || !quizArea || !progressEl || !questionEl || !optionsEl || !feedbackEl || !nextBtn) return;

    let current = 0;
    let locked = false;

    function showQuestion() {
        locked = false;
        nextBtn.classList.add('hidden');
        feedbackEl.innerHTML = '';
        optionsEl.innerHTML = '';
        const item = QUIZ_QUESTIONS[current];
        progressEl.textContent = `Вопрос ${current + 1} из ${QUIZ_QUESTIONS.length}`;
        questionEl.textContent = item.q;

        item.options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-secondary';
            btn.textContent = opt.t;
            btn.addEventListener('click', () => {
                if (locked) return;
                locked = true;

                if (opt.ok) {
                    feedbackEl.innerHTML = `<div class="ok"><strong>Верно!</strong> ${escapeHtml(opt.why)}</div>`;
                } else {
                    const correct = item.options.find(o => o.ok);
                    feedbackEl.innerHTML =
                        `<div class="bad"><strong>Неверно.</strong> ${escapeHtml(opt.why)}</div>` +
                        `<div class="ok"><strong>Как правильно:</strong> ${escapeHtml(correct ? correct.why : '')}</div>`;
                }

                nextBtn.classList.remove('hidden');
            });
            optionsEl.appendChild(btn);
        });
    }

    startBtn.addEventListener('click', () => {
        quizArea.classList.remove('hidden');
        current = 0;
        showQuestion();
        startBtn.textContent = 'Перезапустить';
        logStep('Открыт раздел тестов (квиз).');
    });

    nextBtn.addEventListener('click', () => {
        current += 1;
        // При ручном запуске через форму тестов крутим вопросы по кругу, без жёсткого завершения
        if (current >= QUIZ_QUESTIONS.length) {
            current = 0;
        }
        showQuestion();
    });
}

/**
 * Всплывающий мини‑квиз: каждые N минут показывает 4 рандомных вопроса
 */
function initQuizPopup() {
    const popup = document.getElementById('quizPopup');
    const progressEl = document.getElementById('quizPopupProgress');
    const questionEl = document.getElementById('quizPopupQuestion');
    const optionsEl = document.getElementById('quizPopupOptions');
    const feedbackEl = document.getElementById('quizPopupFeedback');
    const nextBtn = document.getElementById('quizPopupNextBtn');
    const closeBtn = document.getElementById('quizPopupCloseBtn');

    if (!popup || !progressEl || !questionEl || !optionsEl || !feedbackEl || !nextBtn || !closeBtn) return;

    const POPUP_INTERVAL_MS = 30 * 60 * 1000; // 30 минут
    const QUESTIONS_PER_POPUP = 4;
    const storageKey = 'simulator.quiz.usedIndices';

    let used = [];
    try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) used = parsed;
    } catch (_) {
        // ignore
    }

    let sessionQuestions = [];
    let currentIndex = 0;
    let locked = false;
    let timerId = null;

    function saveUsed() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(used));
        } catch (_) {
            // ignore
        }
    }

    function pickSessionQuestions() {
        const availableIndices = QUIZ_QUESTIONS.map((_, idx) => idx).filter(idx => !used.includes(idx));
        if (availableIndices.length < QUESTIONS_PER_POPUP) {
            used = [];
        }
        const pool = QUIZ_QUESTIONS.map((_, idx) => idx).filter(idx => !used.includes(idx));
        const picked = [];
        while (picked.length < QUESTIONS_PER_POPUP && pool.length) {
            const rndIdx = Math.floor(Math.random() * pool.length);
            const [val] = pool.splice(rndIdx, 1);
            picked.push(val);
            used.push(val);
        }
        saveUsed();
        sessionQuestions = picked;
        currentIndex = 0;
    }

    function showQuestion() {
        locked = false;
        nextBtn.classList.add('hidden');
        feedbackEl.innerHTML = '';
        optionsEl.innerHTML = '';

        const globalIndex = sessionQuestions[currentIndex];
        const item = QUIZ_QUESTIONS[globalIndex];
        progressEl.textContent = `Вопрос ${currentIndex + 1} из ${sessionQuestions.length}`;
        questionEl.textContent = item.q;

        item.options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-secondary';
            btn.textContent = opt.t;
            btn.addEventListener('click', () => {
                if (locked) return;
                locked = true;

                if (opt.ok) {
                    feedbackEl.innerHTML = `<div class="ok"><strong>Верно!</strong> ${escapeHtml(opt.why)}</div>`;
                } else {
                    const correct = item.options.find(o => o.ok);
                    feedbackEl.innerHTML =
                        `<div class="bad"><strong>Неверно.</strong> ${escapeHtml(opt.why)}</div>` +
                        `<div class="ok"><strong>Как правильно:</strong> ${escapeHtml(correct ? correct.why : '')}</div>`;
                }

                nextBtn.classList.remove('hidden');
            });
            optionsEl.appendChild(btn);
        });
    }

    function closePopup() {
        popup.classList.add('hidden');
        schedule();
    }

    function startSession() {
        pickSessionQuestions();
        popup.classList.remove('hidden');
        showQuestion();
    }

    function schedule() {
        if (timerId) {
            clearTimeout(timerId);
        }
        timerId = setTimeout(startSession, POPUP_INTERVAL_MS);
    }

    nextBtn.addEventListener('click', () => {
        currentIndex += 1;
        if (currentIndex >= sessionQuestions.length) {
            closePopup();
            return;
        }
        showQuestion();
    });

    closeBtn.addEventListener('click', () => {
        closePopup();
    });

    // Автоматический мини‑квиз каждые N минут
    schedule();
}

/**
 * Чек‑листы: рабочий режим + тренировка порядка
 */
function initChecklists() {
    const panel = document.getElementById('checklistsPanel');
    if (!panel) return;

    const typeButtons = Array.from(panel.querySelectorAll('.checklists-type-btn'));
    const modeButtons = Array.from(panel.querySelectorAll('.checklists-mode-btn'));
    const runArea = document.getElementById('checklistRunArea');
    const orderArea = document.getElementById('checklistOrderArea');

    if (!typeButtons.length || !modeButtons.length || !runArea || !orderArea) return;

    let currentId = typeButtons[0].getAttribute('data-checklist-id');
    let currentMode = 'run';

    const storageKeyRun = 'simulator.checklists.run';
    let runState = {};
    try {
        const raw = localStorage.getItem(storageKeyRun);
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object') runState = parsed;
    } catch (_) {
        // ignore
    }

    function renderRun() {
        const cfg = CHECKLISTS[currentId];
        if (!cfg) return;
        const stateForList = runState[currentId] || {};
        runArea.innerHTML = '';
        const ul = document.createElement('ul');
        cfg.items.forEach((text, index) => {
            const li = document.createElement('li');
            li.className = 'checklist-item';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!stateForList[index];
            input.addEventListener('change', () => {
                if (!runState[currentId]) runState[currentId] = {};
                runState[currentId][index] = input.checked;
                try {
                    localStorage.setItem(storageKeyRun, JSON.stringify(runState));
                } catch (_) {
                    // ignore
                }
            });
            const label = document.createElement('span');
            label.textContent = text;
            li.appendChild(input);
            li.appendChild(label);
            ul.appendChild(li);
        });
        runArea.appendChild(ul);
    }

    function renderOrder() {
        const cfg = CHECKLISTS[currentId];
        if (!cfg) return;
        orderArea.innerHTML = '';

        const ul = document.createElement('ul');
        cfg.items.forEach((text, index) => {
            const li = document.createElement('li');
            li.className = 'checklist-order-item';
            li.textContent = text;
            li.draggable = true;
            li.dataset.index = String(index);
            ul.appendChild(li);
        });

        orderArea.appendChild(ul);

        const footer = document.createElement('div');
        footer.className = 'checklist-order-footer';
        const checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.className = 'btn btn-primary';
        checkBtn.textContent = 'Проверить порядок';
        footer.appendChild(checkBtn);
        orderArea.appendChild(footer);

        const result = document.createElement('div');
        result.className = 'checklist-order-result';
        orderArea.appendChild(result);

        let dragged = null;

        ul.addEventListener('dragstart', (e) => {
            const target = e.target;
            if (target && target.classList.contains('checklist-order-item')) {
                dragged = target;
                target.classList.add('dragging');
            }
        });

        ul.addEventListener('dragend', (e) => {
            const target = e.target;
            if (target && target.classList.contains('checklist-order-item')) {
                target.classList.remove('dragging');
            }
            dragged = null;
        });

        ul.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!dragged) return;
            const afterElement = Array.from(ul.querySelectorAll('.checklist-order-item'))
                .filter(el => el !== dragged)
                .find(el => {
                    const box = el.getBoundingClientRect();
                    return e.clientY < box.top + box.height / 2;
                });
            if (!afterElement) {
                ul.appendChild(dragged);
            } else {
                ul.insertBefore(dragged, afterElement);
            }
        });

        checkBtn.addEventListener('click', () => {
            const currentOrder = Array.from(ul.querySelectorAll('.checklist-order-item')).map(li =>
                Number(li.dataset.index)
            );
            const correct = cfg.items.every((_, idx) => currentOrder[idx] === idx);
            if (correct) {
                result.innerHTML = '<span style="color:#16a34a;font-weight:600;">Порядок верный — ты выстроила чек‑лист как нужно.</span>';
            } else {
                result.innerHTML = '<span style="color:#b91c1c;font-weight:600;">Порядок пока некорректный. Попробуй вспомнить, что логично проверить сначала, а что — после.</span>';
            }
        });
    }

    function applyMode() {
        if (currentMode === 'run') {
            runArea.classList.remove('hidden');
            orderArea.classList.add('hidden');
            renderRun();
        } else {
            runArea.classList.add('hidden');
            orderArea.classList.remove('hidden');
            renderOrder();
        }
    }

    typeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            currentId = btn.getAttribute('data-checklist-id');
            typeButtons.forEach(b => b.classList.remove('btn-primary'));
            btn.classList.add('btn-primary');
            applyMode();
        });
    });

    modeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            currentMode = btn.getAttribute('data-checklist-mode') || 'run';
            modeButtons.forEach(b => b.classList.remove('btn-primary'));
            btn.classList.add('btn-primary');
            applyMode();
        });
    });

    // Инициализация по умолчанию
    typeButtons[0].classList.add('btn-primary');
    modeButtons[0].classList.add('btn-primary');
    applyMode();

    // Открытие модального окна чек‑листов по кнопке слева
    const checklistsModal = document.getElementById('checklistsModal');
    const closeChecklistsModalBtn = document.getElementById('closeChecklistsModalBtn');
    const checklistsNavBtn = document.querySelector('.left-nav-link[data-scroll-target="#checklistsPanel"]');

    if (checklistsModal && closeChecklistsModalBtn && checklistsNavBtn) {
        checklistsNavBtn.addEventListener('click', () => {
            checklistsModal.classList.remove('hidden');
        });
        closeChecklistsModalBtn.addEventListener('click', () => {
            checklistsModal.classList.add('hidden');
        });

        // Клик по фону чек-листов с подтверждением
        checklistsModal.addEventListener('click', (event) => {
            if (event.target === checklistsModal) {
                const ok = confirm('Закрыть форму чек-листа без сохранения прогресса?');
                if (ok) {
                    checklistsModal.classList.add('hidden');
                }
            }
        });
    }
}

/**
 * Логирование в консоль (раньше показывали в отдельном блоке на странице)
 */
function logStep(message) {
    // Можно отключить совсем, если мешает:
    // return;
    console.log('[LOG]', message);
}

/**
 * Показать модальное окно
 * classList.remove('hidden') — убираем класс hidden, окно становится видимым
 */
function openModal() {
    if (!bugReportModal) return;
    bugReportModal.classList.remove('hidden');
    logStep('Открыто модальное окно создания багрепорта.');
}

/**
 * Скрыть модальное окно
 * classList.add('hidden') — добавляем класс hidden, окно скрывается
 */
function closeModal() {
    if (!bugReportModal) return;
    bugReportModal.classList.add('hidden');
    logStep('Модальное окно закрыто.');
}

// addEventListener — \"подписываемся\" на событие
// 'click' — событие клика мышью
// При клике вызывается функция openModal
if (createBugReportBtn) {
    createBugReportBtn.addEventListener('click', () => {
        logStep('Нажата кнопка \"Создать багрепорт\".');
        openModal();
    });
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        logStep('Нажата кнопка закрытия модального окна.');
        closeModal();
    });
}

// Закрытие при клике вне окна (на тёмный фон)
if (bugReportModal) {
    bugReportModal.addEventListener('click', function (event) {
        // Клик строго по фону (а не по содержимому модалки)
        if (event.target === bugReportModal) {
            const ok = confirm('Закрыть форму багрепорта без сохранения?');
            if (ok) {
                logStep('Клик по фону модального окна + подтверждение — закрываем окно.');
                closeModal();
            } else {
                logStep('Клик по фону модального окна — пользователь отменил закрытие.');
            }
        }
    });
}

// Закрытие по клавише Escape
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        logStep('Нажата клавиша Escape — закрываем модальное окно.');
        closeModal();
    }
});

// Инициализация симулятора (визуализации + тесты)
initSdlcHighlight();
initRoadmap();
initQuiz();
initChecklists();
initQuizPopup();
initBgChargeCanvas();

/**
 * Приветственное всплывающее окно при открытии симулятора
 */
function initGreetingPopup() {
    const popup = document.getElementById('greetingPopup');
    if (!popup) return;

    function hide() {
        if (popup.classList.contains('hidden')) return;
        popup.classList.add('hidden');
    }

    popup.classList.remove('hidden');

    setTimeout(hide, 4000);

    // любое нажатие клавиши или любой клик — закрывает приветствие (включая клик по самому окну)
    function onAnyInput() {
        hide();
        document.removeEventListener('keydown', onAnyInput, true);
        document.removeEventListener('pointerdown', onAnyInput, true);
        document.removeEventListener('mousedown', onAnyInput, true);
        document.removeEventListener('touchstart', onAnyInput, true);
    }
    document.addEventListener('keydown', onAnyInput, true);
    document.addEventListener('pointerdown', onAnyInput, true);
    document.addEventListener('mousedown', onAnyInput, true);
    document.addEventListener('touchstart', onAnyInput, true);
}

initGreetingPopup();

/**
 * Левое меню: плавный скролл к секциям
 */
(function initLeftNavScroll() {
    const links = Array.from(document.querySelectorAll('.left-nav-link[data-scroll-target]'));
    if (!links.length) return;

    links.forEach((btn) => {
        const targetSelector = btn.getAttribute('data-scroll-target');
        if (!targetSelector) return;
        btn.addEventListener('click', () => {
            // Для тестов и чек‑листов используем модальные окна/квизы, а не скролл
            if (targetSelector === '#testsPanel' || targetSelector === '#checklistsPanel') {
                return;
            }
            const target = document.querySelector(targetSelector);
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
})();

// Открытие модального окна с тестами по кнопке "Тесты" в навигации
(function initTestsModal() {
    const testsModal = document.getElementById('testsModal');
    const closeTestsModalBtn = document.getElementById('closeTestsModalBtn');
    const testsNavBtn = document.querySelector('.left-nav-link[data-scroll-target="#testsPanel"]');
    if (!testsModal || !closeTestsModalBtn || !testsNavBtn) return;

    testsNavBtn.addEventListener('click', () => {
        testsModal.classList.remove('hidden');
    });

    closeTestsModalBtn.addEventListener('click', () => {
        testsModal.classList.add('hidden');
    });

    // Клик по фону тестов с подтверждением выхода
    testsModal.addEventListener('click', (event) => {
        if (event.target === testsModal) {
            const ok = confirm('Выйти из тестов?');
            if (ok) {
                testsModal.classList.add('hidden');
            }
        }
    });
})();

/**
 * Утилита: экранирование HTML, чтобы пользовательский ввод
 * не превратился в HTML/скрипт на странице.
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Тренажёр: сопоставление этапов SDLC (drag & drop)
 */
function initSdlcMatchTrainer() {
    const bankEl = document.getElementById('sdlcBank');
    const targetsEl = document.getElementById('sdlcTargets');
    const checkBtn = document.getElementById('sdlcMatchCheckBtn');
    const resetBtn = document.getElementById('sdlcMatchResetBtn');
    const resultEl = document.getElementById('sdlcMatchResult');
    if (!bankEl || !targetsEl || !checkBtn || !resetBtn || !resultEl) return;

    const STORAGE_KEY = 'simulator.sdlc.match.v1';

    const items = [
        { id: 'idea', label: 'Формирование идеи' },
        { id: 'biz', label: 'Бизнес‑требования и приёмочные критерии (AC)' },
        { id: 'sys', label: 'Системные требования и дизайн‑макеты' },
        { id: 'build', label: 'Промежуточный билд' },
        { id: 'bugs', label: 'Баг‑репорты' },
        { id: 'fixed', label: 'Исправленный билд' },
        { id: 'rc', label: 'Релиз‑кандидат (RC Build)' },
        { id: 'prod', label: 'Готовый продукт (релиз)' },
    ];

    const targets = [
        { id: 't-idea', title: 'Идея', correct: 'idea' },
        { id: 't-biz', title: 'Бизнес‑требования и приёмочные критерии', correct: 'biz' },
        { id: 't-sys', title: 'Системные требования и дизайн‑макеты', correct: 'sys' },
        { id: 't-build', title: 'Промежуточный билд', correct: 'build' },
        { id: 't-bugs', title: 'Баг‑репорты', correct: 'bugs' },
        { id: 't-fixed', title: 'Исправленный билд', correct: 'fixed' },
        { id: 't-rc', title: 'Релиз‑кандидат билд', correct: 'rc' },
        { id: 't-prod', title: 'Готовый продукт', correct: 'prod' },
    ];

    let state = { placements: {} };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') state = parsed;
    } catch (_) {}

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    }

    function createChip(item) {
        const el = document.createElement('div');
        el.className = 'sdlc-chip';
        el.draggable = true;
        el.dataset.itemId = item.id;
        el.textContent = item.label;
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.id);
            e.dataTransfer.effectAllowed = 'move';
        });
        return el;
    }

    function render() {
        bankEl.innerHTML = '';
        targetsEl.innerHTML = '';
        resultEl.className = 'trainer-result';
        resultEl.textContent = '';

        // Таргеты
        targets.forEach((t) => {
            const row = document.createElement('div');
            row.className = 'sdlc-target-row';
            const title = document.createElement('div');
            title.className = 'sdlc-target-title';
            title.textContent = t.title;

            const drop = document.createElement('div');
            drop.className = 'sdlc-drop';
            drop.dataset.targetId = t.id;

            drop.addEventListener('dragover', (e) => {
                e.preventDefault();
                drop.classList.add('is-over');
            });
            drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
            drop.addEventListener('drop', (e) => {
                e.preventDefault();
                drop.classList.remove('is-over');
                const itemId = e.dataTransfer.getData('text/plain');
                if (!itemId) return;
                // Удаляем itemId из других целей
                Object.keys(state.placements).forEach((k) => {
                    if (state.placements[k] === itemId) delete state.placements[k];
                });
                state.placements[t.id] = itemId;
                save();
                render();
            });

            const placedId = state.placements[t.id];
            if (placedId) {
                const it = items.find(i => i.id === placedId);
                if (it) {
                    const chip = createChip(it);
                    drop.appendChild(chip);
                }
            }

            row.appendChild(title);
            row.appendChild(drop);
            targetsEl.appendChild(row);
        });

        // Банк — показываем те, кто не размещён
        const placed = new Set(Object.values(state.placements));
        items.filter(i => !placed.has(i.id)).forEach((i) => bankEl.appendChild(createChip(i)));
    }

    checkBtn.addEventListener('click', () => {
        let okCount = 0;
        targets.forEach((t) => {
            if (state.placements[t.id] === t.correct) okCount += 1;
        });
        if (okCount === targets.length) {
            resultEl.className = 'trainer-result ok';
            resultEl.textContent = 'Верно! Ты правильно сопоставила все этапы SDLC.';
        } else {
            resultEl.className = 'trainer-result bad';
            resultEl.textContent = `Пока не идеально: верно ${okCount} из ${targets.length}. Попробуй ещё раз — подсказка: вспомни артефакт каждого этапа.`;
        }
    });

    resetBtn.addEventListener('click', () => {
        state = { placements: {} };
        save();
        render();
    });

    render();
}

initSdlcMatchTrainer();

/**
 * Рендер одного багрепорта в список
 */
function renderBugReport(report) {
    if (!bugReportsList) return;

    // Удаляем текст \"Пока нет созданных отчётов...\"
    const emptyState = bugReportsList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const card = document.createElement('article');
    card.className = 'bug-card';
    card.innerHTML = `
        <h3>${escapeHtml(report.title)}</h3>
        <p class=\"bug-meta\">
            Приоритет: ${escapeHtml(report.priority)} • 
            Серьёзность: ${escapeHtml(report.severity)} • 
            Создано: ${escapeHtml(report.createdAt)}
        </p>
        <details>
            <summary>Шаги воспроизведения</summary>
            <pre>${escapeHtml(report.steps)}</pre>
        </details>
        <details>
            <summary>Ожидаемый результат</summary>
            <pre>${escapeHtml(report.expected)}</pre>
        </details>
        <details>
            <summary>Фактический результат</summary>
            <pre>${escapeHtml(report.actual)}</pre>
        </details>
        <details>
            <summary>Окружение</summary>
            <pre>${escapeHtml(report.environment)}</pre>
        </details>
        <div class="download-actions">
            <button type="button" class="btn btn-secondary btn-download-txt">
                Скачать TXT
            </button>
            <button type="button" class="btn btn-secondary btn-download-pdf">
                Скачать PDF
            </button>
        </div>
    `;

    bugReportsList.appendChild(card);

    // Вешаем обработчики на кнопки скачивания TXT / PDF
    const downloadTxtBtn = card.querySelector('.btn-download-txt');
    if (downloadTxtBtn) {
        downloadTxtBtn.addEventListener('click', () => {
            logStep(`Нажата кнопка "Скачать TXT" для багрепорта "${report.title}".`);
            downloadReportAsTxt(report);
        });
    }

    const downloadPdfBtn = card.querySelector('.btn-download-pdf');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            logStep(`Нажата кнопка "Скачать PDF" для багрепорта "${report.title}". (экспорт в PDF в разработке)`);
            downloadReportAsPdf(report);
        });
    }
}

/**
 * Сохранение массива багрепортов в localStorage
 */
function saveReportsToStorage() {
    try {
        localStorage.setItem('bugReports', JSON.stringify(bugReports));
        logStep('Список багрепортов сохранён в localStorage.');
    } catch (e) {
        logStep('Ошибка сохранения багрепортов в localStorage: ' + e.message);
    }
}

/**
 * Загрузка багрепортов из localStorage при старте
 */
function loadReportsFromStorage() {
    try {
        const raw = localStorage.getItem('bugReports');
        if (!raw) {
            logStep('В localStorage нет сохранённых багрепортов.');
            return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            bugReports = parsed;
            logStep(`Загружено багрепортов из localStorage: ${bugReports.length}.`);
            bugReports.forEach(r => renderBugReport(r));
        }
    } catch (e) {
        logStep('Ошибка загрузки багрепортов из localStorage: ' + e.message);
    }
}

/**
 * Скачивание багрепорта как TXT-файл
 */
function downloadReportAsTxt(report) {
    const lines = [];
    lines.push(`Title: ${report.title}`);
    lines.push('');
    lines.push('Steps:');
    lines.push(report.steps || '');
    lines.push('');
    lines.push('Expected:');
    lines.push(report.expected || '');
    lines.push('');
    lines.push('Actual:');
    lines.push(report.actual || '');
    lines.push('');
    lines.push('Environment:');
    lines.push(report.environment || '');
    lines.push('');
    lines.push(`Priority: ${report.priority}`);
    lines.push(`Severity: ${report.severity}`);
    lines.push(`Created at: ${report.createdAt}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = report.title.replace(/[^a-z0-9а-яё]+/gi, '_').slice(0, 50);
    a.href = url;
    a.download = `bug-report-${safeTitle || 'report'}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Заготовка под экспорт в PDF: пока предупреждаем, что функциональность в разработке
function downloadReportAsPdf(report) {
    alert('Экспорт багрепорта в PDF пока в разработке. Сейчас можно сохранить его как TXT-файл.');
}

/**
 * Обработка отправки формы багрепорта + инициализация UI шагов
 */
if (bugReportForm) {
    // Инициализируем нумерованные шаги
    (function initBugReportSteps() {
        const list = document.getElementById('stepsList');
        const addBtn = document.getElementById('addStepBtn');
        if (!list || !addBtn) return;

        function rebuildIndices() {
            const rows = Array.from(list.querySelectorAll('.step-row'));
            rows.forEach((row, idx) => {
                const label = row.querySelector('.step-index');
                const input = row.querySelector('.step-input');
                const n = idx + 1;
                if (label) label.textContent = n + '.';
                if (input && !input.value) {
                    input.placeholder = `Шаг ${n}: что делаем?`;
                }
            });
        }

        function addRow(initialValue = '') {
            const row = document.createElement('div');
            row.className = 'step-row';
            row.innerHTML = `
                <span class="step-index"></span>
                <input type="text" class="step-input" />
            `;
            const input = row.querySelector('.step-input');
            if (input) input.value = initialValue;
            list.appendChild(row);
            rebuildIndices();
        }

        // Если по каким-то причинам шагов нет в разметке — создаём три
        if (!list.querySelector('.step-row')) {
            addRow();
            addRow();
            addRow();
        } else {
            rebuildIndices();
        }

        addBtn.addEventListener('click', () => addRow());
    })();

    function collectStepsText() {
        const inputs = bugReportForm.querySelectorAll('.step-input');
        const lines = [];
        inputs.forEach((input, idx) => {
            const value = input.value.trim();
            if (!value) return;
            lines.push(`${idx + 1}. ${value}`);
        });
        return lines.join('\n');
    }

    bugReportForm.addEventListener('submit', function (event) {
        event.preventDefault(); // не даём браузеру перезагружать страницу

        // Достаём значения полей
        const title = bugReportForm.elements['title'].value.trim();
        const steps = collectStepsText();
        const expected = bugReportForm.elements['expected'].value.trim();
        const actual = bugReportForm.elements['actual'].value.trim();
        // Поля окружения теперь разнесены — все НЕобязательные
        const browser = bugReportForm.elements['browser'].value.trim();
        const os = bugReportForm.elements['os'].value.trim();
        const resolution = bugReportForm.elements['resolution'].value.trim();
        const appVersion = bugReportForm.elements['appVersion'].value.trim();
        const environmentExtra = bugReportForm.elements['environmentExtra'].value.trim();
        const priority = bugReportForm.elements['priority'].value;
        const severity = bugReportForm.elements['severity'].value;

        // Простая валидация обязательных полей
        if (!title || !steps || !expected || !actual) {
            logStep('Ошибка: не заполнены обязательные поля формы багрепорта.');
            alert('Пожалуйста, заполните все обязательные поля (*).');
            return;
        }

        // Собираем окружение в один текстовый блок (для отображения)
        const environmentLines = [];
        if (browser) environmentLines.push(`Браузер: ${browser}`);
        if (os) environmentLines.push(`ОС: ${os}`);
        if (resolution) environmentLines.push(`Разрешение: ${resolution}`);
        if (appVersion) environmentLines.push(`Версия приложения: ${appVersion}`);
        if (environmentExtra) environmentLines.push(`Дополнительно: ${environmentExtra}`);

        const report = {
            title,
            steps,
            expected,
            actual,
            environment: environmentLines.join('\n'),
            priority,
            severity,
            createdAt: new Date().toLocaleString(),
        };

        logStep('Форма багрепорта заполнена. Создаём карточку в списке.');
        bugReports.push(report);
        saveReportsToStorage();
        renderBugReport(report);

        bugReportForm.reset();
        closeModal();
        logStep('Багрепорт сохранён и добавлен в список.');
    });
}

// Обработка кнопки \"Отмена\" в форме
if (cancelFormBtn) {
    cancelFormBtn.addEventListener('click', () => {
        logStep('Нажата кнопка \"Отмена\" в форме багрепорта.');
        closeModal();
    });
}

// Инициализация при загрузке страницы
logStep('Страница загружена, интерфейс инициализирован.');
loadReportsFromStorage();

