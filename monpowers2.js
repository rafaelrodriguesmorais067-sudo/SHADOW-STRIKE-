/* ShadowStrike — Poderes especiais: Alien (Salto), Caveira Fantasma (Teletransporte), Orc (Grito de Guerra).
   Arquivo independente: envolve monAI / gmOnKill / mvMove sem alterar os demais monstros. */
const MONPW2={
 alien:{cd:7,minD:5,maxD:15,dur:.95,height:3.6,radius:3.4,dmgMul:.9,slow:.5,slowT:1.5},
 ghost:{cd:8,minD:5,maxD:45,fade:.35},
 orc:{cd:7,dur:5,roar:.7,speedMul:1.3,dmgMul:1.35,range:18}
};
/* lentidão do jogador (Alien) */
const MONPW_SLOW={t:0,f:1};
if(typeof mvMove==='function'){const _mv=mvMove;mvMove=function(dx,dz,h){const k=MONPW_SLOW.t>0?MONPW_SLOW.f:1;return _mv(dx*k,dz*k,h);};}
const _pw2AuraGeo=new THREE.SphereGeometry(1,12,8);
function monPw2Init(e){
 if(e.pw2)return e.pw2;
 e.pw2={cd:2+Math.random()*3,t:0,phase:0,buffT:0,baseT:e.MT,baseDmg:e.dmgMul,sx:0,sz:0,tx:0,tz:0,aura:null};
 return e.pw2;
}
function monPw2Scale(e,f){e.m.holder.scale.setScalar(MON.assets[e.mkey].scale*f);}
function monPw2Free(x,z){return !monBlocked(x,z,.5)&&(typeof canSee!=='function'||true);}
/* ---- ALIEN ---- */
function monPw2AlienLand(e){
 const C=MONPW2.alien;e.pos.y=0;
 monPwRing(e.pos,0x9dff6a,.4,C.radius*1.2,.5);monPwRing(e.pos,0xffffff,.2,C.radius*.7,.35);
 burst(e.pos.clone().setY(.3),18,0x8a7a5a,.6,6,.5,1.4);
 snd(55,.4,'sawtooth',.25,30);snd(160,.2,'square',.12,60);
 if(typeof aiNoise==='function')aiNoise(e.pos.x,e.pos.z,20);
 const d=Math.hypot(P.x-e.pos.x,P.z-e.pos.z);
 if(!P.dead&&d<C.radius&&Math.abs(P.y-e.pos.y)<1.8){
  hurt(e.MT.dmg*e.dmgMul*C.dmgMul*(1-d/C.radius*.5),e.pos);
  MONPW_SLOW.t=C.slowT;MONPW_SLOW.f=C.slow;
  if(typeof msg==='function')msg('ONDA DE IMPACTO! (lento)',1.2);
 }
}
/* ---- CAVEIRA: destino atrás/perto do jogador ---- */
function monPw2GhostSpot(){
 const tries=[[0,-3],[2.5,-2.5],[-2.5,-2.5],[3,0],[-3,0],[0,-4.5]];
 for(const[sx,bz] of tries){
  const b=-bz,x=P.x+Math.sin(P.yaw)*b+Math.cos(P.yaw)*sx,z=P.z+Math.cos(P.yaw)*b-Math.sin(P.yaw)*sx;
  if(monPw2Free(x,z))return{x,z};
 }
 return null;
}
/* ---- ORC: aura ---- */
function monPw2Aura(e,on){
 const pw=e.pw2;
 if(on&&!pw.aura){const m=new THREE.Mesh(_pw2AuraGeo,new THREE.MeshBasicMaterial({color:0xff2a10,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending}));
  m.scale.set(.9,e.MT.h*.6,.9);m.position.y=e.MT.h*.5;e.g.add(m);pw.aura=m;}
 if(!on&&pw.aura){e.g.remove(pw.aura);pw.aura.material.dispose();pw.aura=null;}
}
function monPw2OrcEnd(e){const pw=e.pw2;pw.buffT=0;e.MT=pw.baseT;e.dmgMul=pw.baseDmg;monPw2Aura(e,false);}

