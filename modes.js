"use strict";
/* NOVOS MODOS DE JOGO — TDM, Domination, Bomb, Hostage, Zombie, SpecOps, Boss */

const MODES_META={
 tdm:{title:'TEAM DEATHMATCH',goal:30,desc:'Faça 30 eliminações antes do tempo acabar'},
 dom:{title:'DOMINAÇÃO',goal:100,desc:'Capture e segure os pontos A/B/C'},
 bomb:{title:'DESARME DE BOMBA',goal:1,desc:'Plante a bomba no alvo ou elimine os defensores'},
 hostage:{title:'RESGATE DE REFÉNS',goal:3,desc:'Resgate 3 reféns e leve-os à extração'},
 zombie:{title:'SOBREVIVÊNCIA ZUMBI',goal:0,desc:'Sobreviva às ondas de zumbis'},
 specops:{title:'OPERAÇÕES ESPECIAIS',goal:1,desc:'Complete o objetivo tático da missão'},
 bossfight:{title:'BATALHA DE CHEFES',goal:1,desc:'Derrote o chefe e seus reforços'}
};

const GM={
 active:null,
 // TDM
 tdmKills:0,tdmLimit:30,tdmTime:300,tdmEnemyScore:0,
 // Domination
 points:[],domScore:0,domEnemy:0,domLimit:100,
 // Bomb
 bomb:null,bombState:'carry',bombTimer:0,bombPlanted:false,bombSite:null,defuseProg:0,
 // Hostage
 hostages:[],rescued:0,extract:null,needRescue:3,
 // Zombie
 zWave:0,zToSpawn:0,zSpawnT:0,
 // SpecOps
 obj:null,objDone:false,
 // Boss
 bossesLeft:0
};

function gmClear(){
 // remove mode visuals
 if(GM.points)GM.points.forEach(p=>{if(p.mesh)scene.remove(p.mesh);if(p.ring)scene.remove(p.ring);});
 if(GM.bomb&&GM.bomb.mesh)scene.remove(GM.bomb.mesh);
 if(GM.hostages)GM.hostages.forEach(h=>{if(h.mesh)scene.remove(h.mesh);});
 if(GM.extract&&GM.extract.mesh)scene.remove(GM.extract.mesh);
 Object.assign(GM,{
  active:null,tdmKills:0,tdmEnemyScore:0,tdmTime:300,
  points:[],domScore:0,domEnemy:0,
  bomb:null,bombState:'carry',bombTimer:0,bombPlanted:false,bombSite:null,defuseProg:0,
  hostages:[],rescued:0,extract:null,
  zWave:0,zToSpawn:0,zSpawnT:0,
  obj:null,objDone:false,bossesLeft:0
 });
}

function gmMkMarker(x,z,color,y,scale){
 const g=new THREE.Mesh(
  new THREE.CylinderGeometry(.6*scale,.6*scale,.08,12),
  new THREE.MeshBasicMaterial({color,transparent:true,opacity:.55})
 );
 g.position.set(x,y||.06,z);
 scene.add(g);
 return g;
}

function gmIsSpecial(){
 return !!(GM.active&&MODES_META[GM.active]);
}

