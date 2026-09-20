
import fs from 'node:fs';
import path from 'node:path';

const SR=48000;
const OUT=path.resolve(process.cwd(),'public/assets/sfx');
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});

function rng(seed){let a=(seed>>>0)||1;return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
function gauss(r){const u=Math.max(1e-12,r()),v=Math.max(1e-12,r());return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function z(s){return new Float64Array(Math.max(1,Math.floor(s*SR)))}
function env(n,d=.04,a=.001){const o=new Float64Array(n),k=Math.max(1,Math.min(n,Math.floor(a*SR)));for(let i=0;i<n;i++){let e=Math.exp(-(i/SR)/Math.max(d,1e-4));if(i<k)e*=i/Math.max(1,k-1);o[i]=e}return o}
function hp(n,r){const o=new Float64Array(n);let p=gauss(r);for(let i=1;i<n;i++){const c=gauss(r);o[i]=c-p;p=c}return o}
function lp(n,r,w=10){const o=new Float64Array(n),q=[];let s=0;for(let i=0;i<n;i++){const v=gauss(r);q.push(v);s+=v;if(q.length>w)s-=q.shift();o[i]=s/q.length}return o}
function tone(f,n,p=0){const o=new Float64Array(n);for(let i=0;i<n;i++)o[i]=Math.sin(2*Math.PI*f*(i/SR)+p);return o}
function put(b,e,t,g=1){const at=Math.floor(t*SR);for(let i=0;i<e.length&&at+i<b.length;i++)b[at+i]+=e[i]*g}
function norm(x,p=.75){let m=1e-12;for(const v of x)m=Math.max(m,Math.abs(v));const o=new Float64Array(x.length),g=p/m;for(let i=0;i<x.length;i++)o[i]=Math.max(-1,Math.min(1,x[i]*g));return o}
function fade(x,fo=.03){const o=Float64Array.from(x),k=Math.max(1,Math.min(o.length,Math.floor(fo*SR)));for(let i=0;i<k;i++)o[o.length-k+i]*=(1-i/Math.max(1,k-1));return o}
function hann(n){const o=new Float64Array(n);for(let i=0;i<n;i++)o[i]=.5-.5*Math.cos(2*Math.PI*i/Math.max(1,n-1));return o}

function card(seed=1,slide=false,soft=false){
  const r=rng(seed),x=z(slide?.30:.24);
  let n=Math.floor(.05*SR),a=hp(n,r),e=env(n,.015,.0002);for(let i=0;i<n;i++)a[i]*=e[i]*.5;put(x,a,0,soft?.55:.72);
  n=Math.floor(.11*SR);a=lp(n,r,20);e=env(n,.035,.001);const t=tone(120,n),te=env(n,.045,.001);for(let i=0;i<n;i++)a[i]=.5*a[i]*e[i]+.12*t[i]*te[i];put(x,a,.05,soft?.42:.56);
  if(slide){n=Math.floor(.14*SR);a=lp(n,r,5);for(let i=0;i<n;i++)a[i]*=(1-i/n);put(x,a,.08,.10)}
  return fade(norm(x,soft?.55:.68))
}
function pair(s){const x=z(.42);put(x,card(s),0,.9);put(x,card(s+1),.12,.9);return fade(norm(x,.70))}
function triple(s){const x=z(.50);[0,.075,.15].forEach((t,i)=>put(x,card(s+i,true),t,.9));return fade(norm(x,.72))}
function flip(s){const x=z(.38);put(x,card(s,false,true),0,.6);put(x,card(s+1),.16,.85);return fade(norm(x,.65))}
function muck(s){const x=z(.52);put(x,card(s,true,true),0,.7);put(x,card(s+1,true,true),.05,.75);return fade(norm(x,.58))}
function chip(seed=1,p=1){const r=rng(seed),n=Math.floor(.22*SR),x=new Float64Array(n),e=env(n,.028,.0003);for(const[f,a]of[[540,.5],[880,.28],[1270,.12]]){const q=tone(f*p,n,r()*Math.PI*2);for(let i=0;i<n;i++)x[i]+=a*q[i]*e[i]}const h=hp(n,r),he=env(n,.008,.0002);for(let i=0;i<n;i++)x[i]+=.08*h[i]*he[i];return fade(norm(x,.62))}
function stack(seed,count=5,dur=.55,heavy=false){const r=rng(seed),x=z(dur),ts=Array.from({length:count},()=>.01+r()*dur*.54).sort((a,b)=>a-b);ts.forEach((t,i)=>put(x,chip(seed+i,.94+r()*.12),t,.35+r()*.27));return fade(norm(x,heavy?.70:.64))}
function push(seed,big=false){const r=rng(seed),dur=big?1.3:1,x=z(dur),n=Math.floor((dur-.1)*SR),a=lp(n,r,7),h=hann(n);for(let i=0;i<n;i++)a[i]*=h[i];put(x,a,.03,big?.14:.11);const c=big?18:9,ts=Array.from({length:c},()=>.03+r()*(dur-.18)).sort((a,b)=>a-b);ts.forEach((t,i)=>put(x,chip(seed+20+i,.93+r()*.14),t,.22+r()*.22));return fade(norm(x,big?.75:.67))}
function riffChips(seed){const r=rng(seed),x=z(1.15);for(let i=0;i<14;i++)put(x,chip(seed+i,.95+r()*.10),.04+i*(.9/13)+(r()-.5)*.016,.48);return fade(norm(x,.60))}
function tap(seed,d=false){const x=z(d?.42:.26);function one(s){const r=rng(s),n=Math.floor(.11*SR),a=tone(105,n),ae=env(n,.038,.0008),b=lp(n,r,18),be=env(n,.025,.0006);for(let i=0;i<n;i++)a[i]=.45*a[i]*ae[i]+.35*b[i]*be[i];return norm(a,.52)}put(x,one(seed),.015,.9);if(d)put(x,one(seed+1),.14,.85);return fade(norm(x,.54))}
function button(seed){const r=rng(seed),n=Math.floor(.26*SR),a=tone(340,n),ae=env(n,.04,.0004),b=tone(620,n),be=env(n,.026,.0003),c=lp(n,r,14),ce=env(n,.02,.0004);for(let i=0;i<n;i++)a[i]=.45*a[i]*ae[i]+.28*b[i]*be[i]+.20*c[i]*ce[i];return fade(norm(a,.58))}
function thump(seed,h=false){const r=rng(seed),n=Math.floor((h?.46:.32)*SR),a=tone(h?64:82,n),ae=env(n,.08,.001),b=lp(n,r,22),be=env(n,.05,.001);for(let i=0;i<n;i++)a[i]=.52*a[i]*ae[i]+.28*b[i]*be[i];return fade(norm(a,h?.64:.52))}
function riffle(seed){const r=rng(seed),x=z(1.75);for(let i=0;i<36;i++)put(x,card(seed+10+i,false,true),.24+i*(.71/35)+(r()-.5)*.01,.28);for(let i=0;i<20;i++)put(x,card(seed+100+i,false,true),1.05+i*(.40/19),.20);return fade(norm(x,.62),.05)}
function overhand(seed){const r=rng(seed),x=z(1.8);let t=.08;for(let i=0;i<18;i++){put(x,card(seed+i,true,true),t,.32);t+=.065+r()*.04}return fade(norm(x,.58),.05)}
function cut(seed){const x=z(.72);put(x,card(seed,true,true),.04,.6);put(x,card(seed+1,true),.31,.7);return fade(norm(x,.62),.04)}
function square(seed){const x=z(.58);[.04,.15,.27,.39].forEach((t,i)=>put(x,button(seed+i),t,i<3?.35:.5));return fade(norm(x,.55),.04)}
function potWin(seed,big=false){const r=rng(seed),dur=big?1:.75,x=z(dur),c=big?14:7,ts=Array.from({length:c},()=>.04+r()*dur*.56).sort((a,b)=>a-b);ts.forEach((t,i)=>put(x,chip(seed+i,.95+r()*.10),t,.24+r()*.21));if(big)put(x,thump(seed+99),.02,.22);return fade(norm(x,big?.76:.68),.05)}
function allIn(seed){const x=z(1.25);put(x,push(seed,true),0,.95);put(x,thump(seed+100,true),.03,.26);return fade(norm(x,.79),.06)}

function writeWav(file,s){fs.mkdirSync(path.dirname(file),{recursive:true});const d=Buffer.alloc(s.length*2);for(let i=0;i<s.length;i++)d.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(s[i]*32767))),i*2);const o=Buffer.alloc(44+d.length);o.write('RIFF',0);o.writeUInt32LE(36+d.length,4);o.write('WAVE',8);o.write('fmt ',12);o.writeUInt32LE(16,16);o.writeUInt16LE(1,20);o.writeUInt16LE(1,22);o.writeUInt32LE(SR,24);o.writeUInt32LE(SR*2,28);o.writeUInt16LE(2,32);o.writeUInt16LE(16,34);o.write('data',36);o.writeUInt32LE(d.length,40);d.copy(o,44);fs.writeFileSync(file,o)}
const manifest=[];function add(cat,name,s,g=.7,p=4,n=''){const rel=`${cat}/${name}.wav`;writeWav(path.join(OUT,rel),s);manifest.push({id:name,category:cat,url:`/assets/sfx/${rel}`,recommendedGain:g,polyphony:p,note:n})}

