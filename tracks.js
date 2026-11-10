"use strict";
/* RASTREAMENTO: pegadas realistas, degradação e IA de investigação */

const TRACK={
 pool:[],
 max:48,           // limite total (mobile)
 playerCD:0,
 side:1,
 // dados lógicos (para IA) — não só mesh
 prints:[],        // {x,z,yaw,age,maxAge,who:'player'|'enemy',run,id}
 nextId:1,
 invCD:0           // throttle global de checks de IA
};

const TRACK_COLS={
 dirt:0x4a3c28,
 mud:0x2a2218,
 sand:0x9a8a5a,
 grass:0x3a4a28,
 default:0x3a3228
};

function trackSurface(x,z){
 // heurística simples por zona do mapa (sem physics extra)
 const r=Math.hypot(x,z);
 if(r>42)return 'sand';
 if(Math.abs(x)>28||Math.abs(z)>28)return 'dirt';
 // perto de “áreas baixas” / centro industrial = mud se chovendo
 if(typeof ENV!=='undefined'&&(ENV.weather==='rain'||ENV.weather==='storm')){
  if(Math.abs(x)<20&&Math.abs(z)<25)return 'mud';
 }
 return 'grass';
}

function trackInit(){
 if(TRACK.pool.length)return;
 for(let i=0;i<TRACK.max;i++){
  const g=new THREE.Group();
  // sola (elipse aproximada com plano)
  const sole=new THREE.Mesh(
   new THREE.PlaneGeometry(.18,.09),
   new THREE.MeshBasicMaterial({color:TRACK_COLS.default,transparent:true,opacity:0,depthWrite:false})
  );
  sole.rotation.x=-Math.PI/2;
  // calcanhar um pouco mais largo
  const heel=new THREE.Mesh(
   new THREE.PlaneGeometry(.14,.07),
   new THREE.MeshBasicMaterial({color:TRACK_COLS.default,transparent:true,opacity:0,depthWrite:false})
  );
  heel.rotation.x=-Math.PI/2;
  heel.position.set(0,0.001,.06);
  g.add(sole);g.add(heel);
  g.visible=false;
  g.userData={sole,heel,life:0,max:1,who:''};
  scene.add(g);
  TRACK.pool.push(g);
 }
}

function trackAlloc(){
 // reutiliza o mais antigo / invisível
 let best=null,bestLife=-1;
 for(const m of TRACK.pool){
  if(!m.visible)return m;
  if(m.userData.life>bestLife){bestLife=m.userData.life;best=m;}
 }
 return best;
}

function trackAdd(x,z,yaw,who,run){
 trackInit();
 const surf=trackSurface(x,z);
 // superfície “dura” (improvável): ainda marca, mas fraco
 const isSoft=surf==='dirt'||surf==='mud'||surf==='sand'||surf==='grass';
 if(!isSoft)return;

 const m=trackAlloc();
 if(!m)return;
 const col=TRACK_COLS[surf]||TRACK_COLS.default;
 m.userData.sole.material.color.setHex(col);
 m.userData.heel.material.color.setHex(col);

 const side=TRACK.side*.11;TRACK.side*=-1;
 const sy=Math.sin(yaw),cy=Math.cos(yaw);
 // offset lateral + ligeiro para trás
 const px=x+cy*side-sy*.05,pz=z-sy*side-cy*.05;
 m.position.set(px,0.025,pz);
 m.rotation.y=-yaw+(run?0:0);
 m.visible=true;

 // vida útil
 let maxAge=18;
 if(surf==='mud')maxAge=28;
 if(surf==='sand')maxAge=14;
 if(surf==='grass')maxAge=10;
 if(typeof ENV!=='undefined'){
  if(ENV.weather==='rain')maxAge*=.45;
  if(ENV.weather==='storm')maxAge*=.3;
  if(ENV.weather==='fog')maxAge*=.85;
 }
 if(run)maxAge*=.85;

 const op0=surf==='mud'?.55:surf==='dirt'?.42:.32;
 m.userData.life=0;
 m.userData.max=maxAge;
 m.userData.who=who;
 m.userData.op0=op0*(run?1.1:1);
 m.userData.sole.material.opacity=m.userData.op0;
 m.userData.heel.material.opacity=m.userData.op0*.9;
 m.scale.set(run?1.15:1,1,run?1.2:1);

 // registro lógico
 const id=TRACK.nextId++;
 TRACK.prints.push({id,x:px,z:pz,yaw,age:0,maxAge,who,run:!!run,surf});
 // limite de registros
 if(TRACK.prints.length>TRACK.max)TRACK.prints.shift();
 m.userData.tid=id;
}

function trackUpdate(dt){
 if(!TRACK.pool.length)return;
 // fade visual
 for(const m of TRACK.pool){
  if(!m.visible)continue;
  m.userData.life+=dt;
  const u=m.userData.life/m.userData.max;
  if(u>=1){m.visible=false;m.userData.sole.material.opacity=0;continue;}
  // fade natural (mais rápido no fim)
  const fade=u<.5?1:(1-(u-.5)*2);
  const op=m.userData.op0*Math.max(0,fade);
  m.userData.sole.material.opacity=op;
  m.userData.heel.material.opacity=op*.9;
 }
 // age logical prints
 for(let i=TRACK.prints.length-1;i>=0;i--){
  const p=TRACK.prints[i];
  p.age+=dt;
  if(p.age>=p.maxAge)TRACK.prints.splice(i,1);
 }
}

