"use strict";
/* PROGRESSÃO: XP, níveis, dinheiro, loja, desafios diários, conquistas e estatísticas */

const PROG_MAX_LV=30;
function xpForLevel(lv){return Math.floor(80*lv+40*lv*lv);} // XP total necessário para atingir o nível lv
function levelFromXp(xp){
 let lv=1;
 while(lv<PROG_MAX_LV&&xp>=xpForLevel(lv+1))lv++;
 return lv;
}

/* Recompensas / economia */
const PROG={
 killXP:12, headXP:22, missionXP:120, waveXP:35,
 killMoney:8, headMoney:14, missionMoney:60, waveMoney:18,
 deathPenalty:0
};

/* Itens da loja (armas já existentes + equipamentos) */
const SHOP=[
 {id:0,name:'FUZIL DE ASSALTO',price:0,unlockLv:1,desc:'Arma inicial'},
 {id:1,name:'PISTOLA',price:150,unlockLv:1,desc:'Secundária confiável'},
 {id:2,name:'ESCOPETA',price:400,unlockLv:3,desc:'Dano alto a curta distância'},
 {id:3,name:'CARABINA',price:600,unlockLv:5,desc:'Precisão intermediária'},
 {id:4,name:'FUZIL DE PRECISÃO',price:900,unlockLv:8,desc:'Sniper de longo alcance'},
 {id:'armor',name:'COLETE +25 HP',price:250,unlockLv:2,desc:'Começa missões com +25 HP',consumable:false,flag:'armor'},
 {id:'ammo',name:'MUNIÇÃO EXTRA',price:180,unlockLv:2,desc:'+40% reserva de munição',consumable:false,flag:'ammo'},
 {id:'medkit',name:'KIT MÉDICO',price:120,unlockLv:1,desc:'Cura 40 HP no início da partida',consumable:true,flag:'medkit'}
];

/* Conquistas */
const ACH=[
 {id:'first_blood',n:'Primeiro Sangue',d:'Elimine 1 inimigo',check:s=>s.kills>=1,xp:30,money:20},
 {id:'k10',n:'Caçador',d:'Elimine 10 inimigos',check:s=>s.kills>=10,xp:50,money:40},
 {id:'k50',n:'Veterano',d:'Elimine 50 inimigos',check:s=>s.kills>=50,xp:120,money:100},
 {id:'k200',n:'Lenda',d:'Elimine 200 inimigos',check:s=>s.kills>=200,xp:300,money:250},
 {id:'hs10',n:'Atirador',d:'10 tiros na cabeça',check:s=>s.headshots>=10,xp:80,money:60},
 {id:'hs50',n:'Cirurgião',d:'50 tiros na cabeça',check:s=>s.headshots>=50,xp:200,money:150},
 {id:'acc40',n:'Mira Firme',d:'Precisão ≥40% em uma partida (mín. 20 tiros)',check:s=>s.bestAcc>=40,xp:70,money:50},
 {id:'wave5',n:'Sobrevivente',d:'Chegue à onda 5',check:s=>s.bestWave>=5,xp:100,money:80},
 {id:'wave10',n:'Inquebrável',d:'Chegue à onda 10',check:s=>s.bestWave>=10,xp:250,money:200},
 {id:'mis1',n:'Operativo',d:'Complete 1 missão',check:s=>s.missions>=1,xp:60,money:50},
 {id:'mis4',n:'Comandante',d:'Complete todas as missões',check:s=>s.missions>=4,xp:200,money:200},
 {id:'lvl5',n:'Promovido',d:'Alcance o nível 5',check:s=>s.level>=5,xp:0,money:100},
 {id:'lvl10',n:'Elite',d:'Alcance o nível 10',check:s=>s.level>=10,xp:0,money:200},
 {id:'rich',n:'Orçamento de Guerra',d:'Acumule 2000 créditos',check:s=>s.money>=2000||s.earned>=2000,xp:80,money:0},
 {id:'shop1',n:'Arsenal',d:'Compre 1 item na loja',check:s=>s.bought>=1,xp:40,money:30}
];

