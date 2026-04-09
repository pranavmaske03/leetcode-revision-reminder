import { calculatePriority } from "./score";

export function buildDailyQueue(problems, userMeta, todayMidnight) { 
    const now = Date.now();

    const due = Object.values(problems).filter(p => {
        if(!p.nextReview) return false;
        return p.nextReview <= now;
    });

    const scored = due.map(p => ({
        slug: p.slug,
        name: p.name,
        difficulty: p.difficulty,
        score: p.score,
        daysOverdue: Math.max(0, (now - p.nextReview) / 864e5),
        priority: calculatePriority(p.score, p.nextReview, p.difficulty, p.reviewCount),
        isCompleted: false
    }));

    scored.sort((a, b) => b.priority - a.priority);

    return scored.slice(0, 5);
}