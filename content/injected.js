
(function () {
    console.log('[LRE] injected.js loaded — fetch hook active');

    const originalFetch = window.fetch;
    let pendingSubmissionId = null;
    const processedSubmissions = new Set();

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

                const taskName = data.task_name;
                const submissionId = data.submission_id;
                const statusCode = data.status_code;

                if (pendingSubmissionId !== null) {
                    if (processedSubmissions.has(submissionId)) {
                        console.log(`[LRE] Late /check/ poll for ID ${submissionId} — dropped.`);
                        return;
                    }

                    if (taskName === 'judger.judgetask.Judge') {
                        console.log(`[LRE] task_name confirmed: Judge. ID: ${submissionId}`);
                    } else {
                        console.warn(`[LRE] task_name mismatch (got "${taskName}") but /submit/ was seen — proceeding on primary signal.`);
                    }

                    processedSubmissions.add(submissionId);
                    pendingSubmissionId = null;

                    if (statusCode === 10) {
                        console.log('[LRE] Accepted Submission detected!');
                        sendSignal('ACCEPTED_SUBMISSION', { slug });
                    } else {
                        console.log(`[LRE] Wrong Submission (status_code: ${statusCode})`);
                        sendSignal('WRONG_SUBMISSION', { slug });
                    }
                    return;
                }
                if (taskName === 'judger.runcodetask.RunCode') {
                    console.log('[LRE] Run Code completed (no /submit/ seen).');
                    sendSignal('RUN_CODE', { slug });
                    return;
                }
                console.warn(`[LRE] Ambiguous /check/ — no /submit/ seen, task_name is "${taskName}". No signal fired.`);
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