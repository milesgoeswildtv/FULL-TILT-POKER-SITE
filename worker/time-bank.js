export const TIME_BANK_INITIAL_MS=60000;
export const TIME_BANK_CHUNK_MS=15000;

export function normalizeTimeBankMs(value,fallback=TIME_BANK_INITIAL_MS){
 if(value==null)return Math.max(0,Math.trunc(Number(fallback)||0));
 const n=Math.trunc(Number(value));
 return Number.isFinite(n)&&n>=0?n:Math.max(0,Math.trunc(Number(fallback)||0));
}

export function spendTimeBank(remainingMs,chunkMs=TIME_BANK_CHUNK_MS){
 const remaining=normalizeTimeBankMs(remainingMs),chunk=Math.max(1,Math.trunc(Number(chunkMs)||TIME_BANK_CHUNK_MS)),spent=Math.min(remaining,chunk);
 return{spent,remaining:remaining-spent};
}
