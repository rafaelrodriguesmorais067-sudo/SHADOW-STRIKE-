"use strict";
/* ASSIST: Aim Assist (inspirado em Free Fire).
   Carrega por último e "envolve" o update(), sem editar os outros arquivos.
   Não mexe na sensibilidade nem na entrada do jogador: a assistência apenas ADICIONA uma pequena rotação
   à câmera (yaw/pitch) antes do quadro. O tiro continua sendo o do jogo (weapons.js), só que sai da câmera já ajustada.

   MODOS (salvos em localStorage 'ss_aimassist'):
   - default : PADRÃO. Atração suave até o torso + acompanhamento limitado do movimento do alvo.
   - precise : PRECISO AO MIRAR. Só atração (ponto fixo no instante da trava), SEM acompanhamento automático.
   - free    : CONTROLE TOTAL. Nenhuma assistência. */
const _aaUpdate=update;
const AA_DEG=Math.PI/180;

/* ===== CONFIGURAÇÃO (ajuste aqui) ===== */
const AIMA_CFG={
 range:60,        /* distância máxima do alvo (m) */
 minRange:1.5,    /* abaixo disso não assiste */
 scan:.08,        /* intervalo (s) para reavaliar alvo e linha de visão (raycast) */
 torso:1.15,      /* altura do ponto de atração (× escala do inimigo): centro do torso */
 sample:[1.15,1.6,.6], /* alturas usadas p/ medir se o corpo está dentro do raio: torso, cabeça, pernas */
 stick:1.25,      /* histerese: alvo atual é mantido até sair de raio×1,25 */
 deadzone:.25,    /* graus: perto do centro não puxa (evita tremor) */
 yieldFrom:.1,    /* rad/s: se o jogador gira CONTRA o alvo acima disso, a assistência começa a ceder */
 yieldFull:.4     /* rad/s: acima disso a assistência some por completo naquele quadro */
};
const AIMA_MODES={
 default:{pull:true,follow:true, radius:6,  adsRadius:4.5,pullRate:5,  maxPull:75,followGain:.7,maxFollow:40},
 precise:{pull:true,follow:false,radius:4.5,adsRadius:3.5,pullRate:3.5,maxPull:40},
 free:null
};
/* radius/adsRadius: raio de detecção ao redor da mira, em GRAUS (sem/com mira ADS).
   pullRate: força da atração (1/s). maxPull / maxFollow: limite de velocidade angular (graus/s). */

let aaMode='default';
try{
 const v=localStorage.getItem('ss_aimassist');
 if(v&&Object.prototype.hasOwnProperty.call(AIMA_MODES,v))aaMode=v;
 else if(localStorage.getItem('ss_assist')==='0')aaMode='free'; /* migra a opção antiga "DESLIGADA" */
}catch(e){console.warn('Assist: sem localStorage',e);}

/* ===== estado ===== */
let aaTarget=null,aaScan=0,aaHave=false,aaPrevB=0,aaPrevE=0,aaSnap=null,aaWasOn=false,aaLastY=null,aaLastP=null;
const aaEye=new THREE.Vector3(),aaTorso=new THREE.Vector3(),aaFwd=new THREE.Vector3();
const aaWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const aaClamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/* menu de configurações */
(function(){
 const back=$('setback');if(!back)return;
 const lab=document.createElement('label');
 lab.innerHTML='Assistência de mira <select id="assistsel"><option value="default">PADRÃO — atrai e acompanha</option><option value="precise">PRECISO AO MIRAR — só atrai</option><option value="free">CONTROLE TOTAL — sem ajuda</option></select>';
 back.parentNode.insertBefore(lab,back);
 const s=$('assistsel');s.value=aaMode;
 s.onchange=e=>{aaMode=e.target.value;aaTarget=null;aaHave=false;aaSnap=null;try{localStorage.setItem('ss_aimassist',aaMode);}catch(_){}};
})();

function aaEyePos(){return aaEye.set(P.x,P.y+(P.eyeH||(P.crouch?1.1:EYE)),P.z);}
function aaFwdVec(){const cp=Math.cos(P.pitch);return aaFwd.set(-Math.sin(P.yaw)*cp,Math.sin(P.pitch),-Math.cos(P.yaw)*cp);}

/* menor ângulo (rad) entre a mira e o corpo do inimigo (torso/cabeça/pernas); null se fora da distância ou morto */
function aaMeasure(e,eye,fwd){
 if(e.state==='dead'||!e.T)return null;
 const sc=e.T.scale,dx=e.pos.x-eye.x,dz=e.pos.z-eye.z,dist=Math.hypot(dx,dz);
 if(dist>AIMA_CFG.range||dist<AIMA_CFG.minRange)return null;
 let best=Infinity;
 for(const h of AIMA_CFG.sample){
  const dy=e.pos.y+h*sc-eye.y,L=Math.hypot(dist,dy)||1;
  const a=Math.acos(aaClamp((dx*fwd.x+dy*fwd.y+dz*fwd.z)/L,-1,1));
  if(a<best)best=a;
 }
 return best;
}
/* linha de visão até o torso (respeita paredes/caixas/barris) */
function aaVisible(e,eye){
 aaTorso.set(e.pos.x,e.pos.y+AIMA_CFG.torso*e.T.scale,e.pos.z);
 return canSee(eye,aaTorso);
}
function aaFind(eye,fwd,rad){
 let best=null,ba=rad;
 for(const e of enemies){
  const a=aaMeasure(e,eye,fwd);
  if(a===null||a>=ba)continue;
  if(!aaVisible(e,eye))continue;
  ba=a;best=e;
 }
 return best;
}
function aaDrop(){aaTarget=null;aaHave=false;aaSnap=null;}