/* Desafios diários (rotacionam por data local) */
const CHAL_POOL=[
 {id:'dkills',n:'Elimine 15 inimigos',need:15,key:'kills',xp:80,money:70},
 {id:'dhs',n:'Consiga 5 headshots',need:5,key:'headshots',xp:90,money:80},
 {id:'dwave',n:'Alcance a onda 4',need:4,key:'wave',xp:100,money:90},
 {id:'dacc',n:'Termine uma partida com 35%+ precisão',need:35,key:'acc',xp:70,money:60},
 {id:'dmis',n:'Complete 1 missão',need:1,key:'mission',xp:110,money:100},
 {id:'dkills2',n:'Elimine 30 inimigos',need:30,key:'kills',xp:140,money:120}
];

function dayKey(){
 const d=new Date();
 return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
}

function progDefault(){
 return {
  level:1,xp:0,money:200,
  unlocked:[0,1], // fuzil + pistola
  ownedFlags:{}, // armor, ammo, etc
  medkits:0,
  stats:{kills:0,deaths:0,headshots:0,shots:0,hits:0,missions:0,matches:0,bestWave:0,bestAcc:0,earned:0,bought:0},
  ach:{}, // id -> true
  daily:{day:'',ids:[],prog:{},done:{}},
  loadout:0
 };
}

/* Merge save progression fields */
function progLoad(){
 const d=progDefault();
 try{
  const s=JSON.parse(localStorage.getItem('ss_save')||'{}');
  if(typeof s.level==='number')d.level=s.level;
  if(typeof s.xp==='number')d.xp=s.xp;
  if(typeof s.money==='number')d.money=s.money;
  if(Array.isArray(s.unlocked))d.unlocked=s.unlocked.slice();
  if(s.ownedFlags&&typeof s.ownedFlags==='object')d.ownedFlags=Object.assign({},s.ownedFlags);
  if(typeof s.medkits==='number')d.medkits=s.medkits;
  if(s.stats&&typeof s.stats==='object'){
   for(const k in d.stats)if(typeof s.stats[k]==='number')d.stats[k]=s.stats[k];
  }
  if(s.ach&&typeof s.ach==='object')d.ach=Object.assign({},s.ach);
  if(s.daily&&typeof s.daily==='object')d.daily=Object.assign({day:'',ids:[],prog:{},done:{}},s.daily);
  if(typeof s.loadout==='number')d.loadout=s.loadout;
  // migrate old flat xp
  if(typeof s.xp==='number'&&!s.level)d.level=levelFromXp(s.xp);
 }catch(e){console.warn('prog load',e);}
 // ensure daily
 const dk=dayKey();
 if(d.daily.day!==dk){
  d.daily={day:dk,ids:[],prog:{},done:{}};
  // pick 3 challenges by day seed
  let seed=0;for(let i=0;i<dk.length;i++)seed=(seed*31+dk.charCodeAt(i))>>>0;
  const pool=CHAL_POOL.slice();
  for(let i=0;i<3&&pool.length;i++){
   seed=(seed*1103515245+12345)>>>0;
   const ix=seed%pool.length;
   d.daily.ids.push(pool[ix].id);
   d.daily.prog[pool[ix].id]=0;
   pool.splice(ix,1);
  }
 }
 // sync level from xp
 d.level=Math.max(d.level,levelFromXp(d.xp));
 if(!d.unlocked.includes(0))d.unlocked.unshift(0);
 return d;
}

let PROG_S=progLoad();

function progSave(){
 try{
  // merge into main save object
  save.level=PROG_S.level;
  save.xp=PROG_S.xp;
  save.money=PROG_S.money;
  save.unlocked=PROG_S.unlocked;
  save.ownedFlags=PROG_S.ownedFlags;
  save.medkits=PROG_S.medkits;
  save.stats=PROG_S.stats;
  save.ach=PROG_S.ach;
  save.daily=PROG_S.daily;
  save.loadout=PROG_S.loadout;
  store();
 }catch(e){console.warn('prog save',e);}
}

function addXP(n,why){
 if(!n||n<=0)return;
 const old=PROG_S.level;
 PROG_S.xp+=n;
 PROG_S.level=levelFromXp(PROG_S.xp);
 if(PROG_S.level>old){
  const bonus=50*(PROG_S.level-old);
  PROG_S.money+=bonus;
  msg('NÍVEL '+PROG_S.level+'! +'+bonus+' créditos',2.5);
  // auto-unlock by level
  SHOP.forEach(it=>{
   if(typeof it.id==='number'&&PROG_S.level>=it.unlockLv&&!PROG_S.unlocked.includes(it.id)){
    PROG_S.unlocked.push(it.id);
    msg('Desbloqueado: '+it.name,2);
   }
  });
 }else if(why)msg('+'+n+' XP'+(why?(' ('+why+')'):''),1.2);
 checkAchievements();
 progSave();
 updateProgHUD();
}