for(let i=1;i<=5;i++)add('cards',`single_deal_${String(i).padStart(2,'0')}`,card(100+i,i%2===0),.78,8);
for(let i=1;i<=3;i++)add('cards',`hole_cards_${String(i).padStart(2,'0')}`,pair(120+i),.78,4);
for(let i=1;i<=2;i++)add('cards',`flop_spread_${String(i).padStart(2,'0')}`,triple(140+i),.80,3);
add('cards','turn_card',card(150,true),.80,3);add('cards','river_card',card(151,true),.82,3);
for(let i=1;i<=2;i++)add('cards',`show_card_flip_${String(i).padStart(2,'0')}`,flip(160+i),.72,4);
for(let i=1;i<=2;i++)add('cards',`fold_to_muck_${String(i).padStart(2,'0')}`,muck(170+i),.68,6);
add('cards','riffle_shuffle',riffle(180),.58,1);add('cards','overhand_shuffle',overhand(181),.55,1);add('cards','deck_cut',cut(182),.62,2);add('cards','deck_square',square(183),.58,2);

for(let i=1;i<=5;i++)add('chips',`single_chip_clack_${String(i).padStart(2,'0')}`,chip(200+i,1+(i-3)*.025),.50,10);
[4,5,6].forEach((c,i)=>add('chips',`small_stack_${String(i+1).padStart(2,'0')}`,stack(221+i,c,.50),.62,8));
[8,10].forEach((c,i)=>add('chips',`medium_stack_${String(i+1).padStart(2,'0')}`,stack(231+i,c,.70,true),.68,6));
add('chips','large_stack_drop',stack(240,16,.95,true),.74,4);add('chips','chip_riffle_01',riffChips(250),.52,3);add('chips','chip_riffle_02',riffChips(251),.52,3);
add('chips','bet_small',stack(260,4,.45),.60,8);add('chips','bet_medium',stack(261,7,.60),.66,8);add('chips','call',stack(262,5,.50),.62,8);add('chips','raise',stack(263,10,.75,true),.70,6);
add('chips','pot_push_to_center',push(264),.64,4);add('chips','pot_push_to_winner',push(265,true),.68,4);add('chips','all_in_shove',allIn(266),.82,2,'Traditional chip shove with subtle low table weight.');

