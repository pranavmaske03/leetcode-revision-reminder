
const script = document.createElement('script');
script.src = chrome.runtime.getURL('content/injected.js');
script.type = 'text/javascript';
(document.head || document.documentElement).appendChild(script);

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
    const problemMatch  = url.match(/\/problems\/([^/]+)\//);
    const solutionMatch = url.match(/\/problems\/([^/]+)\/solutions\/\d+\//);
    const editorialMatch = url.match(/\/problems\/([^/]+)\/editorial\//);
    const ownSubmission  = url.match(/\/problems\/([^/]+)\/submissions\/\d+\//);

    if (ownSubmission) return;

    if (solutionMatch) {
        sendMessage('SOLUTION_VIEWED', { slug: solutionMatch[1] });
        return;
    }

    if (editorialMatch) {
        sendMessage('EDITORIAL_OPENED', { slug: editorialMatch[1] });
        return;
    }

    if (problemMatch) {
        const slug = problemMatch[1];
        sendMessage('PROBLEM_OPENED', { slug, name: slug, difficulty: 'Unknown' });
        startActiveTimeTracker(slug);
        return;
    }
}

let activeTimer = null;
let currentSlug = null;

function startActiveTimeTracker(slug) {
    stopActiveTimeTracker();
    currentSlug = slug;

    activeTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
        sendMessage('ACTIVE_TIME_TICK', { slug: currentSlug, deltaMinutes: 0.5 });
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
    if (document.visibilityState === 'hidden') stopActiveTimeTracker();
    if (document.visibilityState === 'visible' && currentSlug) startActiveTimeTracker(currentSlug);
});

window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data?.type?.startsWith('LRE_')) return;

    const type = event.data.type.replace('LRE_', '');
    const payload = event.data.payload;

    sendMessage(type, payload);
});

function sendMessage(type, payload) {
  chrome.runtime.sendMessage({ type, payload }, (response) => {
    if (chrome.runtime.lastError) {
      // Service worker may be sleeping — not an error, Chrome wakes it on next message
    }
  });
}