import test from'node:test';
import assert from'node:assert/strict';
import{normalizeTableConfig,TABLE_CONFIG_LIMITS}from'../worker/table-config.js';

test('table config applies canonical defaults',()=>{assert.deepEqual(normalizeTableConfig({}),{startingChips:2500,blindMinutes:10})});

test('table config accepts valid custom whole numbers',()=>{assert.deepEqual(normalizeTableConfig({startingChips:10000,blindMinutes:20}),{startingChips:10000,blindMinutes:20})});

test('table config rejects fractional and nonnumeric values',()=>{assert.throws(()=>normalizeTableConfig({startingChips:2500.5}),/Starting chips/);assert.throws(()=>normalizeTableConfig({blindMinutes:'lol'}),/Blind level minutes/)});

test('table config rejects unsafe extremes',()=>{assert.throws(()=>normalizeTableConfig({startingChips:TABLE_CONFIG_LIMITS.STARTING_CHIP_MAX+1}),/Starting chips/);assert.throws(()=>normalizeTableConfig({blindMinutes:TABLE_CONFIG_LIMITS.BLIND_MINUTES_MAX+1}),/Blind level minutes/)});
