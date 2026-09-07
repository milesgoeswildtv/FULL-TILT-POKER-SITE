const root='/assets';

export const assets={
  default:{
    logo:`${root}/default/full-tilt-primary-logo.png`,
    avatarFrame:`${root}/default/default-avatar-frame.png`,
    feltDesktop:`${root}/default/default-poker-felt-desktop.png`,
    feltMobile:`${root}/default/default-poker-felt-mobile.png`,
    lobbyDesktop:`${root}/default/lobby-background-desktop.png`,
    lobbyMobile:`${root}/default/lobby-background-mobile.png`,
    pot:`${root}/default/default-pot-chip-stack.png`,
    plaques:{idle:`${root}/default/default-player-plaque-idle.png`,active:`${root}/default/default-player-plaque-active.png`,folded:`${root}/default/default-player-plaque-folded.png`,allIn:`${root}/default/default-player-plaque-all-in.png`},
    chips:{black:`${root}/default/default-chip-black.png`,blue:`${root}/default/default-chip-blue.png`,green:`${root}/default/default-chip-green.png`,purple:`${root}/default/default-chip-purple.png`,red:`${root}/default/default-chip-red.png`},
    ui:{actionLog:`${root}/default/action-log.png`,chat:`${root}/default/chat-panel.png`,handHistory:`${root}/default/hand-history.png`,invite:`${root}/default/invite-table-code.png`,spectator:`${root}/default/spectator.png`,showdown:`${root}/default/showdown.png`,tournamentWinner:`${root}/default/tournament-winner.png`,topBar:`${root}/default/top-bar.png`,infoStrip:`${root}/default/info-strip.png`,tournamentStats:`${root}/default/tournament-stats.png`,blindStructure:`${root}/default/blind-structure.png`,hud:`${root}/default/hud.png`,bettingControls:`${root}/default/betting-controls.png`}
  },
  cosmetics:{
    constellation:`${root}/constellation`,
    deadMansHand:`${root}/dead-mans-hand`,
    regalia:`${root}/regalia`
  },
  cardBacks:`${root}/card-backs`
};

export function plaqueFor(player){if(player?.folded)return assets.default.plaques.folded;if(player?.chips===0&&!player?.eliminated)return assets.default.plaques.allIn;if(player?.turn)return assets.default.plaques.active;return assets.default.plaques.idle}