/* ========== SETUP POR MODO ========== */
function gmStart(m){
 gmClear();
 GM.active=m;
 const meta=MODES_META[m];
 if(meta)msg(meta.title+': '+meta.desc,4);

 if(m==='tdm'){
  GM.tdmKills=0;GM.tdmEnemyScore=0;GM.tdmTime=300;GM.tdmLimit=30;
  toSpawn=0;
  for(let i=0;i<5;i++)spawnEnemy(pick(['std','std','scout','heavy']),'');
  // force non-passive
  enemies.forEach(e=>{e.passive=false;if(e.state==='idle')e.state='patrol';});
 }

 if(m==='dom'){
  GM.domScore=0;GM.domEnemy=0;GM.domLimit=100;
  const sites=[[-18,8,'A'],[18,8,'B'],[0,-18,'C']];
  GM.points=sites.map(([x,z,name])=>{
   const mesh=gmMkMarker(x,z,0x4488ff,0.06,1.4);
   const ring=gmMkMarker(x,z,0x2244aa,0.04,2.2);ring.material.opacity=.25;
   return {x,z,name,owner:0,prog:0,mesh,ring}; // owner: 0 none, 1 player, -1 enemy
  });
  for(let i=0;i<4;i++)spawnEnemy(pick(['std','scout','heavy']));
 }

 if(m==='bomb'){
  GM.bombState='carry';GM.bombTimer=0;GM.bombPlanted=false;GM.defuseProg=0;
  GM.bombSite={x:0,z:-22};
  const site=gmMkMarker(0,-22,0xffaa22,0.06,1.8);
  GM.bomb={mesh:site,x:0,z:-22};
  for(let i=0;i<5;i++)spawnEnemy(pick(['std','heavy','scout','std']));
  msg('Leve a bomba até o alvo amarelo e segure [AGACHAR] para plantar',4);
 }

 if(m==='hostage'){
  GM.rescued=0;GM.needRescue=3;
  GM.extract={x:0,z:30,mesh:gmMkMarker(0,30,0x44ff88,0.06,2)};
  const spots=[[-22,-10],[22,-8],[0,-28],[-15,5],[16,-20]];
  GM.hostages=[];
  for(let i=0;i<3;i++){
   const s=spots[i];
   const mesh=new THREE.Mesh(
    new THREE.CylinderGeometry(.22,.22,1.2,8),
    new THREE.MeshLambertMaterial({color:0xeedd88})
   );
   mesh.position.set(s[0],.7,s[1]);scene.add(mesh);
   GM.hostages.push({x:s[0],z:s[1],mesh,state:'held',follow:false});
  }
  for(let i=0;i<4;i++)spawnEnemy(pick(['std','scout','heavy']));
  msg('Resgate os reféns (amarelos) e leve à zona verde',4);
 }

 if(m==='zombie'){
  GM.zWave=0;GM.zToSpawn=0;GM.zSpawnT=1;
  // first wave soon
  setTimeout(()=>{if(GM.active==='zombie'&&state==='play')gmNextZombieWave();},1500);
 }

 if(m==='specops'){
  // random tactical objective
  const ops=[
   {type:'eliminate',n:'Elimine todos os hostis prioritários',need:8},
   {type:'survive',n:'Sobreviva por 90 segundos',need:90},
   {type:'collect',n:'Colete 3 suprimentos inimigos',need:3}
  ];
  GM.obj=Object.assign({},pick(ops),{prog:0,done:false,t:0});
  toSpawn=GM.obj.type==='eliminate'?GM.obj.need:6;
  for(let i=0;i<Math.min(3,toSpawn);i++){spawnEnemy(pick(['std','scout','heavy','sniper']));toSpawn--;}
  msg('SPEC OPS: '+GM.obj.n,4);
 }

 if(m==='bossfight'){
  GM.bossesLeft=1;
  const boss=spawnEnemy('boss');
  boss.hp=boss.max=500;boss.T={...boss.T,hp:500,dmg:18,acc:.6};
  for(let i=0;i<3;i++)spawnEnemy(pick(['std','heavy']));
  msg('Derrote o CHEFE!',3);
 }
}

function gmNextZombieWave(){
 GM.zWave++;
 const n=4+GM.zWave*2;
 GM.zToSpawn=n;
 msg('ONDA ZUMBI '+GM.zWave+' — '+n+' hostis',2.5);
 for(let i=0;i<Math.min(n,5);i++){
  const e=spawnEnemy(GM.zWave>4&&Math.random()<.3?'heavy':'scout');
  // zombie-like: faster, weaker accuracy, more aggressive
  e.T={...e.T,speed:e.T.speed*1.35,acc:e.T.acc*.7,rate:e.T.rate*.7,dmg:e.T.dmg+2};
  e.state='chase';e.last.set(P.x,0,P.z);
  GM.zToSpawn--;
 }
}

