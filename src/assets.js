const root='/assets';

export const assets={
  default:{
    logoDesktop:`${root}/default/desktop-logo.png`,
    logoMobile:`${root}/default/mobile-logo.png`,
    mascotCrow:`${root}/default/the-crow.png`,
    mascotHare:`${root}/default/the-hare.png`,
    avatarFrame:`${root}/default/default-avatar-frame.png`,
    feltDesktop:`${root}/default/desktop-felt.png`,
    feltMobile:`${root}/default/mobile-felt-portrait.png`,
    lobbyDesktop:`${root}/default/desktop-background.png`,
    lobbyMobile:`${root}/default/mobile-background.png`,
    pot:`${root}/default/default-pot-chips.png`,
    starterCardBack:`${root}/default/starter-card-back.png`,
    plaques:{idle:`${root}/default/default-player-plaque.png`,active:`${root}/default/default-player-plaque-active.png`,folded:`${root}/default/default-player-plaque-folded.png`,allIn:`${root}/default/default-player-plaque-all-in.png`},
    chips:{black:`${root}/default/default-chip-black.png`,blue:`${root}/default/default-chip-blue.png`,green:`${root}/default/default-chip-green.png`,purple:`${root}/default/default-chip-purple.png`,red:`${root}/default/default-chip-red.png`},
    ui:{actionLog:`${root}/default/action-log.png`,chat:`${root}/default/chat-panel.png`,handHistory:`${root}/default/hand-history.png`,invite:`${root}/default/invite-table-code.png`,spectator:`${root}/default/spectator-ui.png`,showdown:`${root}/default/showdown-ui.png`,tournamentWinner:`${root}/default/tournament-winner-ui.png`,topBar:`${root}/default/top-bar.png`,infoStrip:`${root}/default/info-strip.png`,tournamentStats:`${root}/default/tournament-stats.png`}
  },
  cosmetics:{
    constellation:{root:`${root}/constellation`,avatarFrame:`${root}/constellation/constellation-avatar-frame.png`,cardBack:`${root}/constellation/card-back-constellation.png`},
    deadMansHand:{root:`${root}/dead-mans-hand`,avatarFrame:`${root}/dead-mans-hand/dead-mans-hand-avatar-frame.png`,cardBack:`${root}/dead-mans-hand/card-back-skull.png`},
    regalia:{root:`${root}/regalia`}
  },
  cardBacks:`${root}/card-backs`
};

export function plaqueFor(player){if(player?.folded)return assets.default.plaques.folded;if(player?.chips===0&&!player?.eliminated)return assets.default.plaques.allIn;if(player?.turn)return assets.default.plaques.active;return assets.default.plaques.idle}
