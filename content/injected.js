
(function () {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        const cloned   = response.clone();

        try {
            const url  = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            const body = typeof args[1]?.body === 'string' ? args[1].body : '';

            if (url.includes('/graphql')) {
                const data = await cloned.json();
                handleGraphQL(body, data);
            }
            if (url.includes('/submissions/detail/') && url.includes('/check/')) {
                const data = await cloned.json();
                handleSubmissionCheck(data);
            }
        } catch (err) {
            
        }
        return response;
    };

    function handleGraphQL(body, data) {
        try {
            const parsed = JSON.parse(body);
            const op = parsed?.operationName;

            if (op && op.toLowerCase().includes('hint')) {
                const slug = getSlugFromUrl();
                if (slug) post('HINT_USED', { slug });
            }
            if (op === 'questionData' && data?.data?.question) {
                const q    = data.data.question;
                const slug = q.titleSlug;
                const name = q.title;
                const diff = q.difficulty;
                post('PROBLEM_META', { slug, name, difficulty: diff });
            }
        } catch (err) {}
    }

    function handleSubmissionCheck(data) {
        const slug = getSlugFromUrl();
        if (!slug) return;

        if (data.status_code === 10) {
            post('ACCEPTED_SUBMISSION', { slug });
        } else if (data.status_code !== undefined) {
            post('WRONG_SUBMISSION', { slug });
        }
    }
    
    function getSlugFromUrl() {
        const match = location.pathname.match(/\/problems\/([^/]+)\//);
        return match ? match[1] : null;
    }
    function post(type, payload) {
        window.postMessage({ type: 'LRE_' + type, payload }, '*');
    }

})();