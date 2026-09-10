export const APP_VERSION='0.49.0';

export function healthPayload(){return{ok:true,name:'FULL TILT POKER',version:APP_VERSION,realtime:'websocket-hibernation',engine:'mtt-idempotent-child-provisioning-safe-hand-boundary-table-moves-synchronized-lifecycle-global-blind-clock-authenticated-table-proxy-explicit-host-end-share-safe-session-routing-browser-response-hardening-race-safe-tournament-controls-start-registration-lock-fixed-screen-table-ui-global-and-table-chat-strict-table-config-player-cosmetics-exact-showdown-awards',spectators:'read-only',chat:'global-and-table',presentation:'animated-table-fx-web-audio'}}

export function healthResponse(){return new Response(JSON.stringify(healthPayload()),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}})}