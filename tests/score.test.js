// tests/score.test.js

import {
  calculateStruggleScore,
  calculateBootstrapScore,
  calculateInterval,
  calculatePriority,
  calculateUpdatedScore,
  calculateMemoryFactor,
} from '../engine/score.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${err.message}`);
    failed++;
  }
}

function expect(actual, expected, tolerance = 0.01) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`expected ${expected}, got ${actual}`);
  }
}

function expectExact(actual, expected) {
  if (actual !== expected) {
    throw new Error(`expected ${expected}, got ${actual}`);
  }
}

// ── Formula 1: Struggle Score ─────────────────────────────────────────────────

console.log('\n📊 calculateStruggleScore');

test('zero struggle — no attempts, no hints, no solution, no time', () => {
  const result = calculateStruggleScore({
    wrongAttempts: 0, solutionViewed: false, hintsUsed: 0, activeMinutes: 0
  });
  expect(result, 0);
});

test('max struggle — many attempts, solution viewed, hints used, long time', () => {
  const result = calculateStruggleScore({
    wrongAttempts: 10, solutionViewed: true, hintsUsed: 4, activeMinutes: 60
  });
  expect(result, 1.0, 0.05);
});

test('typical struggle — 2 attempts, solution viewed, 1 hint, 30 mins', () => {
  const result = calculateStruggleScore({
    wrongAttempts: 2, solutionViewed: true, hintsUsed: 1, activeMinutes: 30
  });
  expect(result, 0.77, 0.05);
});

test('result always between 0 and 1', () => {
  const result = calculateStruggleScore({
    wrongAttempts: 5, solutionViewed: false, hintsUsed: 2, activeMinutes: 45
  });
  if (result < 0 || result > 1) throw new Error(`out of range: ${result}`);
});

// ── Formula 2: Bootstrap Score ────────────────────────────────────────────────

console.log('\n📊 calculateBootstrapScore');

test('Easy problem solved recently — low score', () => {
  const result = calculateBootstrapScore({ difficulty: 'Easy', daysSinceSolved: 5 });
  if (result >= 0.20) throw new Error(`expected low score, got ${result}`);
});

test('Hard problem solved 60 days ago — high score', () => {
  const result = calculateBootstrapScore({ difficulty: 'Hard', daysSinceSolved: 60 });
  expect(result, 0.72, 0.05);
});

test('recency caps at 60 days', () => {
  const at60  = calculateBootstrapScore({ difficulty: 'Medium', daysSinceSolved: 60 });
  const at120 = calculateBootstrapScore({ difficulty: 'Medium', daysSinceSolved: 120 });
  expect(at60, at120, 0.001);
});

// ── Formula 3: Interval ───────────────────────────────────────────────────────

console.log('\n📊 calculateInterval');

test('interval never below 4 days', () => {
  const result = calculateInterval(0.99, 'Easy', 0.5);
  if (result < 4) throw new Error(`below minimum: ${result}`);
});

test('interval never above 45 days', () => {
  const result = calculateInterval(0.0, 'Hard', 1.5);
  if (result > 45) throw new Error(`above maximum: ${result}`);
});

test('higher score = shorter interval', () => {
  const low  = calculateInterval(0.2, 'Medium', 1.0);
  const high = calculateInterval(0.8, 'Medium', 1.0);
  if (low <= high) throw new Error(`low score should give longer interval`);
});

// ── Formula 4: Priority ───────────────────────────────────────────────────────

console.log('\n📊 calculatePriority');

test('overdue problem has higher priority than fresh one', () => {
  const overdue = calculatePriority(0.7, Date.now() - 86400000 * 5, 'Medium', 1);
  const fresh   = calculatePriority(0.7, Date.now() + 86400000 * 5, 'Medium', 1);
  if (overdue <= fresh) throw new Error(`overdue should have higher priority`);
});

test('reviewCount 0 gets fresh bonus', () => {
  const fresh   = calculatePriority(0.7, Date.now(), 'Medium', 0);
  const visited = calculatePriority(0.7, Date.now(), 'Medium', 1);
  if (fresh <= visited) throw new Error(`first-time problem should get bonus`);
});

// ── Formula 5: Updated Score ──────────────────────────────────────────────────

console.log('\n📊 calculateUpdatedScore');

test('bootstrap — always replaced by new score', () => {
  const result = calculateUpdatedScore(0.3, 0.8, 'bootstrap');
  expectExact(result, 0.8);
});

test('real — blended 70/30', () => {
  const result = calculateUpdatedScore(0.6, 0.9, 'real');
  expect(result, 0.69, 0.01);
});

// ── Formula 6: Memory Factor ──────────────────────────────────────────────────

console.log('\n📊 calculateMemoryFactor');

test('forgetting fast — factor decreases', () => {
  const result = calculateMemoryFactor(1.0, 0.3, 0.8);
  if (result >= 1.0) throw new Error(`factor should decrease`);
});

test('retaining well — factor increases', () => {
  const result = calculateMemoryFactor(1.0, 0.8, 0.3);
  if (result <= 1.0) throw new Error(`factor should increase`);
});

test('factor never exceeds 1.5', () => {
  const result = calculateMemoryFactor(1.5, 0.8, 0.1);
  if (result > 1.5) throw new Error(`exceeded max: ${result}`);
});

test('factor never goes below 0.5', () => {
  const result = calculateMemoryFactor(0.5, 0.1, 0.9);
  if (result < 0.5) throw new Error(`below min: ${result}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`  ${passed} passed   ${failed} failed`);
console.log(`${'─'.repeat(40)}\n`);