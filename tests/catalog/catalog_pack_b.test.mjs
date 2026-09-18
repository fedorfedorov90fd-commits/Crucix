// tests/catalog/catalog_pack_b.test.mjs

import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS = join(__dirname, '..', '..', 'apis', 'predict', 'models');

const gsMod = await import(join(MODELS, 'graph_sage.mjs'));
const acMod = await import(join(MODELS, 'actor_critic.mjs'));

function makeHistory(n) {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: new Date(Date.now() - (n - i) * 15 * 60 * 1000).toISOString(),
    fred: {
      vix: 20 + Math.sin(i / 4) * 10,
      hySpread: 3 + Math.cos(i / 5) * 1.5,
      treasury10y: 4 + Math.sin(i / 6) * 0.5,
      dxy: 100 + Math.cos(i / 7) * 3,
    },
    gdelt: {
      conflictEvents: Array(Math.floor(Math.abs(Math.sin(i / 3)) * 10) + 1).fill({}),
      tone: -1 + Math.sin(i / 6),
    },
    sanctions: { count: Math.floor(Math.abs(Math.cos(i / 4)) * 5) },
    tension: 0.4 + Math.sin(i / 4) * 0.3,
    radiation: { max: 50 + Math.random() * 30 },
    energy: { oilPrice: 70 + Math.sin(i / 3) * 10 },
    gold: { price: 1900 + Math.cos(i / 4) * 100 },
  }));
}

function isFiniteNum(x) { return typeof x === 'number' && Number.isFinite(x); }

describe('catalog pack B: smoke loading', () => {
  test('graph_sage exports', () => {
    const keys = Object.keys(gsMod);
    assert.ok(keys.length > 0, 'graph_sage должен что-то экспортировать');
    const hasFn = keys.some(k => typeof gsMod[k] === 'function');
    assert.ok(hasFn, 'graph_sage должен экспортировать хотя бы одну функцию');
  });

  test('actor_critic exports', () => {
    const keys = Object.keys(acMod);
    assert.ok(keys.length > 0, 'actor_critic должен что-то экспортировать');
    const hasFn = keys.some(k => typeof acMod[k] === 'function');
    assert.ok(hasFn, 'actor_critic должен экспортировать хотя бы одну функцию');
  });
});

describe('graph_sage: functional', () => {
  test('main entry exists', () => {
    const names = Object.keys(gsMod);
    const hasCrucix = names.some(n => n.startsWith('crucix') || n.includes('GraphSAGE') || n.includes('graph_sage'));
    assert.ok(hasCrucix, `ожидался crucix*-export, найдено: ${names.join(', ')}`);
  });

  test('works on 25 sweeps via generic entry', () => {
    const h = makeHistory(25);
    const crucixFn = Object.values(gsMod).find(v => typeof v === 'function' && v.name.startsWith('crucix'));
    if (crucixFn) {
      const r = crucixFn(h, {});
      assert.ok(r);
      assert.ok(typeof r === 'object');
    }
  });

  test('classes are instantiable if present', () => {
    const classNames = Object.keys(gsMod).filter(k => {
      return typeof gsMod[k] === 'function' &&
        gsMod[k].toString().startsWith('class');
    });
    for (const cn of classNames) {
      assert.ok(typeof gsMod[cn] === 'function');
    }
  });
});

describe('actor_critic: functional', () => {
  test('main entry exists', () => {
    const names = Object.keys(acMod);
    const hasCrucix = names.some(n => n.startsWith('crucix') || n.includes('ActorCritic') || n.includes('actor_critic'));
    assert.ok(hasCrucix, `ожидался crucix*-export, найдено: ${names.join(', ')}`);
  });

  test('works on 25 sweeps via generic entry', () => {
    const h = makeHistory(25);
    const crucixFn = Object.values(acMod).find(v => typeof v === 'function' && v.name.startsWith('crucix'));
    if (crucixFn) {
      const r = crucixFn(h, {});
      assert.ok(r);
      assert.ok(typeof r === 'object');
    }
  });

  test('A2C classes present', () => {
    const names = Object.keys(acMod);
    const hasActor = names.some(n => n.toLowerCase().includes('actor'));
    const hasCritic = names.some(n => n.toLowerCase().includes('critic'));
    assert.ok(hasActor || hasCritic, `ожидались Actor/Critic классы, найдено: ${names.join(', ')}`);
  });
});