function addMoney(n){
 if(!n)return;
 PROG_S.money+=n;
 if(n>0)PROG_S.stats.earned+=n;
 progSave();
 updateProgHUD();
}

function checkAchievements(){
 const st=Object.assign({},PROG_S.stats,{level:PROG_S.level,money:PROG_S.money,earned:PROG_S.stats.earned,bought:PROG_S.stats.bought,missions:PROG_S.stats.missions,bestWave:Math.max(PROG_S.stats.bestWave,save.wave||0)});
 ACH.forEach(a=>{
  if(PROG_S.ach[a.id])return;
  if(a.check(st)){
   PROG_S.ach[a.id]=true;
   if(a.xp)PROG_S.xp+=a.xp;
   if(a.money){PROG_S.money+=a.money;PROG_S.stats.earned+=a.money;}
   PROG_S.level=levelFromXp(PROG_S.xp);
   msg('CONQUISTA: '+a.n,2.5);
  }
 });
 progSave();
}

function dailyAdd(key,amt){
 const d=PROG_S.daily;
 CHAL_POOL.forEach(c=>{
  if(!d.ids.includes(c.id)||d.done[c.id])return;
  if(c.key!==key)return;
  d.prog[c.id]=(d.prog[c.id]||0)+amt;
  if(d.prog[c.id]>=c.need){
   d.done[c.id]=true;
   addXP(c.xp,'desafio');
   addMoney(c.money);
   msg('Desafio concluído: '+c.n,2.5);
  }
 });
 progSave();
}

function progOnKill(e,isHead){
 PROG_S.stats.kills++;
 if(isHead)PROG_S.stats.headshots++;
 const xp=PROG.killXP+(isHead?PROG.headXP-PROG.killXP:0)+Math.floor((e.T.pts||100)/20);
 const mon=PROG.killMoney+(isHead?PROG.headMoney-PROG.killMoney:0);
 addXP(xp,isHead?'headshot':null);
 addMoney(mon);
 dailyAdd('kills',1);
 if(isHead)dailyAdd('headshots',1);
 checkAchievements();
}

function progOnMatchEnd(win,data){
 // data: {kills,shots,hits,wave,mode,missionWin}
 PROG_S.stats.matches++;
 if(!win)PROG_S.stats.deaths++;
 if(data.shots){
  const acc=Math.round(data.hits/data.shots*100);
  if(acc>PROG_S.stats.bestAcc&&data.shots>=20)PROG_S.stats.bestAcc=acc;
  if(acc>=35&&data.shots>=15)dailyAdd('acc',acc);
 }
 if(data.wave){
  if(data.wave>PROG_S.stats.bestWave)PROG_S.stats.bestWave=data.wave;
  dailyAdd('wave',data.wave);
  if(data.wave>0){addXP(PROG.waveXP*Math.min(data.wave,8),'onda');addMoney(PROG.waveMoney*Math.min(data.wave,8));}
 }
 if(win&&data.mode==='campaign'){
  PROG_S.stats.missions=Math.max(PROG_S.stats.missions,(save.mission||0));
  addXP(PROG.missionXP,'missão');
  addMoney(PROG.missionMoney);
  dailyAdd('mission',1);
 }
 checkAchievements();
 progSave();
}

function ownsWeapon(id){return PROG_S.unlocked.indexOf(id)>=0;}
function canUseWeapon(i){return ownsWeapon(i);}

function buyItem(shopId){
 const it=SHOP.find(x=>x.id===shopId);
 if(!it)return false;
 if(PROG_S.level<it.unlockLv){msg('Requer nível '+it.unlockLv,1.5);return false;}
 if(PROG_S.money<it.price){msg('Créditos insuficientes',1.5);return false;}
 if(typeof it.id==='number'){
  if(PROG_S.unlocked.includes(it.id)){msg('Já possui',1);return false;}
  PROG_S.money-=it.price;
  PROG_S.unlocked.push(it.id);
  PROG_S.stats.bought++;
  msg('Comprado: '+it.name,2);
 }else if(it.flag==='medkit'){
  PROG_S.money-=it.price;
  PROG_S.medkits=(PROG_S.medkits||0)+1;
  PROG_S.stats.bought++;
  msg('Kit médico adquirido',2);
 }else if(it.flag){
  if(PROG_S.ownedFlags[it.flag]){msg('Já possui',1);return false;}
  PROG_S.money-=it.price;
  PROG_S.ownedFlags[it.flag]=true;
  PROG_S.stats.bought++;
  msg('Comprado: '+it.name,2);
 }
 checkAchievements();
 progSave();
 renderShop();
 updateProgHUD();
 return true;
}

