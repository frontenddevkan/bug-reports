/**
 * УРОК: JavaScript — язык программирования для браузера
 * Он "оживляет" страницу: реагирует на клики, меняет контент, открывает окна.
 *
 * Что мы делаем:
 * 1. Находим кнопку и модальное окно по их id
 * 2. Вешаем "слушатель" на клик по кнопке
 * 3. При клике — показываем модальное окно
 * 4. При клике на крестик — скрываем
 * 5. В отдельной области показываем текстовый лог действий (\"сереньким текстом\")
 */

// document.getElementById — находит элемент по id
// Это как сказать браузеру: \"Дай мне элемент с id='createBugReportBtn'\"
const createBugReportBtn = document.getElementById('createBugReportBtn');
const bugReportModal = document.getElementById('bugReportModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const bugReportForm = document.getElementById('bugReportForm');
const bugReportsList = document.getElementById('bugReportsList');
const cancelFormBtn = document.getElementById('cancelFormBtn');

// Локальное хранилище багрепортов (память + localStorage)
let bugReports = [];

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
 * - Сетка уже есть в CSS, здесь рисуем только "огоньки"
 * - Вертикали: 1-я линия (mod 3 == 1) сверху вниз, 2-я без изменений, 3-я (mod 3 == 0) снизу вверх
 * - Горизонтали: 1-я (mod 3 == 1) справа налево, 2-я без изменений, 3-я (mod 3 == 0) слева направо
 * - Задержки: down 0s, up 4s, left->right 3s, right->left 2s
 */
function initBgChargeCanvas() {
    const canvas = document.getElementById('bgChargeCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grid = 4; // px — соответствует background-size сетки
    const lineStride = 1; // рисуем по линиям, но часть линий "без изменений" пропускаем по правилам

    const PERIOD_DOWN = 8.5;
    const PERIOD_UP = 9.5;
    const PERIOD_LR = 10.0;
    const PERIOD_RL = 11.0;

    function resize() {
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    function orbGradient(x, y, pulse) {
        // белый центр -> белая мягкая тень -> голубой широкий ореол
        const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
        const a0 = 0.92 * pulse;
        const a1 = 0.55 * pulse;
        const a2 = 0.38 * pulse;
        g.addColorStop(0, `rgba(255,255,255,${a0})`);
        g.addColorStop(0.2, `rgba(255,255,255,${a1})`);
        g.addColorStop(0.45, `rgba(56,189,248,${a2})`);
        g.addColorStop(1, 'rgba(56,189,248,0)');
        return g;
    }

    function drawOrb(x, y, coreRadius, pulse) {
        ctx.fillStyle = orbGradient(x, y, pulse);
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();

        // яркое ядро (вертикаль 5px / горизонталь 6px)
        ctx.fillStyle = `rgba(255,255,255,${0.95 * pulse})`;
        ctx.beginPath();
        ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    function phase(t, period, delay) {
        const tt = (t - delay) / period;
        return ((tt % 1) + 1) % 1;
    }

    function pulseIntensity(tSec) {
        // вспышка каждые ~3с и ~4с, плюс мягкое затухание
        const p3 = (Math.sin((Math.PI * 2 * tSec) / 3) + 1) / 2;
        const p4 = (Math.sin((Math.PI * 2 * tSec) / 4) + 1) / 2;
        const peak = Math.max(p3, p4);
        return 0.55 + 0.45 * peak;
    }

    function render(tSec) {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.globalCompositeOperation = 'screen';

        const w = window.innerWidth;
        const h = window.innerHeight;
        const pulse = pulseIntensity(tSec);

        // Вертикальные "огоньки"
        for (let x = 0; x <= w; x += grid * lineStride) {
            const lineIndex = Math.round(x / grid);
            const mod = lineIndex % 3;
            if (mod === 2) continue; // без изменений

            if (mod === 1) {
                // сверху вниз
                const p = phase(tSec, PERIOD_DOWN, 0);
                const y = p * (h + 60) - 30;
                drawOrb(x, y, 5, pulse);
            } else {
                // снизу вверх (mod === 0)
                const p = phase(tSec, PERIOD_UP, 4);
                const y = (1 - p) * (h + 60) - 30;
                drawOrb(x, y, 5, pulse);
            }
        }

        // Горизонтальные "огоньки"
        for (let y = 0; y <= h; y += grid * lineStride) {
            const lineIndex = Math.round(y / grid);
            const mod = lineIndex % 3;
            if (mod === 2) continue;

            if (mod === 1) {
                // справа налево (задержка 2s)
                const p = phase(tSec, PERIOD_RL, 2);
                const x = (1 - p) * (w + 60) - 30;
                drawOrb(x, y, 6, pulse);
            } else {
                // слева направо (mod === 0) (задержка 3s)
                const p = phase(tSec, PERIOD_LR, 3);
                const x = p * (w + 60) - 30;
                drawOrb(x, y, 6, pulse);
            }
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    let raf = 0;
    function tick(now) {
        const tSec = now / 1000;
        render(tSec);
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
        if (current >= QUIZ_QUESTIONS.length) {
            progressEl.textContent = `Готово: ${QUIZ_QUESTIONS.length} вопросов`;
            questionEl.textContent = 'Тест завершён. Отличная работа!';
            optionsEl.innerHTML = '';
            feedbackEl.innerHTML = `<div class="ok"><strong>Результат:</strong> ты прошла мини‑тест по SDLC. Дальше добавим вопросы по HTTP, баг‑репортам, типам тестирования и собесу.</div>`;
            nextBtn.classList.add('hidden');
            return;
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
        // event.target — элемент, по которому кликнули
        // Если кликнули по самому modal (тёмному фону), а не по content — закрываем
        if (event.target === bugReportModal) {
            logStep('Клик по фону модального окна — закрываем окно.');
            closeModal();
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

    popup.classList.remove('hidden');

    setTimeout(() => {
        popup.classList.add('hidden');
    }, 5000);
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
            const target = document.querySelector(targetSelector);
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
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
        <button type="button" class="btn btn-secondary btn-download">
            Скачать TXT
        </button>
    `;

    bugReportsList.appendChild(card);

    // Вешаем обработчик на кнопку скачивания TXT
    const downloadBtn = card.querySelector('.btn-download');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            logStep(`Нажата кнопка "Скачать TXT" для багрепорта "${report.title}".`);
            downloadReportAsTxt(report);
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

/**
 * Обработка отправки формы багрепорта
 */
if (bugReportForm) {
    bugReportForm.addEventListener('submit', function (event) {
        event.preventDefault(); // не даём браузеру перезагружать страницу

        // Достаём значения полей
        const title = bugReportForm.elements['title'].value.trim();
        const steps = bugReportForm.elements['steps'].value.trim();
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

