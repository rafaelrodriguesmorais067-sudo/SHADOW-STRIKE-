"use strict";
/* MOVEMENT v13: sistema avançado de movimento em primeira pessoa.
   Carrega depois do game.js e ANTES do br.js. Substitui updatePlayer() e envolve updateWeapon()/resetGame(),
   sem apagar nada dos outros arquivos. Recursos:
   - Aceleração/desaceleração suaves (velocidade com inércia), corrida sem limite de fôlego
   - Deslizar (slide) com impulso, atrito, câmera baixa e recarga
   - Inclinar (lean) esquerda/direita com colisão (não atravessa paredes)
   - Agachar suave (altura da câmera e velocidade ajustáveis), com checagem de teto
   - Pulo melhorado (coyote time, buffer, gravidade de queda, pouso com impacto)
   - Esquiva direcional (dodge) com recarga
   - Câmera: head bob realista (passo a passo), roll, respiração, FOV dinâmico, suavização de degraus
   - Arma: sway por rotação da câmera, bob, pose de corrida, deslize, agachado, pulo, recarga, mira
   Tudo ajustável em MVCFG (abaixo). Colisão: movimento em sub-passos (sem atravessar paredes finas). */

/* ===== CONFIGURAÇÃO ===== */
const MVCFG={
 walk:4.2, sprint:7, aimMul:.6,
 accelWalk:13, accelSprint:5.5, decel:11, decelStop:14, airAccel:2,   /* taxas de aproximação (1/s) */
 slideMinSpeed:5.2, slideBoost:1.25, slideMin:8, slideMax:9.5, slideCool:1.6, slideEnd:3, slideMaxT:1.3, slideEye:.75, slideH:.95,
 dodgeSpeed:22,
 leanDist:.38, leanRoll:.2,
 eyeStand:EYE, eyeCrouch:1.1, crouchH:1.1,
 jumpV:7.2, gravity:20, fallMul:1.25, coyote:.1, buffer:.12, jumpCost:6
};
DASH.spd=MVCFG.dodgeSpeed;DASH.time=.28;DASH.cool=1.4; /* esquiva: ~4 m, recarga 1,4 s (usa as constantes do player.js) */

/* Ajustes do jogador (menu): intensidade do balanço da câmera e velocidade agachado */
const MVS={bob:1,crouch:.5};
try{const s=JSON.parse(localStorage.getItem('ss_mv')||'{}');
 if(typeof s.bob==='number'&&isFinite(s.bob))MVS.bob=Math.max(0,Math.min(1.5,s.bob));
 if(typeof s.crouch==='number'&&isFinite(s.crouch))MVS.crouch=Math.max(.3,Math.min(.8,s.crouch));}catch(e){}
function mvSaveS(){try{localStorage.setItem('ss_mv',JSON.stringify(MVS));}catch(e){}}

/* ===== ESTADO ===== */
const MV={
 vx:0,vz:0,hs:0,
 slide:false,slT:0,slX:0,slZ:0,slSpd:0,slCD:0,slDust:0,slK:0,
 eye:EYE,lean:0,leanEff:0,tl:false,tr:false,
 coyote:0,buf:0,jumpPrev:false,airT:0,landSlow:0,lp:0,lv:0,stepOff:0,
 phase:0,bobA:0,breath:0,stRoll:0,
 dodgeX:0,dodgeZ:0,dodgeDur:.28,
 running:false,
 lastYaw:NaN,lastPitch:NaN,sx:0,svx:0,sy:0,svy:0,swRz:0,
 spK:0,adsK:0,crK:0,rlK:0,airY:0,gox:0,goy:0,
 lastTap:{},lastStep:0,btnTxt:{}
};
function mvReset(){
 Object.assign(MV,{vx:0,vz:0,hs:0,slide:false,slT:0,slCD:0,slK:0,eye:EYE,lean:0,leanEff:0,
  coyote:0,buf:0,airT:0,landSlow:0,lp:0,lv:0,stepOff:0,phase:0,bobA:0,stRoll:0,running:false,lastYaw:NaN,lastPitch:NaN,
  sx:0,svx:0,sy:0,svy:0,swRz:0,spK:0,adsK:0,crK:0,rlK:0,airY:0,jumpPrev:false});
 if(MV.gox||MV.goy){gun.position.x-=MV.gox;gun.position.y-=MV.goy;}
 MV.gox=MV.goy=0;gun.rotation.set(0,0,0);P.dashT=0;P.dashCD=0;P.eyeH=EYE;
}

