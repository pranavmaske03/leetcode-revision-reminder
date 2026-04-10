// tests/queue.test.js

import { buildDailyQueue } from '../engine/queue.js';

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

const now           = Date.now();
const todayMidnight = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
const yesterday     = now - 86400000;
const tomorrow      = now + 86400000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProblem(slug, overrides = {}) {
  return {
    slug,
    name:         slug,
    difficulty:   'Medium',
    score:        0.5,
    nextReview:   yesterday,
    reviewCount:  1,
    dataType:     'real',
    ...overrides,
  };
}

const userMeta = { memoryFactor: 1.0, bootstrapDone: true };

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n📊 buildDailyQueue');

test('returns empty array when no problems due', () => {
  const problems = {
    'two-sum': makeProblem('two-sum', { nextReview: tomorrow }),
    'add-two-numbers': makeProblem('add-two-numbers', { nextReview: tomorrow }),
  };
  const queue = buildDailyQueue(problems, userMeta, todayMidnight);
  if (queue.length !== 0) throw new Error(`expected 0, got ${queue.length}`);
});

test('returns only due problems', () => {
  const problems = {
    'two-sum':         makeProblem('two-sum',         { nextReview: yesterday }),
    'add-two-numbers': makeProblem('add-two-numbers', { nextReview: tomorrow  }),
  };
  const queue = buildDailyQueue(problems, userMeta, todayMidnight);
  if (queue.length !== 1) throw new Error(`expected 1, got ${queue.length}`);
  if (queue[0].slug !== 'two-sum') throw new Error(`wrong problem returned`);
});

test('never returns more than 5', () => {
  const problems = {};
  for (let i = 0; i < 10; i++) {
    problems[`problem-${i}`] = makeProblem(`problem-${i}`, { nextReview: yesterday });
  }
  const queue = buildDailyQueue(problems, userMeta, todayMidnight);
  if (queue.length > 5) throw new Error(`expected max 5, got ${queue.length}`);
});

test('skips problems with null nextReview', () => {
  const problems = {
    'two-sum': makeProblem('two-sum', { nextReview: null }),
  };
  const queue = buildDailyQueue(problems, userMeta, todayMidnight);
  if (queue.length !== 0) throw new Error(`null nextReview should be skipped`);
});

test('sorted by priority — higher priority first', () => {
  const problems = {
    'easy-fresh': makeProblem('easy-fresh', {
      score: 0.3, nextReview: yesterday, difficulty: 'Easy', reviewCount: 1
    }),
    'medium-overdue': makeProblem('medium-overdue', {
      score: 0.8, nextReview: now - 86400000 * 7, difficulty: 'Medium', reviewCount: 1
    }),
  };
  const queue = buildDailyQueue(problems, userMeta, todayMidnight);
  if (queue[0].slug !== 'medium-overdue') throw new Error(`wrong order: ${queue[0].slug} should be medium-overdue`);
});

test('queue items have correct shape', () => {
  const problems = {
    'two-sum': makeProblem('two-sum'),
  };
  const queue = buildDailyQueue(problems, userMeta, todayMidnight);
  const item  = queue[0];
  const keys  = ['slug', 'name', 'difficulty', 'score', 'daysOverdue', 'priority', 'isCompleted'];
  for (const key of keys) {
    if (!(key in item)) throw new Error(`missing key: ${key}`);
  }
});

test('isCompleted always false on fresh queue', () => {
  const problems = { 'two-sum': makeProblem('two-sum') };
  const queue    = buildDailyQueue(problems, userMeta, todayMidnight);
  if (queue[0].isCompleted !== false) throw new Error(`isCompleted should be false`);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`  ${passed} passed   ${failed} failed`);
console.log(`${'─'.repeat(40)}\n`);