/* ========== UPDATE POR FRAME ========== */
function gmUpdate(dt){
 if(!GM.active||state!=='play'||P.dead)return;

 if(GM.active==='tdm'){
  GM.tdmTime-=dt;
  if(GM.tdmKills>=GM.tdmLimit){endGame(true);return;}
  if(GM.tdmTime<=0){endGame(GM.tdmKills>GM.tdmEnemyScore);return;}
  // keep enemies in play
  if(alive<4&&spawnT<=0){spawnT=.8;spawnEnemy(pick(['std','scout','heavy','std']));}
 }

 if(GM.active==='dom'){
  GM.points.forEach(p=>{
   const pd=Math.hypot(P.x-p.x,P.z-p.z);
   let nearP=pd<4,nearE=false;
   enemies.forEach(e=>{if(e.state!=='dead'&&Math.hypot(e.pos.x-p.x,e.pos.z-p.z)<4)nearE=true;});
   if(nearP&&!nearE){p.prog=Math.min(1,p.prog+dt*.35);if(p.prog>=1)p.owner=1;}
   else if(nearE&&!nearP){p.prog=Math.max(-1,p.prog-dt*.3);if(p.prog<=-1)p.owner=-1;}
   else if(!nearP&&!nearE){p.prog+=(0-p.prog)*dt*.15;}
   // color
   if(p.mesh)p.mesh.material.color.setHex(p.owner===1?0x44ff66:p.owner===-1?0xff4455:0x4488ff);
   if(p.owner===1)GM.domScore+=dt*.9;
   if(p.owner===-1)GM.domEnemy+=dt*.7;
  });
  if(GM.domScore>=GM.domLimit){endGame(true);return;}
  if(GM.domEnemy>=GM.domLimit){endGame(false);return;}
  if(alive<3&&spawnT<=0){spawnT=2;spawnEnemy(pick(['std','scout']));}
 }

 if(GM.active==='bomb'){
  const site=GM.bombSite;
  const near=Math.hypot(P.x-site.x,P.z-site.z)<3.2;
  if(!GM.bombPlanted){
   if(near&&P.crouch){
    GM.defuseProg+=dt; // reuse as plant progress
    if(GM.defuseProg>=2.5){
     GM.bombPlanted=true;GM.bombTimer=35;GM.defuseProg=0;
     msg('BOMBA PLANTADA! Defenda por 35s',3);
     if(GM.bomb.mesh)GM.bomb.mesh.material.color.setHex(0xff2222);
    }
   }else GM.defuseProg=Math.max(0,GM.defuseProg-dt);
  }else{
   GM.bombTimer-=dt;
   // enemies try to "defuse" if near and player far
   let enemyNear=false;
   enemies.forEach(e=>{if(e.state!=='dead'&&Math.hypot(e.pos.x-site.x,e.pos.z-site.z)<3)enemyNear=true;});
   if(enemyNear&&Math.hypot(P.x-site.x,P.z-site.z)>4){
    GM.defuseProg+=dt*.5;
    if(GM.defuseProg>=3){msg('Bomba desarmada pelos inimigos!',2);endGame(false);return;}
   }else GM.defuseProg=Math.max(0,GM.defuseProg-dt);
   if(GM.bombTimer<=0){msg('BOMBA EXPLODIU!',2);if(typeof explode==='function')explode(new THREE.Vector3(site.x,.5,site.z));endGame(true);return;}
  }
  if(alive<3&&spawnT<=0){spawnT=2.2;spawnEnemy(pick(['std','heavy','scout']));}
 }

 if(GM.active==='hostage'){
  GM.hostages.forEach(h=>{
   if(h.state==='done')return;
   if(h.state==='held'){
    if(Math.hypot(P.x-h.x,P.z-h.z)<2.2){
     h.state='follow';h.follow=true;msg('Refém seguindo! Leve à extração',2);
    }
   }else if(h.state==='follow'){
    // follow player
    const dx=P.x-h.x,dz=P.z-h.z,d=Math.hypot(dx,dz);
    if(d>1.2){h.x+=dx/d*3.2*dt;h.z+=dz/d*3.2*dt;if(h.mesh)h.mesh.position.set(h.x,.7,h.z);}
    if(Math.hypot(h.x-GM.extract.x,h.z-GM.extract.z)<3){
     h.state='done';GM.rescued++;if(h.mesh){scene.remove(h.mesh);h.mesh=null;}
     msg('Refém resgatado! ('+GM.rescued+'/'+GM.needRescue+')',2);
     if(typeof addXP==='function')addXP(40,'refém');
     if(typeof addMoney==='function')addMoney(30);
    }
   }
  });
  if(GM.rescued>=GM.needRescue){endGame(true);return;}
  if(alive<3&&spawnT<=0){spawnT=2;spawnEnemy(pick(['std','scout']));}
 }

 if(GM.active==='zombie'){
  if(GM.zToSpawn>0){
   GM.zSpawnT-=dt;
   if(GM.zSpawnT<=0&&alive<6){
    const e=spawnEnemy(GM.zWave>5?'heavy':'scout');
    e.T={...e.T,speed:e.T.speed*1.4,acc:.25,rate:.28,dmg:6+GM.zWave};
    e.state='chase';e.last.set(P.x,0,P.z);
    GM.zToSpawn--;GM.zSpawnT=.6;
   }
  }else if(alive<=0){
   // next wave after short delay
   GM.zSpawnT-=dt;
   if(GM.zSpawnT<=0)gmNextZombieWave();
  }
 }

 if(GM.active==='specops'&&GM.obj){
  GM.obj.t+=dt;
  if(GM.obj.type==='survive'&&GM.obj.t>=GM.obj.need){GM.obj.done=true;endGame(true);return;}
  if(GM.obj.type==='eliminate'&&kills>=GM.obj.need){GM.obj.done=true;endGame(true);return;}
  if(GM.obj.type==='collect'&&GM.obj.prog>=GM.obj.need){GM.obj.done=true;endGame(true);return;}
  if(alive<3&&toSpawn>0&&spawnT<=0){spawnT=1.5;spawnEnemy(pick(['std','scout','heavy']));toSpawn--;}
  if(alive+toSpawn<=0&&GM.obj.type==='eliminate'&&kills<GM.obj.need){
   toSpawn=GM.obj.need-kills;spawnT=1;
  }
 }

 if(GM.active==='bossfight'){
  if(alive<2&&spawnT<=0&&GM.bossesLeft>0){spawnT=3;spawnEnemy('std');}
 }
}

