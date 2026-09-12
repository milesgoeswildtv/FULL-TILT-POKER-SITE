const root='/assets';

const chipSet=(base,prefix)=>({black:`${base}/${prefix}-black-chip.png`,blue:`${base}/${prefix}-blue-chip.png`,green:`${base}/${prefix}-green-chip.png`,purple:`${base}/${prefix}-purple-chip.png`,red:`${base}/${prefix}-red-chip.png`});
const plaqueSet=(base,prefix,foldName='folded')=>({idle:`${base}/${prefix}-idle-player-plaque.png`,active:`${base}/${prefix}-active-player-plaque.png`,folded:`${base}/${prefix}-${foldName}-player-plaque.png`,allIn:`${base}/${prefix}-all-in-player-plaque.png`});

export const assets={
  default:{
    logoDesktop:`${root}/default/desktop-logo.png`,
    logoMobile:`${root}/default/mobile-logo.png`,
    mascotCrow:`${root}/default/the-crow.png`,
    mascotHare:`${root}/default/the-hare.png`,
    avatarFrame:`${root}/default/default-avatar-frame.png`,
    feltDesktop:`${root}/default/desktop-felt.png`,
    feltMobile:`${root}/default/mobile-felt-portrait.png`,
    feltCashV2:`${root}/default/TABLE FELT V2.PNG?v=official-2`,
    lobbyDesktop:`${root}/default/desktop-background.png`,
    lobbyMobile:`${root}/default/mobile-background.png`,
    pot:`${root}/default/default-pot-chips.png`,
    starterCardBack:`${root}/default/starter-card-back.png`,
    plaques:{idle:`${root}/default/default-player-plaque.png`,active:`${root}/default/default-player-plaque-active.png`,folded:`${root}/default/default-player-plaque-folded.png`,allIn:`${root}/default/default-player-plaque-all-in.png`},
    chips:{black:`${root}/default/default-chip-black.png`,blue:`${root}/default/default-chip-blue.png`,green:`${root}/default/default-chip-green.png`,purple:`${root}/default/default-chip-purple.png`,red:`${root}/default/default-chip-red.png`},
    ui:{actionLog:`${root}/default/action-log.png`,chat:`${root}/default/chat-panel.png`,handHistory:`${root}/default/hand-history.png`,invite:`${root}/default/invite-table-code.png`,spectator:`${root}/default/spectator-ui.png`,showdown:`${root}/default/showdown-ui.png`,tournamentWinner:`${root}/default/tournament-winner-ui.png`,topBar:`${root}/default/top-bar.png`,infoStrip:`${root}/default/info-strip.png`,tournamentStats:`${root}/default/tournament-stats.png`}
  },
  cosmetics:{
    constellation:{label:'Constellation',avatarFrame:`${root}/constellation/constellation-avatar-frame.png`,cardBack:`${root}/constellation/card-back-constellation.png`,plaques:plaqueSet(`${root}/constellation`,'constellation','fold'),chips:chipSet(`${root}/constellation`,'constellation')},
    deadMansHand:{label:"Dead Man's Hand",avatarFrame:`${root}/dead-mans-hand/dead-mans-hand-avatar-frame.png`,cardBack:`${root}/dead-mans-hand/card-back-skull.png`,plaques:plaqueSet(`${root}/dead-mans-hand`,'dead-mans-hand'),chips:chipSet(`${root}/dead-mans-hand`,'dead-mans-hand')},
    regalia:{label:'Regalia',avatarFrame:`${root}/regalia/regalia-avatar-frame.png`,cardBack:`${root}/regalia/regalia-card-back.png`,plaques:plaqueSet(`${root}/regalia`,'regalia'),chips:chipSet(`${root}/regalia`,'regalia')}
  },
  cardBacks:`${root}/card-backs`
};

export const cosmeticOptions=[{key:'default',label:'Full Tilt'},{key:'constellation',label:'Constellation'},{key:'deadMansHand',label:"Dead Man's Hand"},{key:'regalia',label:'Regalia'}];
export function normalizeCosmetic(value){return cosmeticOptions.some(x=>x.key===value)?value:'default'}
export function skinFor(player){const key=normalizeCosmetic(player?.cosmetic);return key==='default'?{label:'Full Tilt',avatarFrame:assets.default.avatarFrame,cardBack:assets.default.starterCardBack,plaques:assets.default.plaques,chips:assets.default.chips}:assets.cosmetics[key]}
export function plaqueFor(player){const set=skinFor(player).plaques;if(player?.folded)return set.folded;if(player?.chips===0&&!player?.eliminated)return set.allIn;if(player?.turn)return set.active;return set.idle}
export function avatarFrameFor(player){return skinFor(player).avatarFrame}
export function cardBackFor(player){return skinFor(player).cardBack}
export function chipFor(player,color='purple'){return skinFor(player).chips?.[color]||assets.default.chips[color]||assets.default.chips.purple}