function assistPre(dt){
 const cfg=AIMA_MODES[aaMode];
 if(!cfg||state!=='play'||P.dead||(typeof BR!=='undefined'&&BR.drop)){aaDrop();aaWasOn=false;return;}
 const eye=aaEyePos(),fwd=aaFwdVec();
 /* campo de visão: raio de detecção nunca passa do FOV da câmera (ADS usa o raio menor) */
 const fovHalf=(cam.fov*.5)*AA_DEG*.9;
 const rad=Math.min((aim?cfg.adsRadius:cfg.radius)*AA_DEG,fovHalf);

 /* reavalia alvo e linha de visão a cada AIMA_CFG.scan segundos */
 aaScan-=dt;
 if(aaScan<=0){
  aaScan=AIMA_CFG.scan;
  const cand=aaFind(eye,fwd,rad);
  let cur=aaTarget;
  if(cur){
   const a=aaMeasure(cur,eye,fwd);
   if(a===null||a>rad*AIMA_CFG.stick||!aaVisible(cur,eye))cur=null;
  }
  let next=cur;
  if(!cur)next=cand;
  else if(cand&&cand!==cur){const ac=aaMeasure(cand,eye,fwd),at=aaMeasure(cur,eye,fwd);if(ac!==null&&at!==null&&ac<at*.6)next=cand;}
  if(next!==aaTarget){aaTarget=next;aaHave=false;aaSnap=null;}
 }
 /* validação leve a cada quadro (morreu, saiu do alcance/raio, removido da cena) */
 if(aaTarget){
  const a=aaMeasure(aaTarget,eye,fwd);
  if(a===null||a>rad*AIMA_CFG.stick||enemies.indexOf(aaTarget)<0)aaDrop();
 }
 if(!aaTarget){aaWasOn=false;return;}

 /* posição angular do torso do alvo */
 const sc=aaTarget.T.scale;
 const tx=aaTarget.pos.x-eye.x,ty=aaTarget.pos.y+AIMA_CFG.torso*sc-eye.y,tz=aaTarget.pos.z-eye.z;
 const bear=Math.atan2(-tx,-tz),elev=Math.atan2(ty,Math.hypot(tx,tz)||1e-3);

 /* só age quando o jogador está atirando ou mirando */
 const on=!!(inp.fire||aim);
 if(!on){aaWasOn=false;aaSnap=null;aaPrevB=bear;aaPrevE=elev;aaHave=true;return;}

 /* entrada do jogador neste quadro (rotação desde o fim do quadro anterior) */
 let uy=0,up=0;
 if(aaLastY!==null){uy=aaWrap(P.yaw-aaLastY);up=P.pitch-aaLastP;}
 if(Math.abs(uy)>.8||Math.abs(up)>.8){uy=up=0;aaHave=false;aaSnap=null;} /* reinício de partida etc. */

 /* ponto de mira: PADRÃO segue o torso ao vivo; PRECISO usa um ponto fixo gravado ao travar (sem acompanhar) */
 let gy=bear,gp=elev;
 if(!cfg.follow){
  if(!aaSnap||!aaWasOn||Math.hypot(aaWrap(aaSnap.y-P.yaw),aaSnap.p-P.pitch)>rad*1.5)aaSnap={y:bear,p:elev};
  gy=aaSnap.y;gp=aaSnap.p;
 }
 aaWasOn=true;
 const ey=aaWrap(gy-P.yaw),ep=gp-P.pitch,err=Math.hypot(ey,ep);

 /* o jogador sempre pode escapar: se gira contra o alvo, a assistência cede */
 let yieldK=1;
 const rate=Math.hypot(uy,up)/Math.max(dt,1e-3);
 if(uy*ey+up*ep<0)yieldK=1-aaClamp((rate-AIMA_CFG.yieldFrom)/(AIMA_CFG.yieldFull-AIMA_CFG.yieldFrom),0,1);

 /* ATRAÇÃO suave (exponencial, com limite de velocidade; mais forte perto do centro) */
 if(cfg.pull&&err>AIMA_CFG.deadzone*AA_DEG){
  const w=aaClamp(1-.6*(err/rad),.4,1);
  let step=err*(1-Math.exp(-cfg.pullRate*dt))*w;
  step=Math.min(step,cfg.maxPull*AA_DEG*dt);
  const f=step/err*yieldK;
  P.yaw+=ey*f;P.pitch+=ep*f;
 }
 /* ACOMPANHAMENTO limitado: acompanha o deslocamento angular do alvo (só no PADRÃO e perto da mira) */
 if(cfg.follow&&aaHave&&err<rad*.75){
  const m=cfg.maxFollow*AA_DEG*dt;
  P.yaw+=aaClamp(aaWrap(bear-aaPrevB)*cfg.followGain,-m,m)*yieldK;
  P.pitch+=aaClamp((elev-aaPrevE)*cfg.followGain,-m*.6,m*.6)*yieldK;
 }
 P.pitch=aaClamp(P.pitch,-1.4,1.4);
 aaPrevB=bear;aaPrevE=elev;aaHave=true;
}

update=function(dt){
 assistPre(dt);
 _aaUpdate(dt);
 aaLastY=P.yaw;aaLastP=P.pitch;
 /* retículo avermelhado quando há alvo válido na área de detecção */
 const c=$('cross');if(c)c.style.borderColor=aaTarget?'rgba(255,70,70,.95)':'';
};