/* ===== UTILIDADES ===== */
const mvClamp=(v,a,b)=>v<a?a:(v>b?b:v);
const mvWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const mvK=(r,dt)=>1-Math.exp(-r*dt);
const mvDust=new THREE.Vector3();
function mvFit(h){return !hitsBox(P.x,P.z,P.y,PR,h);}
/* movimento em sub-passos (≤0,28 m cada): impossível atravessar paredes finas mesmo a 22 m/s */
function mvMove(dx,dz,h){
 const dist=Math.hypot(dx,dz);if(dist<1e-6)return 1;
 const n=Math.min(10,Math.ceil(dist/.28)),sx=dx/n,sz=dz/n,ox=P.x,oz=P.z;
 for(let i=0;i<n;i++)moveCollide(P,sx,sz,PR,h);
 return Math.hypot(P.x-ox,P.z-oz)/dist;
}
function mvBR(){return typeof BR!=='undefined'&&BR.drop;}
function mvOk(){return state==='play'&&!P.dead&&!mvBR();}

/* ===== AGACHAR / DESLIZAR ===== */
function slideReady(){return MV.slCD<=0&&P.ground&&!MV.slide&&MV.hs>=MVCFG.slideMinSpeed;}
function startSlide(){
 const hs=MV.hs||1;
 MV.slide=true;MV.slT=0;MV.slX=MV.vx/hs;MV.slZ=MV.vz/hs;
 MV.slSpd=mvClamp(hs*MVCFG.slideBoost,MVCFG.slideMin,MVCFG.slideMax);
 MV.slCD=MVCFG.slideCool;MV.slDust=0;P.crouch=true;
 snd(190,.4,'sawtooth',.07,55);
}
function endSlide(stayCrouch){
 if(!MV.slide)return;
 MV.slide=false;MV.vx=MV.slX*MV.slSpd;MV.vz=MV.slZ*MV.slSpd;
 if(stayCrouch)P.crouch=true;
 else{const wantRun=!!(inp.sprint||inp.keys.ShiftLeft);P.crouch=!(wantRun&&mvFit(PH));}
}
function slidePress(){
 if(!mvOk())return;
 if(MV.slide)return;
 if(slideReady()){startSlide();return;}
 if(msgT<=0){
  if(MV.slCD>0)msg('Deslize recarregando',.8);
  else msg('Corra para deslizar',.8);
 }
}
function crouchPress(){
 if(state!=='play'||P.dead)return;
 if(MV.slide){endSlide(true);return;}
 const sprinting=!!(inp.sprint||inp.keys.ShiftLeft)&&!P.crouch;
 if(sprinting&&slideReady()){startSlide();return;}
 if(P.crouch){if(mvFit(PH))P.crouch=false;else if(msgT<=0)msg('Sem espaço para levantar',1);}
 else P.crouch=true;
}

/* ===== ESQUIVA (substitui dashPlayer do player.js) ===== */
dashPlayer=function(dirOverride){
 if(P.dashCD>0||P.dead||state!=='play'||mvBR())return;
 const k=inp.keys;let mx=inp.mx,mz=inp.mz;
 if(dirOverride&&typeof dirOverride==='object'){mx=dirOverride.mx;mz=dirOverride.mz;}
 else{if(k.KeyW||k.ArrowUp)mz-=1;if(k.KeyS||k.ArrowDown)mz+=1;if(k.KeyA)mx-=1;if(k.KeyD)mx+=1;}
 const ml=Math.hypot(mx,mz);
 if(ml<.2){mx=0;mz=(inp.sprint||k.ShiftLeft)?-1:1;}else{mx/=ml;mz/=ml;}
 if(MV.slide)endSlide(false);
 P.dashDir={mx,mz};P.dashT=DASH.time;P.dashCD=DASH.cool;MV.dodgeX=mx;MV.dodgeZ=mz;MV.dodgeDur=DASH.time;
 snd(420,.15,'triangle',.25,900);
};
/* PC: toque duplo em A, D ou S = esquiva naquela direção */
document.addEventListener('keydown',e=>{
 if(e.repeat||state!=='play')return;
 const dirs={KeyA:{mx:-1,mz:0},KeyD:{mx:1,mz:0},KeyS:{mx:0,mz:1}},d=dirs[e.code];if(!d)return;
 const now=performance.now(),last=MV.lastTap[e.code]||0;MV.lastTap[e.code]=now;
 if(now-last<260){MV.lastTap[e.code]=0;dashPlayer(d);}
});

