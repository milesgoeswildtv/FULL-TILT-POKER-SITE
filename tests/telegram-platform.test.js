import test from'node:test';
import assert from'node:assert/strict';
import{parseTelegramStartParam,telegramRouteState,telegramThemeVariables}from'../src/platform.js';

test('Telegram startapp routes only supported six-character Crashout targets',()=>{
 assert.deepEqual(parseTelegramStartParam('table_FT7K2Q'),{kind:'table',code:'FT7K2Q'});
 assert.deepEqual(parseTelegramStartParam('TOURNAMENT_ABC123'),{kind:'tournament',code:'ABC123'});
 assert.equal(parseTelegramStartParam('table_TOO-LONG'),null);
 assert.equal(parseTelegramStartParam('profile_ABC123'),null);
 assert.equal(parseTelegramStartParam(''),null);
});

test('Telegram chrome treats table and tournament hashes as protected game routes',()=>{
 assert.deepEqual(telegramRouteState(''),{game:false,lobby:true,showBack:false,showSettings:true,confirmClose:false});
 assert.deepEqual(telegramRouteState('#/table/ABC123'),{game:true,lobby:false,showBack:true,showSettings:false,confirmClose:true});
 assert.deepEqual(telegramRouteState('#/tournament/FT7K2Q?token=x'),{game:true,lobby:false,showBack:true,showSettings:false,confirmClose:true});
 assert.equal(telegramRouteState('#/layout-lab').game,false);
});

test('Telegram theme variables accept only six-digit theme colors and keep Crashout fallbacks',()=>{
 const vars=telegramThemeVariables({bg_color:'#112233',secondary_bg_color:'#223344',text_color:'#abcdef',hint_color:'#778899',button_color:'#445566',button_text_color:'#ffffff',link_color:'#fedcba',bottom_bar_bg_color:'#334455'});
 assert.equal(vars['--telegram-bg'],'#112233');
 assert.equal(vars['--telegram-secondary-bg'],'#223344');
 assert.equal(vars['--telegram-text'],'#abcdef');
 assert.equal(vars['--telegram-bottom-bar'],'#334455');
 const bad=telegramThemeVariables({bg_color:'red',text_color:'#fff',button_color:'javascript:alert(1)'});
 assert.equal(bad['--telegram-bg'],'#09060d');
 assert.equal(bad['--telegram-text'],'#f6f0ff');
 assert.equal(bad['--telegram-button'],'#6e2da2');
});