function applyLoadoutPerks(){
 // called on resetGame
 if(PROG_S.ownedFlags.armor){P.hp=Math.min(125,P.hp+25);P.armor=50;}
 if(PROG_S.medkits>0){P.hp=Math.min(P.hp+40,PROG_S.ownedFlags.armor?125:100);PROG_S.medkits--;progSave();}
 if(PROG_S.ownedFlags.ammo&&typeof WEAPONS!=='undefined'){
  WEAPONS.forEach((w,i)=>{if(ws[i])ws[i].res=Math.floor(w.res*1.4);});
 }
 // equip first owned weapon
 const owned=PROG_S.unlocked.filter(i=>typeof i==='number').sort((a,b)=>a-b);
 if(owned.length&&typeof setWeapon==='function')setWeapon(owned.includes(PROG_S.loadout)?PROG_S.loadout:owned[0]);
}

function updateProgHUD(){
 const el=$('progbar');
 if(el){
  const lv=PROG_S.level;
  const cur=PROG_S.xp-(lv>1?xpForLevel(lv):0);
  const need=xpForLevel(Math.min(PROG_MAX_LV,lv+1))-(lv>1?xpForLevel(lv):0);
  const pct=lv>=PROG_MAX_LV?100:Math.min(100,Math.floor(cur/Math.max(1,need)*100));
  el.textContent='Nv.'+lv+'  |  $'+PROG_S.money+'  |  XP '+pct+'%';
 }
 const best=$('best');
 if(best)best.textContent='Nv.'+PROG_S.level+' | $'+PROG_S.money+' | Recorde: '+(save.hi||0)+' | Onda: '+(save.wave||0)+' | Missões: '+(save.mission||0)+'/4';
}

function renderShop(){
 const box=$('shopbody');
 if(!box)return;
 let h='<div style="margin-bottom:8px;color:#9bc35a">Créditos: <b>$'+PROG_S.money+'</b> · Nível '+PROG_S.level+'</div>';
 SHOP.forEach(it=>{
  const locked=PROG_S.level<it.unlockLv;
  let status='';
  if(typeof it.id==='number'){
   status=PROG_S.unlocked.includes(it.id)?'<span style="color:#9bc35a">POSSUI</span>':'<button class="b" data-buy="'+it.id+'" style="padding:6px 10px;font-size:12px">$'+it.price+'</button>';
  }else if(it.flag==='medkit'){
   status='<span style="color:#aaa;font-size:11px">x'+(PROG_S.medkits||0)+'</span> <button class="b" data-buy="'+it.id+'" style="padding:6px 10px;font-size:12px">$'+it.price+'</button>';
  }else{
   status=PROG_S.ownedFlags[it.flag]?'<span style="color:#9bc35a">POSSUI</span>':'<button class="b" data-buy="'+it.id+'" style="padding:6px 10px;font-size:12px">$'+it.price+'</button>';
  }
  if(locked)status='<span style="color:#c94a3a">Nv.'+it.unlockLv+'</span>';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #333;text-align:left">';
  h+='<div><b>'+it.name+'</b><br><small style="color:#aaa">'+it.desc+'</small></div><div>'+status+'</div></div>';
 });
 box.innerHTML=h;
 box.querySelectorAll('[data-buy]').forEach(b=>{
  b.onclick=()=>{
   let id=b.getAttribute('data-buy');
   if(/^\d+$/.test(id))id=+id;
   buyItem(id);
  };
 });
}

