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

