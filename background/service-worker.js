import { initStorage, getProblems, getUserMeta, getDailyQueue, saveDailyQueue, saveProblems, saveUserMeta, upsertProblem, makeProblemRecord } from "../engine/storage.js";
import { calculateStruggleScore, calculateInterval,calculateUpdatedScore, calculateMemoryFactor } from "../engine/score.js";
import { buildDailyQueue } from "../engine/queue.js";

chrome.runtime.onInstalled.addListener(async (details) => {
    if(details.reason === 'install') {
        await initStorage();
        console.log('[LRE] Storage initialised');
    }
    chrome.alarms.create('dailyQueueRefresh', { periodInMinutes: 60 });
    console.log('[LRE] Alarm created for daily queue refresh');
});

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.get('dailyQueueRefresh', (alarm) => {
        if(!alarm) {
            chrome.alarms.create('dailyQueueRefresh', { periodInMinutes: 60 });
        }
    });
    console.log('[LRE] Service worker started and alarm checked');
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if(alarm.name === 'dailyQueueRefresh') await maybeRefreshDailyQueue();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch(err => {
        console.error('[LRE] Error handling message:', err);
        sendResponse({ ok: false, error: err.message });
    });
    return true;
});

async function handleMessage({ type, payload }) {
    switch(type) {
        case 'PROBLEM_OPENED': return onProblemOpened(payload);
        case 'WRONG_SUBMISSION': return onWrongSubmission(payload);
        case 'ACCEPTED_SUBMISSION': return onAcceptedSubmission(payload);
        case 'HINT_USED': return onHintUsed(payload);
        case 'SOLUTION_VIEWED': return onSolutionViewed(payload);
        case 'ACTIVE_TIME_TICK': return onActiveTimeTick(payload);
        case 'BOOTSTRAP_DATA': return onBootstrapData(payload);
        case 'GET_DAILY_QUEUE': return await getDailyQueue();
        case 'GET_STATS': return getStats();
        default:
            return { ok:false, error: 'unknown_type' };
    }
}

async function onProblemOpened({ slug, name, difficulty }) {
    const problems = await getProblems();
    if(!problems[slug]) {
        await upsertProblem(slug, makeProblemRecord(slug, name, difficulty));
    }
    return { ok: true };
}

async function onWrongSubmission({ slug }) {
    const problems = await getProblems();
    if(!problems[slug]) return { ok: false };
    problems[slug].wrongAttempts += 1;
    await saveProblems(problems);
    return { ok: true };
}

async function onAcceptedSubmission({ slug }) {
    const problems = await getProblems();
    const meta = await getUserMeta();
    const problem = problems[slug];
    if(!problem) return { ok: false };
    
    const newScore = calculateStruggleScore(problem);
    const oldScore = problem.score;
    const updated = calculateUpdatedScore(oldScore, newScore, problem.dataType);
    const interval = calculateInterval(updated, problem.difficulty, meta.memoryFactor);
    const newMF = calculateMemoryFactor(meta.memoryFactor, oldScore, newScore);

    problem.score = updated;
    problem.dataType = 'real';
    problem.lastSolved = Date.now();
    problem.nextReview = Date.now() + interval * 864e5;
    problem.interval = interval;
    problem.reviewCount += 1;
    problem.wrongAttempts = 0;
    problem.solutionViewed = false;
    problem.hintsUsed = 0;
    problem.activeMinutes = 0;

    await saveProblems(problems);
    await saveUserMeta({ ...meta, memoryFactor: newMF });
    await maybeRefreshDailyQueue();
    return { ok: true };
}

async function onSolutionViewed({ slug }) {
    await upsertProblem(slug, { solutionViewed: true });
    return { ok: true };
}

async function onHintUsed({ slug }) {
    const problems = await getProblems();
    if(!problems[slug]) return { ok: false };
    problems[slug].hintsUsed += 1;
    await saveProblems(problems);
    return { ok: true };
}

async function onActiveTimeTick({ slug, deltaMinutes }) {
    const problems = await getProblems();
    if(!problems[slug]) return { ok: false };
    problems[slug].activeMinutes += deltaMinutes;
    await saveProblems(problems);
    return { ok: true };
}

async function onBootstrapData(records) {
    console.log('[LRE] Received bootstrap data for', Object.keys(records).length, 'problems');
    return { ok: true };
}

async function getStats() {
    const problems = await getProblems();
    const total = Object.values(problems);
    return {
        total: total.length,
        real: total.filter(p => p.dataType === 'real').length,
        bootstrap: total.filter(p => p.dataType === 'bootstrap').length,
        dueToday: total.filter(p => p.nextReview <= Date.now()).length,
    };
}

async function maybeRefreshDailyQueue() {
    const existing = await getDailyQueue();
    const todayMidNight = getTodayMidnight();

    if (existing && existing.date === todayMidNight) return;

    const problems = await getProblems();
    const meta  = await getUserMeta();
    const queue    = buildDailyQueue(problems, meta, todayMidNight);

    await saveDailyQueue({ date: todayMidNight, queue });
}

function getTodayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}