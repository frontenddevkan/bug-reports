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
 * Тесты (первые вопросы по SDLC)
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

    const questions = [
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
    ];

    let current = 0;
    let locked = false;

    function showQuestion() {
        locked = false;
        nextBtn.classList.add('hidden');
        feedbackEl.innerHTML = '';
        optionsEl.innerHTML = '';
        const item = questions[current];
        progressEl.textContent = `Вопрос ${current + 1} из ${questions.length}`;
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
        if (current >= questions.length) {
            progressEl.textContent = `Готово: ${questions.length} вопросов`;
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

