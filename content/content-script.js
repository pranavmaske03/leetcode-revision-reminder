
const script = document.createElement('script');
script.src = chrome.runtime.getURL('content/injected.js');
script.type = 'text/javascript';
(document.head || document.documentElement).appendChild(script);

let currentSession = {
    slug: null,
    wrongAttempts: 0,
    solutionViewed: false,
    hintsUsed: 0,
    activeMinutes: 0
};

let activeTimer = null;

function loadSession(slug) {
    const saved = sessionStorage.getItem(`lre_session_${slug}`);
    if (saved) {
        currentSession = JSON.parse(saved);
        console.log('[LRE] Restored session from storage:', currentSession);
    } else {
        currentSession = { 
            slug, 
            wrongAttempts: 0, 
            solutionViewed: false,
            hintsUsed: 0, 
            activeMinutes: 0 
        };
        saveSession();
        console.log('[LRE] Started new session for:', slug);
    }
}

function saveSession() {
    if (currentSession.slug) {
        sessionStorage.setItem(`lre_session_${currentSession.slug}`, JSON.stringify(currentSession));
    }
}

function clearSession() {
    if (currentSession.slug) {
        sessionStorage.removeItem(`lre_session_${currentSession.slug}`);
    }
    currentSession = { 
        slug: null, 
        wrongAttempts: 0, 
        solutionViewed: false, 
        hintsUsed: 0, 
        activeMinutes: 0 
    };
}

function extractDifficultyFromDOM() {
    const elements = document.querySelectorAll('[class*="difficulty"], [class*="Difficulty"]');
    for (const el of elements) {
        const text = el.textContent.trim();
        if (['Easy', 'Medium', 'Hard'].includes(text)) return text;
    }

    const allElements = document.querySelectorAll('span, div');
    for (const el of allElements) {
        const text = el.textContent.trim();
        if (['Easy', 'Medium', 'Hard'].includes(text)) return text;
    }
    return 'Unknown';
}

window.addEventListener('LEETCODE_SIGNAL', (event) => {
    const { type, slug } = event.detail;

    if (!slug || slug !== currentSession.slug) return;

    if (type === 'WRONG_SUBMISSION') {
        currentSession.wrongAttempts += 1;
        saveSession();
        console.log(`[LRE] Wrong attempt! Total: ${currentSession.wrongAttempts}`);
    }
    else if (type === 'RUN_CODE') {
        console.log('[LRE] Run Code executed (No penalty).');
    }
    else if (type === 'ACCEPTED_SUBMISSION') {
        console.log('[LRE] ACCEPTED! Forwarding session to Service Worker.');

        const difficulty = extractDifficultyFromDOM();
        sendMessage('RECORD_SOLVE', {
            ...currentSession,
            difficulty
        });
        clearSession();
        stopActiveTimeTracker();
    }
});

let lastUrl = location.href;

const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        onUrlChange(location.href);
    }
});

function startObserver() {
    observer.observe(document.body, { childList: true, subtree: true });
    onUrlChange(location.href);
}

if (document.body) {
    startObserver();
} else {
    document.addEventListener('DOMContentLoaded', startObserver);
}

function onUrlChange(url) {
    const problemMatch   = url.match(/\/problems\/([^/]+)\//);
    const solutionMatch  = url.match(/\/problems\/([^/]+)\/solutions\/\d+\//);
    const editorialMatch = url.match(/\/problems\/([^/]+)\/editorial\//);
    const ownSubmission  = url.match(/\/problems\/([^/]+)\/submissions\/\d+\//);

    // If user opens a solution, submission or editorial, penalize
    if (solutionMatch || editorialMatch || ownSubmission) {
        const slug = (solutionMatch || editorialMatch || ownSubmission)[1];
        if (currentSession.slug === slug) {
            currentSession.solutionViewed = true;
            currentSession.hintsUsed += 1;
            saveSession();
            console.log(`[LRE] Solution/Editorial viewed! hintsUsed: ${currentSession.hintsUsed}, solutionViewed: true`);
        }
        return;
    }

    if (problemMatch) {
        const slug = problemMatch[1];

        if (currentSession.slug && currentSession.slug !== slug) {
            stopActiveTimeTracker();
        }
        loadSession(slug);
        startActiveTimeTracker(slug);
    }
}

function startActiveTimeTracker(slug) {
    stopActiveTimeTracker();

    activeTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && currentSession.slug === slug) {
            currentSession.activeMinutes += 0.5;
            saveSession();
        }
    }, 30000);
}

function stopActiveTimeTracker() {
    if (activeTimer) {
        clearInterval(activeTimer);
        activeTimer = null;
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        stopActiveTimeTracker();
    } else if (document.visibilityState === 'visible' && currentSession.slug) {
        startActiveTimeTracker(currentSession.slug);
    }
});

function sendMessage(type, payload, retries = 3) {
    if (chrome.runtime?.id === undefined) {
        console.warn('[LRE] Extension context dead, dropping message.');
        return;
    }

    chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn(`[LRE] SW error, retries left: ${retries}`);
            if (retries > 0) {
                setTimeout(() => sendMessage(type, payload, retries - 1), 500);
            }
        } else {
            console.log('[LRE] SW response:', response);
        }
    });
}

function sendMessageAsync(type, payload) {
    return new Promise((resolve) => {
        if (chrome.runtime?.id === undefined) {
            console.warn('[LRE] Extension context dead.');
            resolve(null);
            return;
        }
        chrome.runtime.sendMessage({ type, payload }, resolve);
    });
}

async function maybeRunBootstrap() {
    const meta = await sendMessageAsync('GET_USER_META', {});

    if(!meta || meta.bootstrapDone) {
        console.log('[LRE] Bootstrap already done, skipping.');
        return;
    }

    console.log('[LRE] First install - Running bootstrap...');

    try {
        const bootstrapUrl = chrome.runtime.getURL('engine/bootstrap.js');
        const {
            scrapeAcceptedSubmissions,
            fetchDifficultiesForSlugs,
            generateBootstrapRecords,
            spreadBootstrapSchedule,
        } = await import(bootstrapUrl);

        const submissions = await scrapeAcceptedSubmissions();

        if(submissions.length === 0) {
            console.log('[LRE] No submissions found, marking bootstrap done.');
            await sendMessageAsync('BOOTSTRAP_DATA', { records: [] });
            return;
        }

        const slugs = submissions.map(s => s.slug);
        const difficultyMap = await fetchDifficultiesForSlugs(slugs);
        const records = generateBootstrapRecords(submissions, difficultyMap);
        const todayMidnight = getTodayMidnight();
        const scheduled = spreadBootstrapSchedule(records, todayMidnight);

        const result = await sendMessageAsync('BOOTSTRAP_DATA', { records: scheduled });
        console.log(`[LRE] Bootstrap complete — ${result?.imported ?? 0} problems imported.`);
    } catch (error) {
        console.error('[LRE] Bootstrap failed:', error);
    }
}

function getTodayMidnight() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

maybeRunBootstrap();