/* ===== BOTÕES DE TOQUE ===== */
hold('slide',slidePress);
hold('leanl',()=>{MV.tl=true;},()=>{MV.tl=false;});
hold('leanr',()=>{MV.tr=true;},()=>{MV.tr=false;});
TB.push('slide','leanl','leanr');
function mvBtn(id,txt,dim){
 const b=$(id);if(!b)return;
 if(MV.btnTxt[id]!==txt){MV.btnTxt[id]=txt;b.textContent=txt;}
 const o=dim?'.5':'1';if(b.style.opacity!==o)b.style.opacity=o;
}

/* ===== AJUSTES E BOTÕES ===== */
(function(){
 const back=$('setback');
 if(back){
  const l1=document.createElement('label');l1.innerHTML='Balanço da câmera <input id="bobs" type="range" min="0" max="1.5" step=".1">';
  const l2=document.createElement('label');l2.innerHTML='Velocidade agachado <input id="crsp" type="range" min=".3" max=".8" step=".05">';
  back.parentNode.insertBefore(l1,back);back.parentNode.insertBefore(l2,back);
  const a=$('bobs'),b=$('crsp');a.value=MVS.bob;b.value=MVS.crouch;
  a.oninput=e=>{MVS.bob=+e.target.value;mvSaveS();};
  b.oninput=e=>{MVS.crouch=+e.target.value;mvSaveS();};
 }
})();
function mvHud(){
 mvBtn('slide',MV.slCD>0?Math.ceil(MV.slCD)+'s':'DESLIZ.',MV.slCD>0);
 mvBtn('leanl','◀',false);mvBtn('leanr','▶',false);
 updDashBtn();
}