add('table','check_tap_01',tap(300),.52,6);add('table','check_tap_02',tap(301,true),.52,6);add('table','dealer_button_place_01',button(302),.48,4);add('table','dealer_button_place_02',button(303),.48,4);add('table','hand_start',square(304),.44,2);
{const x=z(.70);put(x,flip(305),0,.8);put(x,flip(308),.20,.8);add('table','showdown_cards',fade(norm(x,.65),.04),.56,2)}

add('results','pot_win',potWin(400),.58,2);add('results','big_pot_win',potWin(401,true),.68,2,'Mostly chips with a tiny low Crashout accent.');
{const x=z(.78);put(x,stack(402,4,.42),.02,.55);put(x,stack(403,4,.42),.32,.55);add('results','split_pot',fade(norm(x,.62),.05),.54,2)}
{const x=z(.75);put(x,thump(404),0,.22);put(x,muck(405),.12,.6);add('results','player_bust',fade(norm(x,.55),.05),.48,1)}
add('crashout_optional','all_in_weight',thump(500,true),.25,2,'Optional quiet layer; never use solo.');
add('crashout_optional','big_pot_weight',thump(501),.18,2,'Optional quiet layer; never use solo.');

fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify({version:'3.1-build-generated',sampleRate:SR,channels:1,format:'PCM16 WAV',design:'Traditional poker first; Crashout accents only on major moments.',sounds:manifest},null,2));
console.log(`Generated ${manifest.length} Crashout Poker SFX in ${OUT}`);