function trackPlayerStep(dt){
 if(typeof P==='undefined'||!P.ground||P.dead)return;
 const hs=typeof MV!=='undefined'?MV.hs:0;
 if(hs<1.0)return;
 TRACK.playerCD-=dt;
 if(TRACK.playerCD>0)return;
 // espaçamento por velocidade
 const run=hs>4.2||(typeof sprHeld!=='undefined'&&sprHeld)||(typeof inp!=='undefined'&&inp.sprint);
 TRACK.playerCD=run?.22:.36;
 trackAdd(P.x,P.z,P.yaw,'player',run);
}

function trackEnemyStep(e,mx,mz,spd,dt){
 if(!e||e.state==='dead'||!(mx||mz))return;
 e._trCD=(e._trCD||0)-dt;
 if(e._trCD>0)return;
 const run=spd>3.5;
 e._trCD=run?.28:.42;
 const yaw=Math.atan2(-mx,-mz);
 trackAdd(e.pos.x,e.pos.z,yaw,'enemy',run);
}

/** Pegada do jogador mais próxima e “fresca” o bastante para investigar */
function trackFindPlayerNear(x,z,radius){
 let best=null,bd=radius;
 for(const p of TRACK.prints){
  if(p.who!=='player')continue;
  // muito antiga = difícil de seguir
  if(p.age>p.maxAge*.85)continue;
  const d=Math.hypot(p.x-x,p.z-z);
  if(d<bd){bd=d;best=p;}
 }
 return best;
}

/** Seguir trilha: próxima pegada na direção da trilha a partir de (x,z) */
function trackFollowFrom(x,z,yawHint){
 let best=null,score=-1e9;
 for(const p of TRACK.prints){
  if(p.who!=='player')continue;
  if(p.age>p.maxAge*.9)continue;
  const d=Math.hypot(p.x-x,p.z-z);
  if(d<0.8||d>14)continue;
  // preferir pegadas à frente e mais recentes
  const ang=Math.atan2(p.x-x,p.z-z);
  let da=ang-yawHint;da=Math.atan2(Math.sin(da),Math.cos(da));
  const fresh=1-p.age/p.maxAge;
  const sc=fresh*2-d*.15-Math.abs(da)*.5;
  if(sc>score){score=sc;best=p;}
 }
 return best;
}

/** Inimigos veem pegadas do player e entram em investigate/track */
function trackAI(e,dt){
 if(!e||e.state==='dead'||e.passive)return;
 // classes e dificuldade
 const role=e.role||'rifle';
 const skill=(role==='scout'?1.2:role==='sniper'?.7:role==='heavy'?.6:1);
 let chance=0.4*skill;
 if(typeof DIFF!=='undefined')chance*=(DIFF.hear/28);
 if(typeof ENV!=='undefined'&&(ENV.weather==='rain'||ENV.weather==='storm'))chance*=.45;

 // só periodicamente
 e._trAI=(e._trAI||0)-dt;
 if(e._trAI>0)return;
 e._trAI=.7+Math.random()*.5;

 // se já em combate direto, não precisa
 if(e.los&&(e.state==='attack'||e.state==='chase'))return;

 const yaw=e.g.rotation.y;
 const print=trackFindPlayerNear(e.pos.x,e.pos.z,7*skill);
 if(!print){
  // pode estar seguindo trilha
  if(e.state==='track'&&e.trackTarget){
   const t=e.trackTarget;
   if(t.age>=t.maxAge){e.state='search';e.t=4;e.trackTarget=null;return;}
   const nd=Math.hypot(t.x-e.pos.x,t.z-e.pos.z);
   if(nd<1.2){
    // pegar próxima na trilha
    const next=trackFollowFrom(t.x,t.z,t.yaw);
    if(next){e.trackTarget=next;e.last.set(next.x,0,next.z);}
    else{e.state='search';e.t=5;e.trackTarget=null;}
   }
  }
  return;
 }

 if(Math.random()>chance)return;

 // descobriu pegada
 e.trackTarget=print;
 e.last.set(print.x,0,print.z);
 if(['patrol','idle','search','investigate'].includes(e.state)){
  e.state='track';
  e.t=8;
 }
}

function trackUpdateAll(dt){
 trackUpdate(dt);
 trackPlayerStep(dt);
 // enemy AI tracking throttle
 TRACK.invCD-=dt;
 if(TRACK.invCD<=0&&typeof enemies!=='undefined'){
  TRACK.invCD=.25;
  // só processa inimigos próximos ao player (perf)
  for(const e of enemies){
   if(e.state==='dead')continue;
   const d=Math.hypot(e.pos.x-P.x,e.pos.z-P.z);
   if(d<45)trackAI(e,dt);
  }
 }
}

/** Movimento no estado 'track' — chamado pelo enemyAI se estado existir */
function trackMoveEnemy(e){
 if(!e.trackTarget)return null;
 const t=e.trackTarget;
 const dx=t.x-e.pos.x,dz=t.z-e.pos.z,d=Math.hypot(dx,dz)||1;
 return {mx:dx/d,mz:dz/d,face:[dx,dz],spdMul:.85};
}
