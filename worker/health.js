export const APP_VERSION='0.46.0';

export function healthPayload(){return{ok:true,name:'FULL TILT POKER',version:APP_VERSION,realtime:'websocket-hibernation',engine:'mtt-idempotent-child-provisioning-safe-hand-boundary-table-moves-synchronized-lifecycle-global-blind-clock-authenticated-table-proxy-explicit-host-end-strict-table-config-player-cosmetics-exact-showdown-awards',spectators:'read-only',chat:'realtime',presentation:'animated-table-fx-web-audio'}}

export function healthResponse(){return new Response(JSON.stringify(healthPayload()),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}})}