function renderStats(){
 const box=$('statsbody');
 if(!box)return;
 const s=PROG_S.stats;
 const acc=s.shots?Math.round(s.hits/s.shots*100):0;
 const next=xpForLevel(Math.min(PROG_MAX_LV,PROG_S.level+1));
 const prev=PROG_S.level>1?xpForLevel(PROG_S.level):0;
 box.innerHTML=
  '<div style="text-align:left;line-height:1.7;font-size:14px">'+
  '<b>Nível</b> '+PROG_S.level+' / '+PROG_MAX_LV+'<br>'+
  '<b>XP</b> '+PROG_S.xp+(PROG_S.level<PROG_MAX_LV?(' / '+next):'')+'<br>'+
  '<b>Créditos</b> $'+PROG_S.money+'<br>'+
  '<b>Eliminações</b> '+s.kills+'<br>'+
  '<b>Headshots</b> '+s.headshots+'<br>'+
  '<b>Mortes</b> '+s.deaths+'<br>'+
  '<b>Partidas</b> '+s.matches+'<br>'+
  '<b>Missões</b> '+s.missions+'/4<br>'+
  '<b>Melhor onda</b> '+s.bestWave+'<br>'+
  '<b>Melhor precisão</b> '+s.bestAcc+'%<br>'+
  '<b>Tiros / Acertos</b> '+s.shots+' / '+s.hits+' ('+acc+'%)<br>'+
  '<b>Ganhos totais</b> $'+s.earned+
  '</div>';
}

function renderAch(){
 const box=$('achbody');
 if(!box)return;
 let h='';
 ACH.forEach(a=>{
  const ok=!!PROG_S.ach[a.id];
  h+='<div style="text-align:left;padding:6px 0;border-bottom:1px solid #333;opacity:'+(ok?'1':'.55')+'">';
  h+='<b style="color:'+(ok?'#9bc35a':'#ccc')+'">'+(ok?'✓ ':'○ ')+a.n+'</b><br><small>'+a.d+'</small></div>';
 });
 box.innerHTML=h;
}

function renderDaily(){
 const box=$('dailybody');
 if(!box)return;
 let h='<div style="margin-bottom:6px;color:#aaa;font-size:12px">Reseta à meia-noite · '+PROG_S.daily.day+'</div>';
 PROG_S.daily.ids.forEach(id=>{
  const c=CHAL_POOL.find(x=>x.id===id);
  if(!c)return;
  const prog=PROG_S.daily.prog[id]||0;
  const done=!!PROG_S.daily.done[id];
  const pct=Math.min(100,Math.floor(prog/c.need*100));
  h+='<div style="text-align:left;padding:8px 0;border-bottom:1px solid #333">';
  h+='<b style="color:'+(done?'#9bc35a':'#eee')+'">'+(done?'✓ ':'')+c.n+'</b>';
  h+='<br><small>'+Math.min(prog,c.need)+'/'+c.need+' · +'+c.xp+' XP · $'+c.money+'</small>';
  h+='<div style="height:6px;background:#222;margin-top:4px;border-radius:3px"><div style="height:100%;width:'+pct+'%;background:#9bc35a;border-radius:3px"></div></div></div>';
 });
 box.innerHTML=h;
}

function openProg(tab){
 show('prog');
 ['shop','stats','ach','daily'].forEach(t=>{
  const p=$('panel-'+t);if(p)p.style.display=t===tab?'block':'none';
  const b=$('ptab-'+t);if(b)b.style.outline=t===tab?'2px solid #9bc35a':'none';
 });
 if(tab==='shop')renderShop();
 if(tab==='stats')renderStats();
 if(tab==='ach')renderAch();
 if(tab==='daily')renderDaily();
}

function wireProgressUI(){
 const bshop=$('bshop'),bprog=$('bprog');
 if(bshop)bshop.onclick=()=>{SFX.ui();openProg('shop');};
 if(bprog)bprog.onclick=()=>{SFX.ui();openProg('stats');};
 ['shop','stats','ach','daily'].forEach(t=>{
  const b=$('ptab-'+t);
  if(b)b.onclick=()=>{SFX.ui();openProg(t);};
 });
 const back=$('progback');
 if(back)back.onclick=()=>{SFX.ui();show('menu');updateProgHUD();};
 updateProgHUD();
}

/* Patch setWeapon to respect unlocks when swapping in-game */
const _progSwapReady=()=>{
 if(typeof swap!=='function')return;
 const _swap=swap;
 swap=function(){
  if(reloading>0)return;
  const n=WEAPONS.length;
  let i=(cw+1)%n,guard=0;
  while(!ownsWeapon(i)&&guard++<n)i=(i+1)%n;
  if(!ownsWeapon(i))return;
  setWeapon(i);PROG_S.loadout=i;progSave();SFX.ui();
 };
};
setTimeout(_progSwapReady,0);
