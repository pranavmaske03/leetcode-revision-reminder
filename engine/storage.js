const DEFAULT_USER_META = {
    bootstrapDone: false,
    memoryFactor: 1.0,
}

function chromeGet(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(result);
            }
        });
    });
}

function chromeSet(items) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(items, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError.message);
            } else {
                resolve();
            }
        });
    });
}

export async function initStorage() {
    const existing = await chromeGet(['problems', 'userMeta', 'dailyQueue']);
    const updates = {};

    if(!existing.problems) updates.problems = {};
    if(!existing.userMeta) updates.userMeta = { ...DEFAULT_USER_META };
    if(!existing.dailyQueue) updates.dailyQueue = null;

    if(Object.keys(updates).length > 0) {
        await chromeSet(updates);
    }
}

export async function getProblems() {
    const result = await chromeGet(['problems']);
    return result.problems || {};
}

export async function getUserMeta() {
    const { userMeta } = await chromeGet(['userMeta']);
    return userMeta || { ...DEFAULT_USER_META };
}

export async function getDailyQueue() {
    const { dailyQueue } = await chromeGet(['dailyQueue']);
    return dailyQueue || null;
}

export async function saveProblems(problems) {
    await chromeSet({ problems });
}

export async function saveUserMeta(meta) {
    await chromeSet({ userMeta: meta });
}

export async function saveDailyQueue(queue) {
    await chromeSet({ dailyQueue: queue });
}

export async function upsertProblem(slug, fields) {
    const problems = await getProblems();
    problems[slug] = { ...problems[slug], ...fields };
    await saveProblems(problems);
}

export function makeProblemRecord(slug, name, difficulty, overrides = {}) {
    return {
        slug,
        name,
        difficulty,
        score: 0,
        dataType: 'bootstrap',
        lastSolved: null,
        nextReview: null,
        reviewCount: 0,
        interval: 14,
        ...overrides,
    };
}