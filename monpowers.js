/* ShadowStrike — Poderes especiais dos monstros (Esqueleto, Ninja, Cactoro)
   Arquivo independente: envolve monAI / gmOnKill / gmUpdate sem alterar os demais monstros. */
const MONPW={
 skeleton:{chance:.30,hpFrac:.5,delay:2},
 ninja:{dur:3,speedMul:1.4,cd:8,opacity:.22,range:35},
 cactoro:{chance:.25,frac:.15,max:8}
};
const MONPW_FX=[];
function monPwRing(pos,col,r0,r1,life){
 try{const m=new THREE.Mesh(new THREE.RingGeometry(.6,.8,24),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
  m.rotation.x=-Math.PI/2;m.position.set(pos.x,(pos.y||0)+.06,pos.z);m.scale.setScalar(r0);scene.add(m);
  MONPW_FX.push({m,t:0,life,r0,r1});}catch(err){}
}
function monPwUpdFx(dt){
 for(let i=MONPW_FX.length-1;i>=0;i--){const f=MONPW_FX[i];f.t+=dt;const k=Math.min(1,f.t/f.life);
  f.m.scale.setScalar(f.r0+(f.r1-f.r0)*k);f.m.material.opacity=.8*(1-k);
  if(k>=1){scene.remove(f.m);f.m.geometry.dispose();f.m.material.dispose();MONPW_FX.splice(i,1);}}
}
function monPwPulse(e,amt,dur){e.pw.pulse={t:0,amt,dur};}
function monPwInit(e){
 if(e.pw)return e.pw;
 e.pw={revived:false,reviveT:-1,invisT:0,cd:2+Math.random()*3,baseT:e.MT,pulse:null};
 if(e.mkey==='ninja'){
  if(!e.m.pwMats){e.m.pwMats=[];e.m.holder.traverse(o=>{if(!o.isMesh)return;
   const c=mat=>{const m=mat.clone();e.m.pwMats.push({m,op:m.opacity,tr:m.transparent});return m;};
   o.material=Array.isArray(o.material)?o.material.map(c):c(o.material);});}
  monPwSetInvis(e,false);
 }
 return e.pw;
}
function monPwSetInvis(e,on){
 for(const p of e.m.pwMats||[]){p.m.transparent=on?true:p.tr;p.m.opacity=on?MONPW.ninja.opacity:p.op;p.m.depthWrite=!on;p.m.needsUpdate=true;}
 if(e.bar&&e.bar.grp)e.bar.grp.scale.setScalar(on?.0001:1);
}
function monPwNinjaEnd(e){
 const pw=e.pw;pw.invisT=0;e.MT=pw.baseT;monPwSetInvis(e,false);
 burst(e.pos.clone().setY(1),8,0x555566,.5,2,.3,1.2);snd(240,.22,'sine',.12,700);
}
/* Cactoro: chamado pelo sistema de tiro */
function monPwOnShot(e,dmg,point){
 if(!e||!e.monster||e.mkey!=='cactoro'||e.hp<=0||P.dead)return;
 if(Math.random()>=MONPW.cactoro.chance)return;
 const r=Math.min(MONPW.cactoro.max,Math.max(1,dmg*MONPW.cactoro.frac));
 monPwInit(e);monPwPulse(e,.18,.35);
 const p=(point||e.pos.clone().setY(1));
 burst(p,10,0x7fd04a,.35,5,.2,1.1);burst(e.pos.clone().setY(1),8,0xe8f2a0,.3,6,0,.7);
 monPwRing(e.pos,0x8fe05a,.4,2.2,.4);
 snd(1500,.08,'square',.14,500);setTimeout(()=>snd(900,.12,'triangle',.12,300),60);
 hurt(r,e.pos);
 if(typeof msg==='function')msg('ESPINHOS! -'+Math.round(r),.8);
}

const _pwAI=monAI;
monAI=function(e,dt){
 if(!e.monster||(e.mkey!=='skeleton'&&e.mkey!=='ninja'&&e.mkey!=='cactoro')){_pwAI(e,dt);return;}
 const pw=monPwInit(e);
 /* animação de pulso (escala do modelo) */
 if(pw.pulse){pw.pulse.t+=dt;const k=pw.pulse.t/pw.pulse.dur;
  const s=MON.assets[e.mkey].scale*(1+Math.sin(Math.min(1,k)*Math.PI)*pw.pulse.amt);e.m.holder.scale.setScalar(s);
  if(k>=1){e.m.holder.scale.setScalar(MON.assets[e.mkey].scale);pw.pulse=null;}}
 /* ESQUELETO: ressurreição */
 if(e.mkey==='skeleton'&&e.state==='dead'&&pw.reviveT>=0){
  pw.reviveT-=dt;
  e.dead=Math.min(e.dead,2.5);_pwAI(e,dt);
  if(Math.random()<dt*14)burst(e.pos.clone().setY(.3),2,0x9a6bff,.5,1.2,-1.5,1);
  if(pw.reviveT<=0){
   pw.reviveT=-1;pw.revived=true;
   e.hp=Math.round(e.max*MONPW.skeleton.hpFrac);e._lastHp=e.hp;e.state='chase';e.dead=0;e.seen=true;
   e.g.rotation.x=0;e.g.position.y=0;e.atkCD=.8;e.hitT=0;
   e.m.cur=null;e.m.mixer.stopAllAction();monPlay(e,'idle',0);
   e.m.body.userData.enemy=e;e.m.head.userData.enemy=e;
   alive++;if(MON.killed>0)MON.killed--;
   monPwPulse(e,.25,.6);monPwRing(e.pos,0x9a6bff,.3,3,.9);monPwRing(e.pos,0xd8c8ff,.2,1.8,.6);
   burst(e.pos.clone().setY(1),24,0xb08cff,.8,4,1,1.4);
   snd(80,.6,'sawtooth',.18,320);setTimeout(()=>snd(660,.35,'sine',.14,990),250);
   if(typeof msg==='function')msg('O ESQUELETO RESSUSCITOU!',1.6);
   monSetBar(e);if(typeof updHud==='function')updHud();
  }
  return;
 }
 /* NINJA: invisibilidade ativada pela IA */
 if(e.mkey==='ninja'&&e.state!=='dead'){
  pw.cd=Math.max(0,pw.cd-dt);
  if(pw.invisT>0){
   pw.invisT-=dt;
   if(Math.random()<dt*6)burst(e.pos.clone().setY(.8),1,0x333344,.4,.8,.2,.9);
   if(pw.invisT<=0)monPwNinjaEnd(e);
  }else if(pw.cd<=0&&(e.state==='chase'||e.state==='attack')&&!P.dead){
   const d=Math.hypot(P.x-e.pos.x,P.z-e.pos.z);
   if(d<MONPW.ninja.range&&d>2.2){
    pw.invisT=MONPW.ninja.dur;pw.cd=MONPW.ninja.cd+MONPW.ninja.dur;
    e.MT=Object.assign({},pw.baseT,{speed:pw.baseT.speed*MONPW.ninja.speedMul});
    monPwSetInvis(e,true);monPwPulse(e,-.15,.3);
    burst(e.pos.clone().setY(1),16,0x444455,.7,3,.5,1.6);monPwRing(e.pos,0x6a6a80,.3,2.4,.5);
    snd(1100,.3,'sine',.13,180);setTimeout(()=>snd(400,.2,'triangle',.08,120),90);
   }
  }
 }
 _pwAI(e,dt);
};

const _pwKill=gmOnKill;
gmOnKill=function(e){
 if(e&&e.monster&&GM.active==='monsters'){
  const pw=monPwInit(e);
  if(e.mkey==='ninja'&&pw.invisT>0)monPwNinjaEnd(e);
  if(e.mkey==='skeleton'&&!pw.revived&&!e.exploded&&Math.random()<MONPW.skeleton.chance){
   pw.reviveT=MONPW.skeleton.delay;
   setTimeout(()=>{if(pw.reviveT>=0){snd(140,.4,'sawtooth',.1,90);}},500);
  }
 }
 _pwKill(e);
};
const _pwUpd=gmUpdate;
gmUpdate=function(dt){monPwUpdFx(dt);_pwUpd(dt);};
function monPwReviving(){return enemies.some(e=>e.monster&&e.state==='dead'&&e.pw&&e.pw.reviveT>=0);}