const _pw2AI=monAI;
monAI=function(e,dt){
 if(!e.monster||(e.mkey!=='alien'&&e.mkey!=='ghost'&&e.mkey!=='orc')){_pw2AI(e,dt);return;}
 const pw=monPw2Init(e);
 if(e.state==='dead'){_pw2AI(e,dt);return;}
 pw.cd=Math.max(0,pw.cd-dt);
 const dx=P.x-e.pos.x,dz=P.z-e.pos.z,dist=Math.hypot(dx,dz);
 /* ===== ALIEN: Salto Sobrenatural ===== */
 if(e.mkey==='alien'){
  const C=MONPW2.alien;
  if(e.state==='pwjump'){
   e.m.mixer.update(dt);pw.t+=dt;const k=Math.min(1,pw.t/C.dur);
   const x=pw.sx+(pw.tx-pw.sx)*k,z=pw.sz+(pw.tz-pw.sz)*k;
   if(!monBlocked(x,z,.45)){e.pos.x=x;e.pos.z=z;}
   e.pos.y=Math.sin(k*Math.PI)*C.height;
   e.g.rotation.y=monTurn(e.g.rotation.y,Math.atan2(dx,dz),dt*8);
   monPw2Scale(e,1+(k<.15?-.15*(1-k/.15):0)+(k>.9?-.12:0));
   if(Math.random()<dt*10)burst(e.pos.clone().setY(e.pos.y+.6),1,0x9dff6a,.3,.6,.2,.8);
   if(k>=1){monPw2Scale(e,1);monPw2AlienLand(e);e.state='chase';e.atkCD=Math.min(e.atkCD,.3);}
   monSetBar(e);return;
  }
  if(pw.cd<=0&&e.state==='chase'&&!P.dead&&dist>C.minD&&dist<C.maxD&&e.hitT<=0&&Math.abs(P.y)<1.5){
   e.state='pwjump';pw.t=0;pw.sx=e.pos.x;pw.sz=e.pos.z;
   const stop=Math.max(0,dist-1.3);pw.tx=e.pos.x+dx/dist*stop;pw.tz=e.pos.z+dz/dist*stop;
   pw.cd=C.cd;const a=monPlay(e,'run',.08);if(a)a.timeScale=1.6;
   burst(e.pos.clone().setY(.2),10,0x9dff6a,.4,3,.5,1);snd(220,.35,'sine',.16,900);
   monSetBar(e);return;
  }
 }
 /* ===== CAVEIRA FANTASMA: Teletransporte ===== */
 if(e.mkey==='ghost'){
  const C=MONPW2.ghost;
  if(e.state==='pwtele'){
   e.m.mixer.update(dt);pw.t+=dt;
   if(pw.phase===0){const k=Math.min(1,pw.t/C.fade);monPw2Scale(e,Math.max(.02,1-k));
    if(Math.random()<dt*20)burst(e.pos.clone().setY(1.6),2,0xa040ff,.6,1.5,.4,1.6);
    if(k>=1){const s=monPw2GhostSpot();
     if(s){e.pos.x=s.x;e.pos.z=s.z;e.g.rotation.y=Math.atan2(P.x-s.x,P.z-s.z);}
     pw.phase=1;pw.t=0;burst(e.pos.clone().setY(1.6),16,0x8a2be2,.8,2.5,.3,2);monPwRing(e.pos,0xb060ff,.3,2.6,.55);
     snd(300,.3,'sine',.14,1400);}
   }else{const k=Math.min(1,pw.t/C.fade);monPw2Scale(e,Math.max(.02,k));
    if(k>=1){monPw2Scale(e,1);e.state='chase';e.atkCD=Math.min(e.atkCD,.25);}}
   monSetBar(e);return;
  }
  if(pw.cd<=0&&e.state==='chase'&&!P.dead&&dist>C.minD&&dist<C.maxD){
   e.state='pwtele';pw.t=0;pw.phase=0;pw.cd=C.cd;
   monPwRing(e.pos,0xb060ff,.3,2.2,.5);burst(e.pos.clone().setY(1.6),14,0x8a2be2,.8,2,.3,2);
   snd(900,.35,'sine',.14,120);setTimeout(()=>snd(500,.2,'triangle',.08,200),120);
   monSetBar(e);return;
  }
 }
 /* ===== ORC: Grito de Guerra ===== */
 if(e.mkey==='orc'){
  const C=MONPW2.orc;
  if(pw.buffT>0){pw.buffT-=dt;
   if(pw.aura){const s=1+Math.sin(performance.now()*.012)*.08;pw.aura.scale.set(.9*s,e.pw2.baseT.h*.6*s,.9*s);pw.aura.material.opacity=.16+Math.sin(performance.now()*.02)*.06;}
   if(Math.random()<dt*6)burst(e.pos.clone().setY(1),1,0xff3010,.4,1,1,.9);
   if(pw.buffT<=0)monPw2OrcEnd(e);}
  if(e.state==='pwroar'){
   e.m.mixer.update(dt);pw.t+=dt;
   e.g.rotation.y=monTurn(e.g.rotation.y,Math.atan2(dx,dz),dt*6);
   monPw2Scale(e,1+Math.sin(Math.min(1,pw.t/C.roar)*Math.PI)*.14);
   if(pw.t>=C.roar){monPw2Scale(e,1);e.state='chase';}
   monSetBar(e);return;
  }
  if(pw.cd<=0&&pw.buffT<=0&&e.state==='chase'&&!P.dead&&dist<C.range&&dist>2.5){
   e.state='pwroar';pw.t=0;pw.cd=C.dur+C.cd;pw.buffT=C.dur+C.roar;
   e.MT=Object.assign({},pw.baseT,{speed:pw.baseT.speed*C.speedMul});e.dmgMul=pw.baseDmg*C.dmgMul;
   monPw2Aura(e,true);const a=monPlay(e,'attack',.1);if(a)a.timeScale=.8;
   monPwRing(e.pos,0xff3010,.4,4,.7);burst(e.pos.clone().setY(1.8),14,0xff4020,.6,3,.5,1.4);
   snd(90,.7,'sawtooth',.26,55);snd(140,.6,'square',.1,70);
   if(typeof aiNoise==='function')aiNoise(e.pos.x,e.pos.z,30);
   if(typeof msg==='function')msg('O ORC SOLTOU UM GRITO DE GUERRA!',1.4);
   monSetBar(e);return;
  }
 }
 _pw2AI(e,dt);
};
const _pw2Kill=gmOnKill;
gmOnKill=function(e){
 if(e&&e.monster&&e.pw2){
  if(e.pos.y>0)e.pos.y=0;
  monPw2Scale(e,1);
  if(e.mkey==='orc')monPw2OrcEnd(e);
 }
 _pw2Kill(e);
};
const _pw2Upd=gmUpdate;
gmUpdate=function(dt){if(MONPW_SLOW.t>0)MONPW_SLOW.t=Math.max(0,MONPW_SLOW.t-dt);_pw2Upd(dt);};
const _pw2Clear=gmClear;
gmClear=function(){for(const e of enemies)if(e.monster&&e.pw2){monPw2Scale(e,1);if(e.mkey==='orc')monPw2OrcEnd(e);e.pos.y=0;}MONPW_SLOW.t=0;_pw2Clear();};
