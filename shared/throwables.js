export const THROWABLE_CATALOG=Object.freeze([
 {id:'poop',label:'Poop',glyph:'💩',effect:'splat',asset:null},
 {id:'tomato',label:'Tomato',glyph:'🍅',effect:'splat',asset:null},
 {id:'egg',label:'Egg',glyph:'🥚',effect:'crack',asset:null},
 {id:'heart',label:'Heart',glyph:'❤️',effect:'pop',asset:null},
 {id:'fire',label:'Fire',glyph:'🔥',effect:'burst',asset:null},
 {id:'skull',label:'Skull',glyph:'💀',effect:'burst',asset:null},
 {id:'cash',label:'Cash',glyph:'💸',effect:'pop',asset:null},
 {id:'shoe',label:'Shoe',glyph:'👟',effect:'smack',asset:null},
 {id:'thumbsdown',label:'Thumbs Down',glyph:'👎',effect:'smack',asset:null},
 {id:'clown',label:'Clown',glyph:'🤡',effect:'pop',asset:null}
]);

export const THROWABLE_IDS=new Set(THROWABLE_CATALOG.map(item=>item.id));

export function normalizeThrowableId(value){
 const id=String(value||'').trim().toLowerCase();
 return THROWABLE_IDS.has(id)?id:'';
}

export function throwableById(value){
 const id=normalizeThrowableId(value);
 return id?THROWABLE_CATALOG.find(item=>item.id===id)||null:null;
}
