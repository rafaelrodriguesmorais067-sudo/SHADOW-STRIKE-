/* ShadowStrike — Poderes especiais: Demônio (Chamas Infernais), Dino (Investida Brutal), Yeti (Rugido Congelante).
   Arquivo independente: envolve monAI / gmOnKill / gmUpdate / gmClear sem alterar os demais monstros. */
const MONPW3={
 demon:{cd:10,dur:4,cast:.5,range:16,radius:2.8,dps:9,tick:.5},
 dino:{cd:9,maxT:2.5,wind:.45,minD:5,maxD:22,speedMul:3.2,hitR:1.7,dmgMul:1.8,push:7},
 yeti:{cd:9,cast:.8,range:9,radius:7,slow:.5,slowT:3,dmgMul:.5}
};
const MONPW_KB={t:0,vx:0,vz:0};
const _pw3Geo=new THREE.SphereGeometry(1,12,8);
function monPw3Init(e){if(e.pw3)return e.pw3;e.pw3={cd:2.5+Math.random()*3,t:0,fireT:0,tick:0,aura:null,dx:0,dz:0,hit:false};return e.pw3;}
function monPw3Scale(e,f){e.m.holder.scale.setScalar(MON.assets[e.mkey].scale*f);}
function monPw3Fire(e,on){
 const pw=e.pw3;
 if(on&&!pw.aura){const m=new THREE.Mesh(_pw3Geo,new THREE.MeshBasicMaterial({color:0xff6a10,transparent:true,opacity:.25,depthWrite:false,blending:THREE.AdditiveBlending}));
  m.scale.set(1.1,e.MT.h*.62,1.1);m.position.y=e.MT.h*.5;e.g.add(m);pw.aura=m;}
 if(!on&&pw.aura){e.g.remove(pw.aura);pw.aura.material.dispose();pw.aura=null;}
}
function monPw3DemonEnd(e){const pw=e.pw3;pw.fireT=0;monPw3Fire(e,false);}
function monPw3Reset(e){if(!e.pw3)return;monPw3Scale(e,1);if(e.mkey==='demon')monPw3DemonEnd(e);}

