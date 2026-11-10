"use strict";
/* PLAYER: estado do jogador, controles (toque e teclado) e movimento */
const P={x:0,y:0,z:38,vy:0,yaw:Math.PI,pitch:0,hp:100,ground:true,bob:0,crouch:false,dead:false,dashT:0,dashCD:0,dashDir:{mx:0,mz:0}};
const PR=.45,PH=1.7,EYE=1.6;
const inp={mx:0,mz:0,fire:false,jump:false,sprint:false,keys:{}};
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const sensK=()=>save.sens*.0012;
let lookId=null,lx=0,ly=0,joyId=null,jcx=0,jcy=0,sprHeld=false;

/* OLHAR: arrastar no lado direito (cada dedo é rastreado pelo pointerId) */
const look=$('look');
look.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'){
  if(state==='play'&&document.pointerLockElement!==canvas)try{canvas.requestPointerLock();}catch(_){}
  if(e.button===2)aim=true;else inp.fire=true;return;}
 if(lookId===null){lookId=e.pointerId;lx=e.clientX;ly=e.clientY;try{look.setPointerCapture(e.pointerId);}catch(_){}}
});
look.addEventListener('pointermove',e=>{
 if(e.pointerId!==lookId)return;
 const k=sensK()*1.6*(aim?.6:1);
 P.yaw-=(e.clientX-lx)*k;P.pitch=Math.max(-1.4,Math.min(1.4,P.pitch-(e.clientY-ly)*k));
 lx=e.clientX;ly=e.clientY;
});
const endLook=e=>{if(e.pointerId===lookId)lookId=null;if(e.pointerType==='mouse'){inp.fire=false;if(e.button===2)aim=false;}};
['pointerup','pointercancel','lostpointercapture'].forEach(n=>look.addEventListener(n,endLook));
document.addEventListener('mousemove',e=>{
 if(document.pointerLockElement===canvas&&state==='play'){
  const k=sensK()*(aim?.6:1);
  P.yaw-=e.movementX*k;P.pitch=Math.max(-1.4,Math.min(1.4,P.pitch-e.movementY*k));}
});

/* MOUSE (PC): botão esquerdo atira, botão direito mira.
   Escuta no documento: com o ponteiro travado (pointer lock) os cliques chegam ao canvas,
   e não à camada #look, então o listener de #look deixava de funcionar após o primeiro clique. */
document.addEventListener('mousedown',e=>{
 if(e.sourceCapabilities&&e.sourceCapabilities.firesTouchEvents)return;
 if(state!=='play'||P.dead)return;
 if(document.pointerLockElement!==canvas){try{canvas.requestPointerLock();}catch(_){}}
 if(e.button===0)inp.fire=true;
 else if(e.button===2)aim=true;
});
document.addEventListener('mouseup',e=>{
 if(e.button===0)inp.fire=false;
 else if(e.button===2)aim=false;
});
window.addEventListener('blur',()=>{inp.fire=false;aim=false;});

/* ANALÓGICO */
const joy=$('joy'),knob=$('knob');
function joyMove(e){
 let dx=e.clientX-jcx,dy=e.clientY-jcy;const m=Math.hypot(dx,dy),R=55;
 if(m>R){dx*=R/m;dy*=R/m;}
 knob.style.left=(40+dx)+'px';knob.style.top=(40+dy)+'px';
 inp.mx=dx/R;inp.mz=dy/R;inp.sprint=sprHeld||Math.hypot(inp.mx,inp.mz)>.92;
}
joy.addEventListener('pointerdown',e=>{if(joyId!==null)return;joyId=e.pointerId;const r=joy.getBoundingClientRect();jcx=r.left+r.width/2;jcy=r.top+r.height/2;try{joy.setPointerCapture(e.pointerId);}catch(_){}joyMove(e);});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyMove(e);});
const endJoy=e=>{if(e.pointerId!==joyId)return;joyId=null;inp.mx=inp.mz=0;knob.style.left=knob.style.top='40px';inp.sprint=sprHeld;};
['pointerup','pointercancel','lostpointercapture'].forEach(n=>joy.addEventListener(n,endJoy));

