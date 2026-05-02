import { calculateBootstrapScore } from "./score.js"
import { makeProblemRecord } from "./storage.js"

export async function scrapeAcceptedSubmissions() {
    const MAX_UNIQUE = 50; 
    const MAX_SUBMISSIONS = 100;
    const LIMIT = 20;           
    let offset = 0;
    
    const seenSlugs = new Map();
    console.log('[LRE Bootstrap] Starting submission scrape...');

    while (offset < MAX_SUBMISSIONS) {
        console.log(`[LRE Bootstrap] Fetching submissions at offset ${offset}...`);

        let page;
        try {
            page = await fetchSubmissionPage(offset, LIMIT);
        } catch (err) {
            console.warn(`[LRE Bootstrap] Page at offset ${offset} failed:`, err.message);
            offset += LIMIT;
            continue;
        }
        if (!page || page.length === 0) {
            console.log('[LRE Bootstrap] Empty page — history exhausted.');
            break;
        }

        for (const sub of page) {
            if (sub.statusDisplay !== 'Accepted') continue;
            if (seenSlugs.has(sub.titleSlug)) continue;

            seenSlugs.set(sub.titleSlug, {
                slug: sub.titleSlug,
                lastSolved: sub.timestamp * 1000,
            });
            if (seenSlugs.size >= MAX_UNIQUE) {
                console.log(`[LRE Bootstrap] Reached ${MAX_UNIQUE} unique problems — stopping.`);
                return Array.from(seenSlugs.values());
            }
        }
        console.log(`[LRE Bootstrap] Page done. Unique accepted so far: ${seenSlugs.size}`);
        if (page.length < LIMIT) {
            console.log('[LRE Bootstrap] Last page reached — history exhausted.');
            break;
        }
        offset += LIMIT;
        await sleep(500);
    }

    const result = Array.from(seenSlugs.values());
    console.log(`[LRE Bootstrap] Scrape complete. Total unique accepted: ${result.length}`);
    return result;
}

export async function fetchDifficultiesForSlugs(slugs) {
    const BATCH_SIZE = 5;
    const difficultyMap = new Map();
    console.log(`[LRE Bootstrap] Fetching difficulty for ${slugs.length} slugs...`);

    for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
        const batch = slugs.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
            batch.map(slug => fetchDifficultyForSlug(slug))
        );
        for (const { slug, difficulty } of batchResults) {
            difficultyMap.set(slug, difficulty);
        }
        if (i + BATCH_SIZE < slugs.length) await sleep(300);
    }
    console.log('[LRE Bootstrap] Difficulty fetch complete.');
    return difficultyMap;
}

async function fetchDifficultyForSlug(slug) {
    const query = `
        query questionDifficulty($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                difficulty
            }
        }
    `;

    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrftoken': getCsrfToken(),
            },
            body: JSON.stringify({
                query,
                variables: { titleSlug: slug }
            })
        });
        if (!response.ok) {
            console.warn(`[LRE Bootstrap] HTTP ${response.status} for "${slug}" — using Medium fallback`);
            return { slug, difficulty: 'Medium' };
        }

        const data = await response.json();
        const difficulty = data?.data?.question?.difficulty || 'Medium';
        return { slug, difficulty };
    } catch (error) {
        console.warn(`[LRE Bootstrap] Error fetching difficulty for slug "${slug}":`, error);
        return { slug, difficulty: 'Medium' };
    }
}

export function generateBootstrapRecords(submissions, difficultyMap) {
    const now = Date.now();
    const records = [];

    for (const sub of submissions) {
        const difficulty = difficultyMap.get(sub.slug) || 'Medium';
        const daysSinceSolved = (now - sub.lastSolved) / 864e5;
        const score = calculateBootstrapScore({ difficulty, daysSinceSolved });

        const record = makeProblemRecord(sub.slug, sub.slug, difficulty, {
            score,
            dataType:   'bootstrap',
            lastSolved: sub.lastSolved,
            nextReview: null,
        });
        records.push(record);
    }
    console.log(`[LRE Bootstrap] Generated ${records.length} problem records.`);
    return records;
}

export function spreadBootstrapSchedule(records, todayMidnight) {
    const MAX_PER_DAY = 5;
    const ONE_DAY_MS = 864e5;
    const sorted = [...records].sort((a, b) => b.score - a.score);

    return sorted.map((record, index) => {
        const dayOffset  = Math.floor(index / MAX_PER_DAY);
        const nextReview = todayMidnight + dayOffset * ONE_DAY_MS;
        return { ...record, nextReview };
    });
}

async function fetchSubmissionPage(offset, limit) {
    const query = `
        query submissionList($offset: Int!, $limit: Int!) {
            submissionList(offset: $offset, limit: $limit) {
                submissions {
                    id
                    statusDisplay
                    timestamp
                    titleSlug
                }
            }
        }
    `;
    const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrftoken': getCsrfToken(),
        },
        body: JSON.stringify({ query, variables: { offset, limit } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return data?.data?.submissionList?.submissions ?? [];
}

function getCsrfToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}