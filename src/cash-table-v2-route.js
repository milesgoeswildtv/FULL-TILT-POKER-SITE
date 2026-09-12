function isCashTableRoute(){return /^#\/table\/[A-Z0-9]+/i.test(location.hash)}
function syncCashTableClass(){const cash=isCashTableRoute();document.documentElement.classList.toggle('cash-table-v2-route',cash);for(const page of document.querySelectorAll('.tablePage'))page.classList.toggle('cashTableV2Page',cash)}
const root=document.getElementById('root');
if(root)new MutationObserver(syncCashTableClass).observe(root,{childList:true,subtree:true});
addEventListener('hashchange',syncCashTableClass);
queueMicrotask(syncCashTableClass);