/* BOTÕES */
function hold(id,dn,up){
 const el=$(id);let pid=null;
 el.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();pid=e.pointerId;el.classList.add('dn');try{el.setPointerCapture(pid);}catch(_){}dn();});
 const u=e=>{if(e.pointerId!==pid)return;pid=null;el.classList.remove('dn');if(up)up();};
 ['pointerup','pointercancel','lostpointercapture'].forEach(n=>el.addEventListener(n,u));
}
/* FOGO + ANALÓGICO ACOPLADO: segurar atira, arrastar o dedo mira (move a câmera) */
(function(){
 const el=$('fire');let pid=null,fx=0,fy=0,cx=0,cy=0;
 const fk=document.createElement('div');
 fk.style.cssText='position:absolute;left:50%;top:50%;width:46%;height:46%;margin:-23% 0 0 -23%;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.6);pointer-events:none;opacity:0;transition:opacity .1s';
 if(getComputedStyle(el).position==='static')el.style.position='absolute';
 el.style.overflow='visible';el.appendChild(fk);
 el.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();if(pid!==null)return;pid=e.pointerId;
  const r=el.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;fx=e.clientX;fy=e.clientY;
  el.classList.add('dn');fk.style.opacity='1';try{el.setPointerCapture(pid);}catch(_){}inp.fire=true;});
 el.addEventListener('pointermove',e=>{if(e.pointerId!==pid)return;
  const k=sensK()*1.6*(aim?.6:1);
  P.yaw-=(e.clientX-fx)*k;P.pitch=Math.max(-1.4,Math.min(1.4,P.pitch-(e.clientY-fy)*k));
  fx=e.clientX;fy=e.clientY;
  let dx=e.clientX-cx,dy=e.clientY-cy;const R=el.offsetWidth*.45,m=Math.hypot(dx,dy);if(m>R){dx*=R/m;dy*=R/m;}
  fk.style.transform='translate('+dx+'px,'+dy+'px)';});
 const u=e=>{if(e.pointerId!==pid)return;pid=null;el.classList.remove('dn');inp.fire=false;fk.style.opacity='0';fk.style.transform='';};
 ['pointerup','pointercancel','lostpointercapture'].forEach(n=>el.addEventListener(n,u));
})();
hold('ads',()=>aim=!aim);
hold('jump',()=>inp.jump=true,()=>inp.jump=false);
hold('rel',reload);
hold('swp',swap);
hold('crh',()=>crouchPress()); /* v13: agachar/deslizar em movement.js */
/* CORRER: toque para ligar/desligar (não precisa segurar). Fica ligado até tocar de novo. */
function setSprint(on){sprHeld=on;inp.sprint=on;const el=$('spr');el.classList.toggle('on',on);el.textContent=on?'CORRENDO':'CORRER';setSprintMsg(on);}
hold('spr',()=>setSprint(!sprHeld));
function setSprintMsg(on){msg(on?'CORRIDA ATIVADA':'CORRIDA DESLIGADA',1.2);}
/* DASH: impulso curto (0,22 s) na direção do movimento; parado, esquiva para trás. Invulnerável durante o impulso. */
const DASH={spd:19,time:.22,cool:1.6};
function dashPlayer(){
 if(P.dashCD>0||P.dead||state!=='play'||(typeof BR!=='undefined'&&BR.drop))return;
 const k=inp.keys;let mx=inp.mx,mz=inp.mz;
 if(k.KeyW||k.ArrowUp)mz-=1;if(k.KeyS||k.ArrowDown)mz+=1;if(k.KeyA)mx-=1;if(k.KeyD)mx+=1;
 const ml=Math.hypot(mx,mz);
 if(ml<.2){mx=0;mz=(inp.sprint||k.ShiftLeft)?-1:1;}else{mx/=ml;mz/=ml;} /* parado: esquiva para trás; correndo: para frente */
 P.dashDir={mx,mz};P.dashT=DASH.time;P.dashCD=DASH.cool;
 snd(420,.15,'triangle',.25,900);
}
hold('dash',()=>dashPlayer()); /* v13: esquiva direcional em movement.js */
function updDashBtn(){const b=$('dash');if(!b)return;const t=P.dashCD>0?Math.ceil(P.dashCD)+'s':'ESQUIVA';if(b.textContent!==t)b.textContent=t;b.style.opacity=P.dashCD>0?'.5':'1';}

/* LANTERNA: toque no botão (mobile) ou tecla F */
hold('flashbtn',()=>{if(typeof envToggleFlash==='function')envToggleFlash();});
if(typeof TB!=='undefined'&&TB.indexOf('flashbtn')<0)TB.push('flashbtn');

