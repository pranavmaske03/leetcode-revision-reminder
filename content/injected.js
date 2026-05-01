
(function () {
    console.log('[LRE] injected.js loaded — fetch hook active');

    const originalFetch = window.fetch;
    let pendingSubmissionId = null;

    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
        if (!url) return response;

        if (url.includes('/submit/')) {
            response.clone().json().then(data => {
                if (data.submission_id) {
                    pendingSubmissionId = data.submission_id;
                    console.log(`[LRE] Submit intent captured. ID: ${pendingSubmissionId}`);
                }
            }).catch(() => {});
        }

        if (url.includes('/check/')) {
            response.clone().json().then(data => {
                if (data.state === 'PENDING' || data.state === 'STARTED') return;

                const slug = getSlugFromUrl();
                if (!slug) {
                    console.warn('[LRE] Could not determine problem slug from URL.');
                    return;
                }

                if (pendingSubmissionId === null) {
                    console.log('[LRE] Run Code completed (no /submit/ seen). No penalty.');
                    sendSignal('RUN_CODE', { slug });
                    return;
                }

                console.log(`[LRE] Submission result arrived for ID: ${pendingSubmissionId}`);
                pendingSubmissionId = null;

                if (data.status_code === 10) {
                    console.log('[LRE] Accepted Submission detected!');
                    sendSignal('ACCEPTED_SUBMISSION', { slug });
                } else if (data.status_code !== undefined) {
                    console.log(`[LRE] Failed Submission (Code: ${data.status_code})`);
                    sendSignal('WRONG_SUBMISSION', { slug });
                }
            }).catch(() => {});
        }
        return response;
    };

    function getSlugFromUrl() {
        const match = location.pathname.match(/\/problems\/([^/]+)/);
        return match ? match[1] : null;
    }

    function sendSignal(type, payload) {
        window.dispatchEvent(new CustomEvent('LEETCODE_SIGNAL', {
            detail: {
                type,
                timestamp: Date.now(),
                ...payload
            }
        }));
    }
})();