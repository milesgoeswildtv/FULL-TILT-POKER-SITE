import test from'node:test';
import assert from'node:assert/strict';
import{parseTelegramStartParam}from'../src/platform.js';

test('Telegram startapp routes only supported six-character Full Tilt targets',()=>{
 assert.deepEqual(parseTelegramStartParam('table_FT7K2Q'),{kind:'table',code:'FT7K2Q'});
 assert.deepEqual(parseTelegramStartParam('TOURNAMENT_ABC123'),{kind:'tournament',code:'ABC123'});
 assert.equal(parseTelegramStartParam('table_TOO-LONG'),null);
 assert.equal(parseTelegramStartParam('profile_ABC123'),null);
 assert.equal(parseTelegramStartParam(''),null);
});
