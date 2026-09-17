export function livePlayers(data){return data.players.filter(p=>!p.eliminated&&!p.folded)}
export function actionablePlayers(data){return livePlayers(data).filter(p=>p.chips>0)}
export function actualBetToMatch(data){return livePlayers(data).reduce((highest,p)=>Math.max(highest,Number(p.bet)||0),0)}
export function effectiveBetToMatch(data){const actual=actualBetToMatch(data),actionable=actionablePlayers(data),openingFloor=data.street==='preflop'&&actionable.length>=2?Math.max(0,Number(data.openingBet??data.bigBlind)||0):0;return Math.max(actual,openingFloor)}
export function amountToCall(data,player){return Math.max(0,effectiveBetToMatch(data)-(Number(player?.bet)||0))}
export function hasActionableOpponent(data,player){return actionablePlayers(data).some(p=>p.id!==player?.id)}