function gmOnKill(e){
 if(!GM.active)return;
 if(GM.active==='tdm'){
  GM.tdmKills++;
  if(GM.tdmKills>=GM.tdmLimit)endGame(true);
 }
 if(GM.active==='bossfight'&&e.type==='boss'){
  GM.bossesLeft=0;msg('CHEFE DERROTADO!',3);endGame(true);
 }
 if(GM.active==='specops'&&GM.obj&&GM.obj.type==='collect'){
  GM.obj.prog++;msg('Suprimento '+GM.obj.prog+'/'+GM.obj.need,1.2);
 }
 if(GM.active==='zombie'&&alive<=0&&GM.zToSpawn<=0){
  GM.zSpawnT=2.5; // delay next wave
 }
}

function gmHudText(){
 if(!GM.active)return null;
 if(GM.active==='tdm'){
  const t=Math.max(0,GM.tdmTime|0);
  return 'TDM  '+GM.tdmKills+'/'+GM.tdmLimit+'  ·  Tempo '+t+'s';
 }
 if(GM.active==='dom'){
  const caps=GM.points.filter(p=>p.owner===1).map(p=>p.name).join('')||'-';
  return 'DOM  Você '+(GM.domScore|0)+' × Inimigo '+(GM.domEnemy|0)+'  ·  Pontos ['+caps+']';
 }
 if(GM.active==='bomb'){
  if(!GM.bombPlanted)return 'BOMBA  Plante no alvo amarelo (agachar)  '+(GM.defuseProg>0?((GM.defuseProg/2.5*100)|0)+'%':'');
  return 'BOMBA PLANTADA  '+(GM.bombTimer|0)+'s  ·  Defenda o alvo!';
 }
 if(GM.active==='hostage')return 'REFÉNS  '+GM.rescued+'/'+GM.needRescue+' resgatados  ·  Zona verde = extração';
 if(GM.active==='zombie')return 'ZUMBI  Onda '+GM.zWave+'  ·  Vivos: '+alive+(GM.zToSpawn>0?' (+'+GM.zToSpawn+')':'');
 if(GM.active==='specops'&&GM.obj){
  if(GM.obj.type==='survive')return 'SPEC OPS  Sobreviva '+(Math.max(0,GM.obj.need-GM.obj.t)|0)+'s';
  if(GM.obj.type==='eliminate')return 'SPEC OPS  Eliminações '+kills+'/'+GM.obj.need;
  return 'SPEC OPS  Suprimentos '+GM.obj.prog+'/'+GM.obj.need;
 }
 if(GM.active==='bossfight')return 'CHEFE  '+(GM.bossesLeft>0?'Derrote o chefe!':'Vitória');
 return MODES_META[GM.active]?MODES_META[GM.active].title:null;
}

function gmEndTitle(win){
 if(!GM.active)return null;
 const t=MODES_META[GM.active]?MODES_META[GM.active].title:GM.active;
 return win?(t+' — VITÓRIA'):(t+' — DERROTA');
}