/* ===== ATUALIZAÇÃO DO JOGADOR ===== */
updatePlayer=function(dt){
 const k=inp.keys,sy=Math.sin(P.yaw),cy=Math.cos(P.yaw);
 let mx=inp.mx,mz=inp.mz;
 if(k.KeyW||k.ArrowUp)mz-=1;if(k.KeyS||k.ArrowDown)mz+=1;if(k.KeyA)mx-=1;if(k.KeyD)mx+=1;
 let ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml;ml=1;}
 /* timers */
 if(MV.slCD>0)MV.slCD-=dt;
 if(MV.landSlow>0)MV.landSlow-=dt;
 if(P.dashCD>0)P.dashCD-=dt;
 /* garante que não fica em pé dentro de um teto baixo */
 if(!P.crouch&&!MV.slide&&!mvFit(PH))P.crouch=true;

 /* corrida (stamina) */
 const sprintOn=!!(inp.sprint||k.ShiftLeft);
 const auto=sprintOn&&ml<=.3&&!MV.slide;
 if(auto){mx=0;mz=-1;ml=1;}
 const run=sprintOn&&!MV.slide&&!P.crouch&&!aim&&mz<.3&&ml>.3;
 if(sprintOn&&!MV.slide&&(P.crouch||aim)&&msgT<=0)msg(P.crouch?'Levante-se para correr':'Solte a mira para correr',1);
 MV.running=run&&P.ground;

 /* altura de colisão atual */
 const h=MV.slide?MVCFG.slideH:(P.crouch?MVCFG.crouchH:PH);

 /* velocidade horizontal */
 const dashing=P.dashT>0;
 if(dashing){
  P.dashT-=dt;const d=P.dashDir,t=Math.max(0,P.dashT)/MV.dodgeDur,f=.3+.7*t*Math.sqrt(t),sp=DASH.spd*f;
  MV.vx=(d.mx*cy+d.mz*sy)*sp;MV.vz=(-d.mx*sy+d.mz*cy)*sp;
 }else if(MV.slide){
  MV.slT+=dt;MV.slSpd-=(6.5+4*MV.slT)*dt;
  if(MV.slSpd<=MVCFG.slideEnd||MV.slT>MVCFG.slideMaxT){
   if(mvFit(MVCFG.crouchH)||MV.slT>2.6)endSlide(false);else MV.slSpd=Math.max(MV.slSpd,2);
  }
  if(MV.slide){MV.vx=MV.slX*MV.slSpd;MV.vz=MV.slZ*MV.slSpd;}
 }else{
  let wish=(run?MVCFG.sprint:MVCFG.walk)*(P.crouch?MVS.crouch:1)*(aim?MVCFG.aimMul:1)*(MV.landSlow>0?.7:1);
  const wx=(mx*cy+mz*sy)*wish,wz=(-mx*sy+mz*cy)*wish,ws=Math.hypot(wx,wz);
  let rate;
  if(!P.ground)rate=MVCFG.airAccel;
  else if(ml<.1)rate=MVCFG.decelStop;
  else rate=ws>MV.hs?(run?MVCFG.accelSprint:MVCFG.accelWalk):MVCFG.decel;
  const f=mvK(rate,dt);MV.vx+=(wx-MV.vx)*f;MV.vz+=(wz-MV.vz)*f;
 }

 /* movimento com colisão (sub-passos) e amortecimento ao bater */
 const ox=P.x,oz=P.z,ix=MV.vx*dt,iz=MV.vz*dt;
 mvMove(ix,iz,h);
 const ax=P.x-ox,az=P.z-oz;
 if(Math.abs(ix)>1e-4&&Math.abs(ax)<Math.abs(ix)*.5)MV.vx*=.25;
 if(Math.abs(iz)>1e-4&&Math.abs(az)<Math.abs(iz)*.5)MV.vz*=.25;
 if(MV.slide&&Math.hypot(ix,iz)>1e-4&&Math.hypot(ax,az)<Math.hypot(ix,iz)*.4)endSlide(true); /* bateu numa parede */
 MV.hs=Math.hypot(MV.vx,MV.vz);

 /* pulo: buffer + coyote time + altura variável (teclado) */
 const jh=!!(inp.jump||k.Space);
 if(jh&&!MV.jumpPrev)MV.buf=MVCFG.buffer;else MV.buf-=dt;
 if(!jh&&MV.jumpPrev&&!isTouch&&P.vy>3.6&&MV.airT<.35)P.vy*=.62;
 MV.jumpPrev=jh;
 if(P.ground)MV.coyote=MVCFG.coyote;else MV.coyote-=dt;
 if(MV.buf>0&&MV.coyote>0&&!dashing){
  if(MV.slide)endSlide(false);
  P.vy=MVCFG.jumpV;P.ground=false;MV.coyote=0;MV.buf=0;MV.airT=0;
  MV.lv-=1.4;SFX.jump();
 }
 /* gravidade (queda mais rápida que a subida; leve "pairar" no ápice) */
 const wasGround=P.ground,prevY=P.y;
 const gm=P.vy<0?MVCFG.fallMul:(P.vy<1.2?.8:1);
 P.vy-=MVCFG.gravity*gm*dt;P.y+=P.vy*dt;
 const g=groundAt(P.x,P.z,PR,P.y);
 if(P.y<=g){
  const impact=-P.vy;
  if(!wasGround&&impact>2.5){
   MV.lv-=impact*.35;
   if(impact>11)MV.landSlow=.3;
   if(impact>4)snd(110,.12,'triangle',Math.min(.3,.04*impact),55);
   if(impact>8){mvDust.set(P.x,g+.1,P.z);burst(mvDust,5,0xb8b09a,.4,2,-.5,1.3);}
  }
  if(wasGround&&P.y-prevY>.02&&g-prevY<=.55&&prevY<g)MV.stepOff-=(g-prevY); /* subir degrau: câmera suave */
  P.y=g;P.vy=0;P.ground=true;MV.airT=0;
 }else{P.ground=false;MV.airT+=dt;}
 if(MV.slide&&!P.ground&&MV.airT>.15)endSlide(true);
 if(P.vy>0){
  for(let i=0;i<colliders.length;i++){const b=colliders[i];
   if(P.x>b.x0&&P.x<b.x1&&P.z>b.z0&&P.z<b.z1&&b.bot>P.y+h-.3&&b.bot<P.y+h+P.vy*dt+.1){P.vy=0;break;}}
 }
 rescue(P,PR,h);

 /* poeira durante o deslize */
 if(MV.slide){MV.slDust-=dt;if(MV.slDust<=0){MV.slDust=.09;mvDust.set(P.x,P.y+.08,P.z);burst(mvDust,1,0xb8b09a,.35,1.6,-.3,1.4);}}

 /* altura do olho (agachar/deslizar suave) */
 const eyeT=MV.slide?MVCFG.slideEye:(P.crouch?MVCFG.eyeCrouch:MVCFG.eyeStand);
 MV.eye+=(eyeT-MV.eye)*mvK(eyeT<MV.eye?12:9,dt);
 P.eyeH=MV.eye;
 MV.slK+=((MV.slide?1:0)-MV.slK)*mvK(10,dt);

 /* mola de pouso e suavização de degrau */
 MV.lv+=(-120*MV.lp-14*MV.lv)*dt;MV.lp=mvClamp(MV.lp+MV.lv*dt,-.22,.12);
 MV.stepOff+=(-MV.stepOff)*mvK(14,dt);

 /* inclinar (lean): não com corrida, deslize, esquiva ou no ar; limitado por colisão */
 const lt=(MV.slide||dashing||run||!P.ground)?0:((MV.tr||k.KeyX?1:0)-(MV.tl||k.KeyZ?1:0));
 MV.lean+=(lt-MV.lean)*mvK(11,dt);
 if(Math.abs(MV.lean)<.002&&lt===0)MV.lean=0;
 const rx=cy,rz=-sy;
 let off=0;
 if(MV.lean!==0){
  const side=MV.lean>0?1:-1,ey=P.y+MV.eye-.15;let lim=MVCFG.leanDist;
  for(let d=.1;d<=MVCFG.leanDist+.001;d+=.1){
   if(hitsBox(P.x+rx*side*(d+.1),P.z+rz*side*(d+.1),ey,.1,.3)){lim=Math.max(0,d-.1);break;}
  }
  off=side*Math.min(Math.abs(MV.lean)*MVCFG.leanDist,lim);
 }
 MV.leanEff+=(off-MV.leanEff)*mvK(18,dt);

 /* head bob: fase proporcional à velocidade real (passo a passo) */
 const grounded=P.ground,sN=mvClamp((MV.hs-2)/5,0,1);
 MV.bobA+=(((grounded&&MV.hs>.6)?1:0)-MV.bobA)*mvK(8,dt);
 if(grounded)MV.phase+=MV.hs*dt*3.14;
 P.bob=MV.phase;
 MV.breath+=dt;
 const bs=MVS.bob*MV.bobA*(aim?.25:1)*(P.crouch?.7:1)*(MV.slide?0:1);
 const bobY=Math.sin(MV.phase)*(.012+.024*sN)*bs;
 const bobX=Math.sin(MV.phase*.5)*(.01+.016*sN)*bs;
 const bobR=Math.sin(MV.phase*.5)*(.002+.005*sN)*bs;
 const br=Math.sin(MV.breath*1.6)*.0025*MVS.bob*(1-MV.bobA);
 /* inclinação lateral ao correr/esquivar */
 const lvx=MV.vx*cy-MV.vz*sy;
 MV.stRoll+=((-lvx/7*.012)-MV.stRoll)*mvK(8,dt);
 let dRoll=0,dPitch=0;
 if(dashing){const pr=Math.sin(Math.PI*(1-P.dashT/MV.dodgeDur));dRoll=-MV.dodgeX*.1*pr;dPitch=MV.dodgeZ*.05*pr;}

 /* câmera */
 const fall=Math.max(0,-P.vy-6);
 cam.position.set(P.x+rx*(MV.leanEff+bobX),P.y+MV.stepOff+MV.eye+MV.lp+bobY+br-Math.abs(MV.leanEff)*.06,P.z+rz*(MV.leanEff+bobX));
 const roll=-MV.leanEff/MVCFG.leanDist*MVCFG.leanRoll+bobR+MV.stRoll+dRoll-.05*MV.slK;
 cam.rotation.set(P.pitch+MV.lp*.4+dPitch-.03*MV.slK,P.yaw,roll,'YXZ');
 let tf=aim?48:(run?80:75);
 if(MV.slide)tf=82;
 if(dashing)tf=88;
 else tf+=Math.min(5,fall*.5);
 if(Math.abs(cam.fov-tf)>.05){cam.fov+=(tf-cam.fov)*mvK(10,dt);cam.updateProjectionMatrix();}

 /* passos / rastejo — samples curtos + rate limit para soar natural */
 if(grounded&&MV.hs>0.9){
  const step=Math.floor(MV.phase/Math.PI);
  if(step!==MV.lastStep){
   MV.lastStep=step;
   const now=performance.now()/1000;
   if(MV.slide){
    if(now-(MV.lastMoveSfx||0)>0.28){MV.lastMoveSfx=now;if(Math.random()<.65)SFX.scrape();else SFX.cloth();}
   }else if(P.crouch){
    if(now-(MV.lastMoveSfx||0)>0.38){MV.lastMoveSfx=now;if(Math.random()<.75)SFX.cloth();else SFX.foot();}
   }else if((!aim||MV.hs>2.6)&&now-(MV.lastMoveSfx||0)>0.16){
    MV.lastMoveSfx=now;SFX.foot();
   }
  }
 }
 mvHud();
};

