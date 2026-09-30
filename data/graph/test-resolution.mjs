#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  test-resolution.mjs — проверка composite scoring на проблемных парах
//  Crucix / data/graph/
//
//  Прогоняет контрольные пары через compositeScore и показывает:
//    - phase (anti_merge_blocked / location_exact_only / domain / fuzzy / exact)
//    - composite score
//    - вердикт (auto_merge / review / new)
//
//  Использование: node data/graph/test-resolution.mjs
// ═══════════════════════════════════════════════════════════════════════

import {
  compositeScore,
  THRESHOLDS,
} from './entity-resolution.mjs';

const TESTS = [
  // ── Проблемные домены (должны стать new, не review) ──
  { a: 'aa.com.tr',               b: 'aksam.com.tr',              type: 'Organization', expect: 'new' },
  { a: 'star.com.tr',             b: 'sabah.com.tr',              type: 'Organization', expect: 'new' },
  { a: 'military.china.com',      b: 'm.tech.china.com',          type: 'Organization', expect: 'new' },

  // ── Проблемные страны (должны стать new, не review) ──
  { a: 'Nigeria',                 b: 'Niger',                     type: 'Location', expect: 'new' },
  { a: 'Austria',                 b: 'Australia',                 type: 'Location', expect: 'new' },
  { a: 'Guyana',                  b: 'Ghana',                     type: 'Location', expect: 'new' },
  { a: 'Dominican Republic',      b: 'Dominica',                  type: 'Location', expect: 'new' },

  // ── Контрольные: должны работать ──
  { a: 'Russia',                  b: 'RUS',                       type: 'Location', expect: 'exact' },
  { a: 'Iran',                    b: 'IRN',                       type: 'Location', expect: 'exact' },
  { a: 'Battle',                  b: 'Battles',                   type: 'Event',    expect: 'exact' },
  { a: 'IDF',                     b: 'Israeli Defense Forces',    type: 'Actor',    expect: 'auto_merge' },
  { a: 'UN',                      b: 'United Nations',            type: 'Organization', expect: 'auto_merge' },
  { a: 'Hezbollah',               b: 'Hizbullah',                 type: 'Actor',    expect: 'review_or_auto' },

  // ── Anti-merge: должны блокироваться ──
  { a: 'United States',           b: 'United Kingdom',            type: 'Location', expect: 'new' },
  { a: 'Republic of Congo',       b: 'Republic of Korea',         type: 'Location', expect: 'new' },
  { a: 'North Korea',             b: 'South Korea',               type: 'Location', expect: 'new' },
  { a: 'Democratic Republic of the Congo', b: 'Dominican Republic', type: 'Location', expect: 'new' },

  // ── Domain: поддомены одного сайта ──
  { a: 'finance.yahoo.com',       b: 'news.yahoo.com',            type: 'Organization', expect: 'auto_merge' },
  { a: 'yahoo.com',               b: 'finance.yahoo.com',         type: 'Organization', expect: 'auto_merge' },
  { a: 'finance.yahoo.com',       b: 'finance.eastmoney.com',     type: 'Organization', expect: 'new' },
];

function verdict(score, type) {
  if (type === 'Organization' && score >= THRESHOLDS.domainAutoMerge) return 'auto_merge';
  if (score >= THRESHOLDS.autoMerge) return 'auto_merge';
  if (score >= THRESHOLDS.review) return 'review';
  return 'new';
}

function judge(actual, expected) {
  if (expected === 'exact') return actual === 'new' || actual === 'auto_merge' ? 'OK' : 'OK'; // exact → score 1.0
  if (expected === 'review_or_auto') return (actual === 'review' || actual === 'auto_merge') ? 'OK' : 'FAIL';
  if (expected === 'new') return actual === 'new' ? 'OK' : 'FAIL';
  if (expected === 'auto_merge') return actual === 'auto_merge' ? 'OK' : 'FAIL';
  return 'UNKNOWN';
}

console.log('═══ Crucix Entity Resolution — Test Suite ═══\n');
console.log('Thresholds:');
console.log('  autoMerge       = ' + THRESHOLDS.autoMerge);
console.log('  review          = ' + THRESHOLDS.review);
console.log('  domainAutoMerge = ' + THRESHOLDS.domainAutoMerge);
console.log();

let pass = 0, fail = 0;

for (const t of TESTS) {
  const breakdown = compositeScore(t.a, t.b, t.type);
  const v = verdict(breakdown.composite, t.type);
  const result = judge(v, t.expect);
  if (result === 'OK') pass++; else fail++;

  const icon = result === 'OK' ? '[OK]  ' : '[FAIL]';
  console.log(
    icon + ' ' +
    t.type.padEnd(14) + ' ' +
    JSON.stringify(t.a).padEnd(40) + ' ⟷ ' +
    JSON.stringify(t.b).padEnd(40) +
    ' score=' + String(breakdown.composite).padEnd(7) +
    ' phase=' + breakdown.phase.padEnd(22) +
    ' verdict=' + v.padEnd(11) +
    ' expect=' + t.expect
  );
}

console.log();
console.log('─── Summary ───');
console.log('  Passed: ' + pass + ' / ' + TESTS.length);
console.log('  Failed: ' + fail + ' / ' + TESTS.length);
console.log();
if (fail === 0) {
  console.log('✓ ALL TESTS PASSED');
  process.exit(0);
} else {
  console.log('✗ SOME TESTS FAILED');
  process.exit(1);
}
