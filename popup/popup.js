
const STRIPE_COLOR = {
    Easy:   'var(--easy)',
    Medium: 'var(--medium)',
    Hard:   'var(--hard)',
};

document.addEventListener('DOMContentLoaded', () => {
    renderDate();
    loadData();
});

function renderDate() {
    const el  = document.getElementById('dateText');
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const dd  = now.getDate().toString().padStart(2, '0');
    const mon = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    el.textContent = `${day} ${dd} ${mon} ${now.getFullYear()}`;
}

async function loadData() {
    try {
        const [queueData, stats] = await Promise.all([
            sendMessage('GET_DAILY_QUEUE'),
            sendMessage('GET_STATS'),
        ]);
        renderStats(stats);
        renderQueue(queueData);
    } catch (err) {
        console.error('[LRE Popup]', err);
        showEmpty('Could not load queue. Try reopening.');
    }
}

function renderStats(stats) {
    if (!stats) return;
    const el = document.getElementById('totalNum');
    if (el) el.textContent = stats.total ?? '–';
}

function renderQueue(queueData) {
    hideLoading();
    const items = queueData?.queue ?? [];

    if (items.length === 0) {
        showEmpty();
        return;
    }

    const badge = document.getElementById('queueBadge');
    if (badge) {
        badge.textContent = `${items.length} due today`;
        badge.classList.add('visible');
    }

    const list = document.getElementById('queueList');
    items.forEach((item, i) => list.appendChild(buildCard(item, i + 1)));
    list.classList.remove('hidden');
}

function buildCard(item, rank) {
    const li = document.createElement('li');
    li.className = 'problem-card';
    if (item.isCompleted) li.classList.add('is-solved');
    li.style.animationDelay = `${(rank - 1) * 60}ms`;

    const stripe = document.createElement('div');
    stripe.className = 'card-stripe';
    stripe.style.background = STRIPE_COLOR[item.difficulty] ?? 'var(--accent)';
    li.appendChild(stripe);

    const a = document.createElement('a');
    a.className = 'card-link';
    a.href      = `https://leetcode.com/problems/${item.slug}/`;
    a.target    = '_blank';
    a.rel       = 'noopener noreferrer';

    const rankEl = document.createElement('span');
    rankEl.className   = 'card-rank';
    rankEl.textContent = rank.toString().padStart(2, '0');

    const body = document.createElement('div');
    body.className = 'card-body';

    const nameEl = document.createElement('div');
    nameEl.className   = 'card-name';
    nameEl.textContent = slugToTitle(item.name || item.slug);

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const diff = item.difficulty || 'Medium';
    const badge = document.createElement('span');
    badge.className   = `diff-badge ${diff.toLowerCase()}`;
    badge.textContent = diff;
    meta.appendChild(badge);

    body.appendChild(nameEl);
    body.appendChild(meta);

    const overdueEl = document.createElement('span');
    overdueEl.className   = `card-overdue ${overdueClass(item.daysOverdue)}`;
    overdueEl.textContent = formatOverdue(item.daysOverdue);

    const solvedMark = document.createElement('div');
    solvedMark.className = 'card-solved-mark';
    solvedMark.innerHTML = `<svg viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>`;

    a.appendChild(rankEl);
    a.appendChild(body);
    a.appendChild(overdueEl);
    a.appendChild(solvedMark);
    li.appendChild(a);

    return li;
}

function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
}

function showEmpty(msg) {
    hideLoading();
    const panel = document.getElementById('emptyState');
    panel.classList.remove('hidden');
    if (msg) {
        const el = panel.querySelector('.state-msg');
        if (el) el.textContent = msg;
    }
}

function slugToTitle(slug) {
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function overdueClass(days) {
    if (days >= 5) return 'hot';
    if (days >= 2) return 'warm';
    return '';
}

function formatOverdue(days) {
    const d = Math.floor(days);
    if (d <= 0) return 'today';
    if (d === 1) return '+1 day';
    return `+${d} days`;
}

function sendMessage(type, payload = {}) {
    return new Promise((resolve, reject) => {
        if (!chrome.runtime?.id) {
            reject(new Error('Extension context invalidated'));
            return;
        }
        chrome.runtime.sendMessage({ type, payload }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}