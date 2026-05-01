import { 
    initStorage, getProblems, getUserMeta, getDailyQueue, 
    saveDailyQueue, saveUserMeta, upsertProblem, 
    makeProblemRecord 
} from "../engine/storage.js";
import { 
    calculateStruggleScore, calculateInterval, calculateUpdatedScore, 
    calculateMemoryFactor 
} from "../engine/score.js";
import { buildDailyQueue } from "../engine/queue.js";

chrome.runtime.onInstalled.addListener(async (details) => {
    await initStorage();
    if(details.reason === 'install') {
        console.log('[LRE] Storage initialized for first time');
    }
    chrome.alarms.create('dailyQueueRefresh', { periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.get('dailyQueueRefresh', (alarm) => {
        if(!alarm) chrome.alarms.create('dailyQueueRefresh', { periodInMinutes: 60 });
    });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if(alarm.name === 'dailyQueueRefresh') await maybeRefreshDailyQueue();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch(err => {
        console.error('[LRE] Error handling message:', err);
        sendResponse({ ok: false, error: err.message });
    });
    return true
});

async function handleMessage({ type, payload }) {
    console.log('[LRE] Worker received action:', type);
    switch(type) {
        case 'RECORD_SOLVE':    return await onRecordSolve(payload);
        case 'BOOTSTRAP_DATA':  return await onBootstrapData(payload);
        case 'GET_DAILY_QUEUE': return await getDailyQueue();
        case 'GET_STATS':       return await getStats();
        default:
            return { ok: false, error: 'unknown_type' };
    }
}

async function onRecordSolve(session) {
    const { slug, wrongAttempts, hintsUsed, solutionViewed, activeMinutes, difficulty } = session;

    const problems = await getProblems();
    const meta = await getUserMeta();

    const existing = problems[slug];
    const today = getTodayMidnight();

    if (existing && existing.lastSolved >= today) {
        console.log('[LRE] Already solved today, skipping:', slug);
        return { ok: true, info: 'already_solved_today' };
    }

    const finalDifficulty = (difficulty && difficulty !== 'Unknown')
        ? difficulty
        : (existing?.difficulty || 'Medium');

    const problem = existing || makeProblemRecord(slug, slug, finalDifficulty);
    const sessionSignals = { wrongAttempts, hintsUsed, solutionViewed, activeMinutes };

    const struggleScore = calculateStruggleScore(sessionSignals);
    const oldScore = problem.score ?? 0.5;
    const updatedScore = calculateUpdatedScore(oldScore, struggleScore, problem.dataType || 'real');
    const interval = calculateInterval(updatedScore, finalDifficulty, meta.memoryFactor);
    const newMF = calculateMemoryFactor(meta.memoryFactor, oldScore, struggleScore);


    const now = Date.now();
    const updatedProblem = {
        slug:        problem.slug,
        name:        problem.name,
        difficulty:  finalDifficulty,
        score:       updatedScore,
        dataType:    'real',               
        lastSolved:  now,                 
        nextReview:  now + interval * 864e5, 
        interval,
        reviewCount: (problem.reviewCount || 0) + 1,
    };
    console.log(`[LRE] Saving solve: score=${updatedScore.toFixed(3)}, interval=${interval}d, nextReview in ${interval} days`);

    await upsertProblem(slug, updatedProblem);
    await saveUserMeta({ ...meta, memoryFactor: newMF });
    await forceRefreshDailyQueue();
    return { ok: true };
}

async function onBootstrapData(records) {
    console.log('[LRE] Received bootstrap data for', Object.keys(records).length, 'problems');
    return { ok: true };
}

async function getStats() {
    const problems = await getProblems();
    const total = Object.values(problems);
    const now = Date.now();
    return {
        total:     total.length,
        real:      total.filter(p => p.dataType === 'real').length,
        bootstrap: total.filter(p => p.dataType === 'bootstrap').length,
        dueToday:  total.filter(p => p.nextReview <= now).length,
    };
}

async function maybeRefreshDailyQueue() {
    const existing = await getDailyQueue();
    const todayMidnight = getTodayMidnight();

    if (existing && existing.date === todayMidnight) {
        console.log('[LRE] Queue cache hit for today, skipping rebuild.');
        return;
    }
    await forceRefreshDailyQueue();
}

async function forceRefreshDailyQueue() {
    const problems = await getProblems();
    const meta = await getUserMeta();
    const todayMidnight = getTodayMidnight();
    const queue = buildDailyQueue(problems, meta, todayMidnight);

    await saveDailyQueue({ date: todayMidnight, queue });
    console.log(`[LRE] Daily queue rebuilt: ${queue.length} problem(s) due today.`);
}

function getTodayMidnight() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}