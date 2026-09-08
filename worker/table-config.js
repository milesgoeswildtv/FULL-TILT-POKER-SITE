const STARTING_CHIP_MIN=100,STARTING_CHIP_MAX=1000000000,BLIND_MINUTES_MIN=1,BLIND_MINUTES_MAX=1440;
function wholeNumber(value,label,min,max){const n=Number(value);if(!Number.isFinite(n)||!Number.isInteger(n)||n<min||n>max)throw Error(`${label} must be a whole number from ${min.toLocaleString()} to ${max.toLocaleString()}.`);return n}
export function normalizeTableConfig(input={}){return{startingChips:wholeNumber(input.startingChips??2500,'Starting chips',STARTING_CHIP_MIN,STARTING_CHIP_MAX),blindMinutes:wholeNumber(input.blindMinutes??10,'Blind level minutes',BLIND_MINUTES_MIN,BLIND_MINUTES_MAX)}}
export const TABLE_CONFIG_LIMITS={STARTING_CHIP_MIN,STARTING_CHIP_MAX,BLIND_MINUTES_MIN,BLIND_MINUTES_MAX};