/* ===== ARMA: reage a corrida, pulo, deslize, agachar, recarga e mira ===== */
const _mvUpdateWeapon=updateWeapon;
updateWeapon=function(dt){
 gun.position.x-=MV.gox;gun.position.y-=MV.goy;   /* remove o deslocamento do quadro anterior */
 _mvUpdateWeapon(dt);                              /* disparo, recarga, coice e mira originais */
 if(dt<=0)return;
 const w=WEAPONS[cw],heft=.7+w.len*.4,cy=Math.cos(P.yaw),sy=Math.sin(P.yaw);
 /* taxas de rotação da câmera (limitadas: ignora teleporte/reinício) */
 let yr=0,pr=0;
 if(!isNaN(MV.lastYaw)){yr=mvClamp(mvWrap(P.yaw-MV.lastYaw)/dt,-6,6);pr=mvClamp((P.pitch-MV.lastPitch)/dt,-6,6);}
 MV.lastYaw=P.yaw;MV.lastPitch=P.pitch;
 /* molas de sway (levemente subamortecidas: a arma "atrasa" e volta com leve overshoot) */
 const tx=yr*.0045,ty=-pr*.004;
 MV.svx+=((tx-MV.sx)*120-MV.svx*14)*dt;MV.sx=mvClamp(MV.sx+MV.svx*dt,-.06,.06);
 MV.svy+=((ty-MV.sy)*120-MV.svy*14)*dt;MV.sy=mvClamp(MV.sy+MV.svy*dt,-.05,.05);
 MV.swRz+=((-yr*.012)-MV.swRz)*mvK(9,dt);
 /* misturas suaves de poses */
 const ads=aim?1:0;
 MV.adsK+=(ads-MV.adsK)*mvK(12,dt);
 const spT=(MV.running&&!aim&&!inp.fire&&reloading<=0)?1:0;
 MV.spK+=(spT-MV.spK)*mvK(9,dt);
 MV.crK+=((P.crouch?1:0)-MV.crK)*mvK(8,dt);
 MV.rlK+=((reloading>0?1:0)-MV.rlK)*mvK(8,dt);
 const sc=1-.8*MV.adsK;
 /* bob da arma (usa a mesma fase da câmera) */
 const bA=MV.bobA*MVS.bob*(MV.slide?0:1),sN=mvClamp((MV.hs-2)/5,0,1);
 const bx=Math.cos(MV.phase*.5)*(.008+.012*sN)*bA,by=Math.sin(MV.phase-.8)*(.006+.010*sN)*bA;
 /* movimento relativo à câmera: a arma atrasa ao andar de lado/frente */
 const lvx=MV.vx*cy-MV.vz*sy,lvf=-MV.vx*sy-MV.vz*cy;
 const lagX=-lvx*.0022,lagZ=lvf*.0012;
 /* no ar: sobe/desce em relação à câmera */
 const airT=P.ground?0:mvClamp(-P.vy*.003,-.03,.035);
 MV.airY+=(airT-MV.airY)*mvK(10,dt);
 const slK=MV.slK,spK=MV.spK,crK=MV.crK;
 const ox=(MV.sx*heft+lagX+bx)*sc-.05*spK-.04*slK+MV.leanEff*.15;
 const oy=(MV.sy*heft+by+MV.airY)*sc-.055*spK-.05*slK-.012*crK*(1-MV.adsK)+MV.lp*.8;
 const oz=(lagZ)*sc+.05*spK+.03*slK;
 gun.position.x+=ox;gun.position.y+=oy;gun.position.z+=oz;
 MV.gox=ox;MV.goy=oy;
 gun.rotation.x+=-.32*spK-.18*slK+(-pr*.004*heft)*sc+.35*MV.rlK+(P.ground?0:mvClamp(P.vy*.01,-.08,.08)*sc);
 gun.rotation.y=(.5*spK+.3*slK-MV.sx*2.2*heft*sc);
 gun.rotation.z=-.12*spK+.55*slK+MV.swRz*heft*sc-.25*MV.rlK-MV.stRoll*2;
};

/* ===== REINÍCIO DE PARTIDA ===== */
const _mvReset=resetGame;
resetGame=function(){_mvReset();mvReset();};
