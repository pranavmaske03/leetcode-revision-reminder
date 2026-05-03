
// 1. Real struggle score - formula - 1
export function calculateStruggleScore({ wrongAttempts, solutionViewed, hintsUsed, activeMinutes }) {
    const attemptScore = 1 - Math.exp(-0.6 * wrongAttempts);
    const solutionScore = solutionViewed ? 1 : 0;
    const hintsScore = Math.min(1, hintsUsed * 0.5);
    const timeScore = Math.min(1, Math.sqrt(activeMinutes / 60));

    return (
        0.35 * attemptScore +
        0.37 * solutionScore +
        0.12 * hintsScore +
        0.08 * timeScore + 
        0.08 * attemptScore * timeScore
    );
}

//2. Bootstrap score - formula - 2
export function calculateBootstrapScore({ difficulty, daysSinceSolved }) {
    const baseScores = { Easy: 0.45, Medium: 0.62, Hard: 0.30 };
    const baseScore = baseScores[difficulty] ?? 0.55;
    const recency = Math.min(1, daysSinceSolved / 60);

    return baseScore * (0.35 + 0.65 * recency);
}

//3. Revision Interval - formula - 3
export function calculateInterval(score, difficulty, memoryFactor) {
    const difficultyMod = { Easy: 1.3, Medium: 0.8, Hard: 1.1 };
    const mod = difficultyMod[difficulty] ?? 0.8;
    const base = Math.round(45 * (1 - score) + 4);
    const interval = Math.round(base * mod * memoryFactor);

    return Math.max(4, Math.min(45, interval));
}

//4. Priority Score - formula - 4
export function calculatePriority(score, nextReview, difficulty, reviewCount) {
    const overdueDays = Math.max(0, (Date.now() - nextReview) / 864e5);
    const overdueMultiplier = Math.min(2.5, 1 + 0.15 * overdueDays);
    const difficultyWeight = { Easy: 0.85, Medium: 1.10, Hard: 1.00 };
    const weight = difficultyWeight[difficulty] ?? 1.0;
    const freshBonus = reviewCount === 0 ? 1.10 : 1.00;

    return score * overdueMultiplier * weight * freshBonus;
}

//5. Updated Score - formula - 5
export function calculateUpdatedScore(oldScore, newScore, dataType) {
    if(dataType === 'bootstrap') {
        return newScore;
    }
    return (0.7 * oldScore) + (0.3 * newScore);
}

//6. Memory Factor Adjustment - formula - 6
export function calculateMemoryFactor(memoryFactor, oldScore, newScore) {
    let updated = memoryFactor;

    if(newScore < oldScore - 0.2) updated = memoryFactor * 1.1;
    if(newScore > oldScore + 0.2) updated = memoryFactor * 0.9;

    return Math.max(0.5, Math.min(1.5, updated));
}