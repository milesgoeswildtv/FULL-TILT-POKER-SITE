import test from'node:test';
import assert from'node:assert/strict';
import{cosmeticOptions,normalizeCosmetic,skinFor,plaqueFor,avatarFrameFor,cardBackFor,chipFor}from'../src/assets.js';

test('all four table kits are selectable',()=>{assert.deepEqual(cosmeticOptions.map(x=>x.key),['default','constellation','deadMansHand','regalia'])});

test('unknown cosmetic values fall back to default',()=>{assert.equal(normalizeCosmetic('wat'),'default');assert.equal(normalizeCosmetic(null),'default')});

test('constellation player resolves constellation plaque frame card back and chip',()=>{const p={cosmetic:'constellation',turn:true,chips:100};assert.match(plaqueFor(p),/constellation-active-player-plaque\.png$/);assert.match(avatarFrameFor(p),/constellation-avatar-frame\.png$/);assert.match(cardBackFor(p),/card-back-constellation\.png$/);assert.match(chipFor(p,'purple'),/constellation-purple-chip\.png$/)});

test('dead mans hand folded state resolves folded art',()=>{const p={cosmetic:'deadMansHand',folded:true,chips:100};assert.match(plaqueFor(p),/dead-mans-hand-folded-player-plaque\.png$/)});

test('regalia all-in state resolves all-in art',()=>{const p={cosmetic:'regalia',chips:0,eliminated:false};assert.match(plaqueFor(p),/regalia-all-in-player-plaque\.png$/);assert.equal(skinFor(p).label,'Regalia')});