const _pw3AI=monAI;
monAI=function(e,dt){
 if(!e.monster||(e.mkey!=='demon'&&e.mkey!=='dino'&&e.mkey!=='yeti')){_pw3AI(e,dt);return;}
 const pw=monPw3Init(e);
 if(e.state==='dead'){_pw3AI(e,dt);return;}
 pw.cd=Math.max(0,pw.cd-dt);
 const dx=P.x-e.pos.x,dz=P.z-e.pos.z,dist=Math.hypot(dx,dz)||.001;
 /* ===== DEMÔNIO: Chamas Infernais ===== */
 if(e.mkey==='demon'){
  const C=MONPW3.demon;
  if(pw.fireT>0){pw.fireT-=dt;
   if(pw.aura){const now=performance.now(),s=1+Math.sin(now*.015)*.1;pw.aura.scale.set(1.1*s,e.MT.h*.62*s,1.1*s);pw.aura.material.opacity=.2+Math.sin(now*.03)*.07;}
   if(Math.random()<dt*12)burst(e.pos.clone().setY(.3+Math.random()*e.MT.h),1,Math.random()<.5?0xff5010:0xffc020,.4,1.4,-1.5,.8);
   pw.tick-=dt;
   if(pw.tick<=0){pw.tick=C.tick;
    if(!P.dead&&dist<C.radius&&Math.abs(P.y-e.pos.y)<2){hurt(C.dps*C.tick*e.dmgMul,e.pos);snd(180+Math.random()*80,.12,'sawtooth',.07,90);}
    else snd(120,.1,'triangle',.03,80);}
   if(pw.fireT<=0)monPw3DemonEnd(e);
  }
  if(e.state==='pwfire'){
   e.m.mixer.update(dt);pw.t+=dt;e.g.rotation.y=monTurn(e.g.rotation.y,Math.atan2(dx,dz),dt*6);
   monPw3Scale(e,1+Math.sin(Math.min(1,pw.t/C.cast)*Math.PI)*.1);
   if(pw.t>=C.cast){monPw3Scale(e,1);e.state='chase';}
   monSetBar(e);return;
  }
  if(pw.cd<=0&&pw.fireT<=0&&e.state==='chase'&&!P.dead&&dist<C.range){
   e.state='pwfire';pw.t=0;pw.fireT=C.dur+C.cast;pw.tick=C.cast;pw.cd=C.dur+C.cd;
   monPw3Fire(e,true);const a=monPlay(e,'attack',.1);if(a)a.timeScale=.9;
   monPwRing(e.pos,0xff5010,.4,C.radius*1.3,.6);burst(e.pos.clone().setY(1),18,0xff6010,.6,3,-1,1.2);
   snd(70,.6,'sawtooth',.22,160);snd(300,.4,'square',.06,90);
   if(typeof msg==='function')msg('O DEMÔNIO ACENDEU AS CHAMAS INFERNAIS!',1.4);
   monSetBar(e);return;
  }
 }
 /* ===== DINO: Investida Brutal ===== */
 if(e.mkey==='dino'){
  const C=MONPW3.dino;
  if(e.state==='pwcharge'){
   e.m.mixer.update(dt);pw.t+=dt;
   if(pw.t<C.wind){/* preparação: recua o corpo e raspa o chão */
    e.g.rotation.y=monTurn(e.g.rotation.y,Math.atan2(dx,dz),dt*10);pw.dx=dx/dist;pw.dz=dz/dist;
    monPw3Scale(e,1-.08*Math.sin(pw.t/C.wind*Math.PI));
    if(Math.random()<dt*15)burst(e.pos.clone().setY(.15),1,0x8a7a5a,.3,1.5,.5,.8);
   }else{
    const sp=e.MT.speed*C.speedMul*dt;
    /* leve correção de rumo */
    const tx=dx/dist,tz=dz/dist;pw.dx+=(tx-pw.dx)*dt*1.5;pw.dz+=(tz-pw.dz)*dt*1.5;const n=Math.hypot(pw.dx,pw.dz)||1;pw.dx/=n;pw.dz/=n;
    const nx=e.pos.x+pw.dx*sp,nz=e.pos.z+pw.dz*sp;
    let stop=false;
    if(!monBlocked(nx,nz,.6)){e.pos.x=nx;e.pos.z=nz;}else stop=true;
    e.g.rotation.y=Math.atan2(pw.dx,pw.dz);
    if(Math.random()<dt*25)burst(e.pos.clone().setY(.15),1,0x9a8a6a,.4,2,.6,1);
    if(!pw.hit&&!P.dead&&dist<C.hitR&&Math.abs(P.y-e.pos.y)<1.8){
     pw.hit=true;stop=true;hurt(e.MT.dmg*e.dmgMul*C.dmgMul,e.pos);
     MONPW_KB.t=.35;MONPW_KB.vx=pw.dx*C.push/.35;MONPW_KB.vz=pw.dz*C.push/.35;
     burst(e.pos.clone().setY(1.2),16,0xffe0a0,.5,4,.4,1.2);snd(60,.35,'square',.25,40);snd(220,.15,'sawtooth',.12,80);
     if(typeof msg==='function')msg('INVESTIDA BRUTAL!',1.1);
    }
    if(stop||pw.t>=C.wind+C.maxT){if(stop&&!pw.hit){monPwRing(e.pos,0xc0a070,.3,2.2,.4);snd(80,.25,'square',.15,50);}
     e.state='chase';e.atkCD=Math.max(e.atkCD,.5);const a=monPlay(e,'run',.15);if(a)a.timeScale=1;}
   }
   monSetBar(e);return;
  }
  if(pw.cd<=0&&e.state==='chase'&&!P.dead&&dist>C.minD&&dist<C.maxD&&e.hitT<=0){
   e.state='pwcharge';pw.t=0;pw.hit=false;pw.cd=C.cd;pw.dx=dx/dist;pw.dz=dz/dist;
   const a=monPlay(e,'run',.08);if(a)a.timeScale=2.2;
   snd(85,.5,'sawtooth',.22,45);burst(e.pos.clone().setY(.2),10,0x8a7a5a,.4,2.5,.5,1);
   if(typeof aiNoise==='function')aiNoise(e.pos.x,e.pos.z,25);
   monSetBar(e);return;
  }
 }
 /* ===== YETI: Rugido Congelante ===== */
 if(e.mkey==='yeti'){
  const C=MONPW3.yeti;
  if(e.state==='pwfreeze'){
   e.m.mixer.update(dt);const prev=pw.t;pw.t+=dt;
   e.g.rotation.y=monTurn(e.g.rotation.y,Math.atan2(dx,dz),dt*6);
   const k=Math.min(1,pw.t/C.cast);monPw3Scale(e,1+(k<.6?Math.sin(k/.6*Math.PI*.5)*.12:.12-(k-.6)/.4*.2));
   if(Math.random()<dt*10)burst(e.pos.clone().setY(1.8),1,0xbfeaff,.3,1,.3,.8);
   if(prev<C.cast*.75&&pw.t>=C.cast*.75){/* batida no chão */
    monPwRing(e.pos,0x9fe0ff,.4,C.radius,.7);monPwRing(e.pos,0xffffff,.25,C.radius*.6,.5);
    burst(e.pos.clone().setY(.3),22,0xcff4ff,.6,7,.4,1.5);
    snd(50,.5,'square',.22,30);snd(1400,.6,'sine',.07,2600);setTimeout(()=>snd(1800,.3,'triangle',.05,900),150);
    if(!P.dead&&dist<C.radius&&Math.abs(P.y-e.pos.y)<2){
     hurt(e.MT.dmg*e.dmgMul*C.dmgMul,e.pos);
     MONPW_SLOW.f=C.slow;MONPW_SLOW.t=C.slowT;
     MONPW_FROST.t=C.slowT;
     if(typeof msg==='function')msg('CONGELADO! (lento)',1.3);
    }
   }
   if(pw.t>=C.cast){monPw3Scale(e,1);e.state='chase';}
   monSetBar(e);return;
  }
  if(pw.cd<=0&&e.state==='chase'&&!P.dead&&dist<C.range&&e.hitT<=0){
   e.state='pwfreeze';pw.t=0;pw.cd=C.cd;
   const a=monPlay(e,'attack',.1);if(a)a.timeScale=.75;
   snd(75,.7,'sawtooth',.2,110);snd(110,.6,'triangle',.1,60);
   if(typeof msg==='function')msg('O YETI SOLTOU UM RUGIDO CONGELANTE!',1.3);
   monSetBar(e);return;
  }
 }
 _pw3AI(e,dt);
};
/* sobreposição azul de gelo na tela (leve: um único div) */
const MONPW_FROST={t:0,el:null};
function monPw3Frost(){
 if(!MONPW_FROST.el){const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .25s;box-shadow:inset 0 0 120px 40px rgba(150,220,255,.55)';document.body.appendChild(d);MONPW_FROST.el=d;}
 MONPW_FROST.el.style.opacity=MONPW_FROST.t>0?Math.min(1,MONPW_FROST.t):0;
}
const _pw3Kill=gmOnKill;
gmOnKill=function(e){if(e&&e.monster&&e.pw3)monPw3Reset(e);_pw3Kill(e);};
const _pw3Upd=gmUpdate;
gmUpdate=function(dt){
 if(MONPW_KB.t>0){const s=Math.min(dt,MONPW_KB.t);MONPW_KB.t-=s;
  if(!P.dead&&typeof moveCollide==='function'){const dx=MONPW_KB.vx*s,dz=MONPW_KB.vz*s,n=Math.min(10,Math.ceil(Math.hypot(dx,dz)/.28)||1);
   for(let i=0;i<n;i++)moveCollide(P,dx/n,dz/n,PR,1.6);}}
 if(MONPW_FROST.t>0||(MONPW_FROST.el&&MONPW_FROST.el.style.opacity!=='0')){MONPW_FROST.t=Math.max(0,MONPW_FROST.t-dt);monPw3Frost();}
 _pw3Upd(dt);
};
const _pw3Clear=gmClear;
gmClear=function(){for(const e of enemies)if(e.monster&&e.pw3)monPw3Reset(e);MONPW_KB.t=0;MONPW_FROST.t=0;if(MONPW_FROST.el)MONPW_FROST.el.style.opacity=0;_pw3Clear();};