/* TECLADO (PC) */
document.addEventListener('keydown',e=>{
 inp.keys[e.code]=true;if(state!=='play')return;
 if(e.code==='KeyR')reload();
 if(e.code==='KeyC'&&!e.repeat)dashPlayer();
 if(e.code==='Digit1')setWeapon(0);if(e.code==='Digit2')setWeapon(1);if(e.code==='Digit3')setWeapon(2);if(e.code==='Digit4')setWeapon(3);if(e.code==='Digit5')setWeapon(4);
 if(e.code==='ControlLeft'&&!e.repeat)crouchPress();if(e.code==='KeyQ')swap();if(e.code==='KeyV'&&!e.repeat&&typeof slidePress==='function')slidePress();
 if(e.code==='ShiftLeft'&&!e.repeat)setSprint(!sprHeld);
 if(e.code==='Escape'||e.code==='KeyP')pauseGame();
 if(e.code==='KeyF'){if(typeof envToggleFlash==='function')envToggleFlash();}
 if(e.code==='KeyN'){if(typeof envToggleNV==='function')envToggleNV();}
 if(e.code==='KeyK'){if(typeof envCycleWeather==='function')envCycleWeather();}
});
document.addEventListener('keyup',e=>{inp.keys[e.code]=false;});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('touchmove',e=>{if(typeof state==='string'&&state==='play')e.preventDefault();},{passive:false});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('Contexto WebGL perdido. Toque em tentar de novo.');});

/* MOVIMENTO, GRAVIDADE E CÂMERA */
function updatePlayer(dt){
 const k=inp.keys;let mx=inp.mx,mz=inp.mz;
 if(k.KeyW||k.ArrowUp)mz-=1;if(k.KeyS||k.ArrowDown)mz+=1;if(k.KeyA)mx-=1;if(k.KeyD)mx+=1;
 let ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml;}
 const sprintOn=!!(inp.sprint||k.ShiftLeft);
 /* CORRER funciona sozinho: sem analógico, corre para frente. O analógico só muda a direção. */
 const auto=sprintOn&&ml<=.3;
 if(auto){mx=0;mz=-1;ml=1;}
 const run=sprintOn&&!P.crouch&&!aim&&mz<.3&&ml>.3; /* qualquer direção, exceto para trás */
 if(sprintOn&&(P.crouch||aim)&&msgT<=0)msg(P.crouch?'Levante-se para correr':'Solte a mira para correr',1);
 const spd=(run?7:4.2)*(P.crouch?.5:1)*(aim?.6:1);
 const sy=Math.sin(P.yaw),cy=Math.cos(P.yaw),h=P.crouch?1.1:PH;
 if(P.dashT>0){P.dashT-=dt;const d=P.dashDir;moveCollide(P,(d.mx*cy+d.mz*sy)*DASH.spd*dt,(-d.mx*sy+d.mz*cy)*DASH.spd*dt,PR,h);}
 else moveCollide(P,(mx*cy+mz*sy)*spd*dt,(-mx*sy+mz*cy)*spd*dt,PR,h);
 if(P.dashCD>0)P.dashCD-=dt;
 if((inp.jump||k.Space)&&P.ground){P.vy=7.2;P.ground=false;SFX.jump();}
 P.vy-=20*dt;P.y+=P.vy*dt;
 const g=groundAt(P.x,P.z,PR,P.y);
 if(P.y<=g){P.y=g;P.vy=0;P.ground=true;}else P.ground=false;
 if(P.vy>0){const hb=colliders.find(b=>P.x>b.x0&&P.x<b.x1&&P.z>b.z0&&P.z<b.z1&&b.bot>P.y+h-.3&&b.bot<P.y+h+P.vy*dt+.1);if(hb)P.vy=0;}
 rescue(P,PR,h);
 const moving=ml>.1&&P.ground;if(moving)P.bob+=dt*(run?12:8);
 cam.position.set(P.x,P.y+(P.crouch?1.1:EYE)+(moving?Math.sin(P.bob)*.035:0),P.z);
 cam.rotation.set(P.pitch,P.yaw,0,'YXZ');
 updDashBtn();
 const tf=P.dashT>0?88:(aim?48:(run?80:75));
 if(Math.abs(cam.fov-tf)>.1){cam.fov+=(tf-cam.fov)*Math.min(1,dt*12);cam.updateProjectionMatrix();}
}
