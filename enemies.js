"use strict";
/* ENEMIES: tipos, modelo procedural e IA (máquina de estados) */
const TYPES={
 std:{hp:60,speed:3,dmg:7,acc:.42,rate:.55,skin:0x3f4a2e,vest:0x2b3320,scale:1,pts:100,role:'rifle'},
 heavy:{hp:150,speed:1.7,dmg:14,acc:.48,rate:.8,skin:0x4a4a4e,vest:0x222226,scale:1.2,pts:220,role:'tank'},
 scout:{hp:38,speed:5.2,dmg:5,acc:.38,rate:.32,skin:0x6a4a2a,vest:0x3a2a1a,scale:.95,pts:150,role:'flank'},
 sniper:{hp:50,speed:2.4,dmg:22,acc:.72,rate:1.4,skin:0x2a3a2a,vest:0x1a2a1a,scale:1,pts:250,role:'sniper'},
 medic:{hp:55,speed:3.4,dmg:5,acc:.35,rate:.7,skin:0x3a4a5a,vest:0x2a3a4a,scale:1,pts:180,role:'medic'},
 boss:{hp:420,speed:2.2,dmg:16,acc:.55,rate:.45,skin:0x5a2a2a,vest:0x3a1a1a,scale:1.35,pts:800,role:'boss'}};
const WP=[[-20,30],[20,30],[0,18],[-24,-12],[24,-16],[0,-26],[-35,-4],[35,6],[0,-40],[-20,-40],[20,-40],[-15,12],[15,22]];
const enemies=[];

/* Dificuldade: Easy / Normal / Hard / Extreme */
const DIFFS={
 easy:  {acc:.55,react:1.35,aggr:.55,hear:18,sight:42,gren:.15,flank:.25,cover:.9,call:.3},
 normal:{acc:.85,react:1.0,aggr:.85,hear:28,sight:52,gren:.4,flank:.55,cover:.7,call:.55},
 hard:  {acc:1.05,react:.75,aggr:1.1,hear:36,sight:60,gren:.65,flank:.8,cover:.55,call:.8},
 extreme:{acc:1.2,react:.55,aggr:1.3,hear:44,sight:68,gren:.85,flank:1,cover:.4,call:1}
};
let DIFF=DIFFS.normal,diffKey='normal';
function setDifficulty(k){diffKey=DIFFS[k]?k:'normal';DIFF=DIFFS[diffKey];try{save.diff=diffKey;store();}catch(e){}}
try{if(save.diff&&DIFFS[save.diff]){diffKey=save.diff;DIFF=DIFFS[diffKey];}}catch(e){}

/* Percepção compartilhada: último barulho e alerta de esquadrão */
const AI={noise:null,noiseT:0,alertT:0,alertPos:null,reinforceCD:0};
function aiNoise(x,z,r){AI.noise={x,z,r:r||22};AI.noiseT=4;}
function aiSquadAlert(x,z){AI.alertT=8;AI.alertPos={x,z};}


/* BRAÇOS DOS BOTS: braços procedurais com IK de dois ossos.
   O modelo embutido é estático (sem esqueleto), então os braços são malhas separadas
   presas ao ombro e às mãos. As mãos seguem âncoras no fuzil (empunhadura de duas mãos). */
const ARM={up:.3,fore:.27,r1:.055,r2:.045,shX:.19,shY:1.42,pivotY:1.38,pivotZ:-.05};
const _UP=new THREE.Vector3(0,1,0),_tmpA=new THREE.Vector3(),_tmpB=new THREE.Vector3();
function limbSeg(mesh,a,b){
 _tmpA.subVectors(b,a);const L=_tmpA.length()||1e-4;
 mesh.position.copy(a).add(b).multiplyScalar(.5);
 mesh.quaternion.setFromUnitVectors(_UP,_tmpA.multiplyScalar(1/L));
 mesh.scale.set(1,L,1);
}
/* Calcula o cotovelo (IK de dois ossos). side: +1 braço direito, -1 esquerdo. Retorna {elbow,hand}. */
function solveArm(S,H,side){
 const u=new THREE.Vector3().subVectors(H,S);let d=u.length();
 const max=ARM.up+ARM.fore-.002,min=Math.abs(ARM.up-ARM.fore)+.002;
 d=Math.min(max,Math.max(min,d));u.normalize();
 const c=(ARM.up*ARM.up+d*d-ARM.fore*ARM.fore)/(2*ARM.up*d);
 const a=Math.acos(Math.max(-1,Math.min(1,c)));
 /* polo: cotovelo para baixo e para fora, perpendicular ao eixo ombro-mão */
 const p=new THREE.Vector3(side*.35,-1,.25);
 p.addScaledVector(u,-p.dot(u)).normalize();
 const elbow=S.clone().addScaledVector(u,ARM.up*Math.cos(a)).addScaledVector(p,ARM.up*Math.sin(a));
 const hand=S.clone().addScaledVector(u,d);
 return {elbow,hand};
}
const _wp=new THREE.Vector3();
function anchorLocal(e,obj){obj.getWorldPosition(_wp);return e.g.worldToLocal(_wp.clone());}

/* PERSONAGEM SWAT ANIMADO (Quaternius). O esqueleto e as animações vêm de js/swat.js.
   Pernas/tronco usam as animações (parado, andar, correr, correr de lado/trás, tomar tiro, morrer);
   os braços são recalculados por IK nos ossos reais para segurar o fuzil com as duas mãos.
   SWK: pivô de mira (ombro) em coordenadas locais do inimigo; chestY = altura do peito parado. */
const SWK={px:.04,py:1.37,pz:-.06,chestY:1.34};
const _sv1=new THREE.Vector3(),_sv2=new THREE.Vector3(),_sv3=new THREE.Vector3();

/* animação de locomoção: escolhe o clipe pelo estado e pela direção do movimento em relação ao corpo */
function swatLoco(e,dt,mx,mz,spd){
 const sw=e.sw;
 sw.flinchCd-=dt;
 if(e.react>0&&sw.flinchCd<=0&&sw.lockT<=0){sw.once(Math.random()<.5?'HitRecieve':'HitRecieve_2',.4);sw.flinchCd=1.1;}
 if(sw.lockT>0)sw.lockT-=dt;
 else{
  let name='Idle_Gun',ts=1;
  if(mx||mz){
   const ry=e.g.rotation.y,fx=-Math.sin(ry),fz=-Math.cos(ry),rx=Math.cos(ry),rz=-Math.sin(ry);
   const ml=Math.hypot(mx,mz)||1,f=(mx*fx+mz*fz)/ml,r=(mx*rx+mz*rz)/ml;
   if(Math.abs(f)>=Math.abs(r)){
    if(f>0){if(spd<2.4){name='Walk';ts=Math.max(.7,Math.min(1.5,spd/1.5));}else{name='Run';ts=Math.max(.7,Math.min(1.5,spd/4.2));}}
    else{name='Run_Back';ts=Math.max(.6,Math.min(1.5,spd/3.5));}
   }else{name=r>0?'Run_Right':'Run_Left';ts=Math.max(.6,Math.min(1.5,spd/4));}
  }
  sw.play(name,.2,ts);
 }
 sw.mixer.update(dt);
}

/* pose de combate com o esqueleto: fuzil mira no jogador, recuo e braços por IK nos ossos */
function swatPose(e,dt){
 const sw=e.sw,g=e.g,b=sw.b;
 g.updateMatrixWorld(true);
 b.chest.getWorldPosition(_sv1);g.worldToLocal(_sv1);
 const bob=Math.max(-.08,Math.min(.08,_sv1.y-SWK.chestY));
 const alert=['attack','alert','cover','chase'].includes(e.state);
 const dist=Math.hypot(P.x-e.pos.x,P.z-e.pos.z)||1;
 const dy=(P.y+EYE)-(e.pos.y+SWK.py*e.T.scale);
 const want=alert?Math.max(-.6,Math.min(.6,Math.atan2(dy,dist))):-.22;
 e.pitch+=(want-e.pitch)*Math.min(1,dt*6);
 e.kick=Math.max(0,e.kick-dt*12);
 e.pivot.rotation.x=e.pitch+e.kick*.08;
 e.pivot.position.set(SWK.px,SWK.py+bob,SWK.pz-e.kick*.04);
 g.updateMatrixWorld(true);
 e.anchors.trg.getWorldPosition(_sv2);e.anchors.sup.getWorldPosition(_sv3);
 swatArmIK(b.uaR,b.laR,b.wR,_sv2,1,g.quaternion);
 swatArmIK(b.uaL,b.laL,b.wL,_sv3,-1,g.quaternion);
 /* hitbox da cabeça acompanha o osso da cabeça */
 b.head.getWorldPosition(_sv1);g.worldToLocal(_sv1);
 e.head.position.set(_sv1.x,_sv1.y+.07,_sv1.z);
}

function makeEnemy(type,x,z,passive){
 const T=TYPES[type],g=new THREE.Group();
 /* Personagem principal: SWAT animado (Quaternius). Se falhar ao carregar, cai para o soldado estático antigo:
    std = soldado (Umair), heavy = knight, scout = soldado (madtroll) tingido */
 let sw=null;
 try{sw=SWAT.make(type);}catch(err){console.warn('SWAT indisponível, usando soldado estático:',err);}
 let body;
 if(sw)body=sw.body;
 else if(type==='heavy')body=buildModel('knight');
 else if(type==='scout')body=makeSoldierMesh(0x522b11);
 else body=buildModel('soldier');
 g.add(body);
 const topY=(body.userData&&body.userData.top)||1.88;
 /* Hitbox da cabeça (invisível) para headshot. Com o SWAT ela segue o osso da cabeça a cada quadro. */
 const head=new THREE.Mesh(new THREE.SphereGeometry(sw?0.19:0.18,10,8),new THREE.MeshBasicMaterial({visible:false}));head.position.set(0,sw?1.62:topY-.12,0);head.userData.head=true;g.add(head);
 /* Hitbox do corpo (invisível): a malha animada não serve para raycast, então o corpo usa uma caixa fixa */
 let hbody=null;
 if(sw){hbody=new THREE.Mesh(new THREE.BoxGeometry(.62,1.42,.46),new THREE.MeshBasicMaterial({visible:false}));hbody.position.set(0,.71,0);g.add(hbody);}
 /* Pivô de mira no ombro: gira o fuzil para cima/baixo e recebe o recuo */
 const pivot=new THREE.Group();
 if(sw)pivot.position.set(SWK.px,SWK.py,SWK.pz);else pivot.position.set(0,ARM.pivotY,ARM.pivotZ);
 g.add(pivot);
 const rifle=buildModel('rifle');
 /* Troca a malha antiga do fuzil pelo modelo do pacote, mantendo tamanho e posição */
 {const ob=new THREE.Box3().setFromObject(rifle),os=new THREE.Vector3(),oc=new THREE.Vector3();ob.getSize(os);ob.getCenter(oc);
  const oldKids=rifle.children.slice();
  WPACK.attach(rifle,'rifle',Math.max(.4,os.z),oc.z,o=>{o.position.y=oc.y;o.position.x=oc.x;oldKids.forEach(k=>k.visible=false);});}
 if(sw){rifle.scale.setScalar(.6);rifle.position.set(.02,-.12,-.17);}else rifle.position.set(0,-.13,-.4);   /* SWAT: fuzil encostado no ombro, perto do corpo; coronha no ombro e mãos ao alcance dos braços */
 pivot.add(rifle);
 /* Âncoras das mãos no fuzil: apoio (mão esquerda, guarda-mão) e gatilho (mão direita, empunhadura) */
 const anchors={sup:new THREE.Object3D(),trg:new THREE.Object3D()};
 anchors.sup.position.set(0,sw?-.05:-.02,sw?-.17:-.24);rifle.add(anchors.sup);   /* SWAT: pulso esquerdo logo atrás/abaixo do guarda-mão */
 anchors.trg.position.set(0,sw?-.08:-.07,sw?.2:.1);rifle.add(anchors.trg);   /* SWAT: pulso direito atrás da empunhadura */
 /* Braços procedurais (só no modo reserva, sem esqueleto): manga na cor do colete, luva escura */
 let limbs=null;
 if(!sw){
  const sleeve=mkMat({color:T.vest,r:.9}),glove=new THREE.MeshLambertMaterial({color:0x1a1a1c});
  const mkCyl=(r,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,1,8),mat);m.castShadow=true;g.add(m);return m;};
  const mkHand=()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),glove);m.castShadow=true;g.add(m);return m;};
  limbs={rUp:mkCyl(ARM.r1,sleeve),rFo:mkCyl(ARM.r2,sleeve),lUp:mkCyl(ARM.r1,sleeve),lFo:mkCyl(ARM.r2,sleeve),rHand:mkHand(),lHand:mkHand()};
 }
 /* Sem membros separados: pivôs fictícios mantêm a IA de animação funcionando sem erros */
 const lL=new THREE.Object3D(),rL=new THREE.Object3D(),lA=new THREE.Object3D(),rA=new THREE.Object3D();
 g.scale.setScalar(T.scale);
 g.position.set(x,0,z);scene.add(g);
 const e={g,type,T,hp:T.hp,max:T.hp,state:passive?'idle':'patrol',pos:g.position,legs:[lL,rL],arms:[lA,rA],pivot,anchors,limbs,sw,head,pitch:-.22,kick:0,aimW:0,t:0,los:false,losT:Math.random()*.3,last:new THREE.Vector3(),wp:Math.floor(Math.random()*WP.length),cd:Math.random(),stun:0,dead:0,passive,react:0,anim:Math.random()*6,meshes:[],covered:false,cp:null,
 role:T.role||'rifle',phase:0,grenCD:4+Math.random()*6,callCD:0,healCD:0,flankT:0,fp:null,peek:0,bossPhase:0};
 if(sw){[head,hbody].forEach(o=>{o.userData.enemy=e;e.meshes.push(o);});}   /* só as hitboxes recebem tiro */
 else g.traverse(o=>{if(o.isMesh){o.userData.enemy=e;e.meshes.push(o);}});
 if(sw){sw.play('Idle_Gun',0,1);sw.cur.time=Math.random()*1.5;sw.mixer.update(0);swatPose(e,0);}   /* já nasce em pose, com os braços no fuzil */
 enemies.push(e);return e;
}
function clearEnemies(){
 for(const e of enemies){scene.remove(e.g);}
 enemies.length=0;
}
function canSee(a,b){const d=b.clone().sub(a),L=d.length();ray.set(a,d.normalize());ray.far=L;return ray.intersectObjects(solids,false).length===0;}
function findCover(e){
 let best=null,bd=18,px=P.x,pz=P.z;
 for(const c of colliders){
  if(c.top<1||c.top>5||c.x1-c.x0>22||c.z1-c.z0>22)continue;
  const cx=(c.x0+c.x1)/2,cz=(c.z0+c.z1)/2;
  const d=Math.hypot(cx-e.pos.x,cz-e.pos.z);
  if(d>bd||d<1.2)continue;
  /* lado oposto ao jogador (atrás do obstáculo) */
  const ax=cx-px,az=cz-pz,al=Math.hypot(ax,az)||1;
  const h=Math.max(c.x1-c.x0,c.z1-c.z0)*.55+1.1;
  const sx=cx+ax/al*h,sz=cz+az/al*h;
  if(Math.hypot(sx-px,sz-pz)<4)continue; /* não cobre se ainda perto do player */
  bd=d;best={x:sx,z:sz,cx,cz};
 }
 return best;
}
function findFlank(e){
 const ang=Math.atan2(P.x-e.pos.x,P.z-e.pos.z)+(Math.random()<.5?1:-1)*(1.1+Math.random()*.7);
 const dist=8+Math.random()*6;
 return {x:P.x+Math.sin(ang)*dist,z:P.z+Math.cos(ang)*dist};
}
function nearestAlly(e,maxD){
 let best=null,bd=maxD||12;
 for(const o of enemies){
  if(o===e||o.state==='dead')continue;
  const d=Math.hypot(o.pos.x-e.pos.x,o.pos.z-e.pos.z);
  if(d<bd){bd=d;best=o;}
 }
 return best;
}
function nearestHurtAlly(e,maxD){
 let best=null,bd=maxD||14;
 for(const o of enemies){
  if(o===e||o.state==='dead'||o.hp>=o.max*.7)continue;
  const d=Math.hypot(o.pos.x-e.pos.x,o.pos.z-e.pos.z);
  if(d<bd){bd=d;best=o;}
 }
 return best;
}

/* POSE DE COMBATE: empunhadura de duas mãos, mira para o jogador, recuo e braços por IK */
function botCombatPose(e,dt){
 if(e.sw){
  if(!e.swFail&&Math.hypot(P.x-e.pos.x,P.z-e.pos.z)<55){try{swatPose(e,dt);}catch(err){console.warn('Pose SWAT falhou:',err);e.swFail=true;}}
  return;
 }
 const alert=['attack','alert','cover','chase'].includes(e.state);
 /* mira: sobe o fuzil para o jogador quando em combate; em patrulha fica em posição baixa */
 const dist=Math.hypot(P.x-e.pos.x,P.z-e.pos.z)||1;
 const dy=(P.y+EYE)-(e.pos.y+ARM.pivotY*e.T.scale);
 const want=alert?Math.max(-.6,Math.min(.6,Math.atan2(dy,dist))):-.22;
 e.pitch+=(want-e.pitch)*Math.min(1,dt*6);
 /* recuo do disparo */
 e.kick=Math.max(0,e.kick-dt*12);
 /* leve balanço do corpo enquanto anda */
 const bob=Math.abs(e.legs[0].rotation.x)*.025;
 e.pivot.rotation.x=e.pitch+e.kick*.08;
 e.pivot.position.set(0,ARM.pivotY+bob,ARM.pivotZ-e.kick*.04);
 /* mãos seguem o fuzil; cotovelos resolvidos por IK */
 e.g.updateMatrixWorld(true);
 const sup=anchorLocal(e,e.anchors.sup),trg=anchorLocal(e,e.anchors.trg);
 const SR=new THREE.Vector3(ARM.shX,ARM.shY,ARM.pivotZ),SL=new THREE.Vector3(-ARM.shX,ARM.shY,ARM.pivotZ);
 const R=solveArm(SR,trg,1),L=solveArm(SL,sup,-1);
 limbSeg(e.limbs.rUp,SR,R.elbow);limbSeg(e.limbs.rFo,R.elbow,R.hand);e.limbs.rHand.position.copy(R.hand);
 limbSeg(e.limbs.lUp,SL,L.elbow);limbSeg(e.limbs.lFo,L.elbow,L.hand);e.limbs.lHand.position.copy(L.hand);
}

function enemyAI(e,dt){
 if(e.state==='dead'&&e.sw){
  e.dead+=dt;
  if(!e.deathPlayed){e.deathPlayed=true;e.sw.death();}
  if(!e.swFail)e.sw.mixer.update(dt);
  if(e.dead>5)e.g.visible=false;
  return;
 }
 if(e.state==='dead'){e.dead+=dt;e.g.rotation.x=Math.min(1.45,e.dead*4);e.g.position.y=Math.max(-.2,-e.dead*.1);if(e.dead>5)e.g.visible=false;return;}
 e.anim+=dt;e.stun-=dt;e.react=Math.max(0,e.react-dt);e.grenCD=Math.max(0,e.grenCD-dt);e.callCD=Math.max(0,e.callCD-dt);e.healCD=Math.max(0,e.healCD-dt);e.flankT=Math.max(0,e.flankT-dt);
 if(AI.noiseT>0)AI.noiseT-=dt;if(AI.alertT>0)AI.alertT-=dt;if(AI.reinforceCD>0)AI.reinforceCD-=dt;

 const D=DIFF,role=e.role||'rifle';
 const eye=new THREE.Vector3(e.pos.x,1.6*e.T.scale,e.pos.z),pe=new THREE.Vector3(P.x,P.y+EYE,P.z);
 const dx=P.x-e.pos.x,dz=P.z-e.pos.z,dist=Math.hypot(dx,dz);
 let sightR=D.sight*(role==='sniper'?1.25:role==='scout'?1.1:1);
 if(typeof ENV!=='undefined'&&ENV.time!==undefined){const night=ENV.time<6||ENV.time>20;if(night)sightR*=(ENV.weather==='fog'?.55:.7);if(ENV.weather==='fog')sightR*=.75;if(ENV.weather==='storm')sightR*=.85;}

 /* visão throttled */
 e.losT-=dt;
 if(e.losT<=0){
  e.losT=.18+Math.random()*.12*D.react;let see=false;
  if(dist<sightR&&!P.dead){
   const fx=-Math.sin(e.g.rotation.y),fz=-Math.cos(e.g.rotation.y),dot=(dx*fx+dz*fz)/(dist||1);
   const fov=role==='sniper'?.35:.5;
   if((dot>fov||dist<7||['chase','attack','alert','cover','flank','investigate','track'].includes(e.state))&&canSee(eye,pe))see=true;
  }
  e.los=see;
  if(see){
   e.last.set(P.x,0,P.z);
   if(['patrol','idle','search','investigate'].includes(e.state)){e.state='alert';e.t=.4*D.react;}
   /* comunicação: avisa aliados próximos */
   if(e.callCD<=0&&Math.random()<D.call*.4){
    e.callCD=5;aiSquadAlert(P.x,P.z);
    for(const o of enemies){if(o===e||o.state==='dead')continue;const od=Math.hypot(o.pos.x-e.pos.x,o.pos.z-e.pos.z);
     if(od<18&&['patrol','idle','search'].includes(o.state)){o.state='alert';o.t=.6;o.last.set(P.x,0,P.z);}}
   }
  }else if(e.state==='chase'||e.state==='attack'){e.state='search';e.t=5+D.react*2;}
 }

 /* ouvir barulho */
 if(AI.noiseT>0&&AI.noise&&['patrol','idle','search'].includes(e.state)){
  const nd=Math.hypot(AI.noise.x-e.pos.x,AI.noise.z-e.pos.z);
  if(nd<AI.noise.r*(D.hear/28)){e.state='investigate';e.t=4;e.last.set(AI.noise.x,0,AI.noise.z);}
 }
 if(AI.alertT>0&&AI.alertPos&&['patrol','idle'].includes(e.state)&&Math.random()<dt*1.5){
  e.state='alert';e.t=.8;e.last.set(AI.alertPos.x,0,AI.alertPos.z);
 }

 let mx=0,mz=0,face=null,spd=e.T.speed*(role==='boss'&&e.bossPhase>0?1.15:1);
 if(e.stun>0)e.state='stunned';else if(e.state==='stunned')e.state=e.los?'chase':'search';

 /* MEDIC: cura aliado ferido */
 if(role==='medic'&&e.state!=='dead'&&e.healCD<=0&&!e.passive){
  const hurt=nearestHurtAlly(e,12);
  if(hurt&&(e.state==='patrol'||e.state==='search'||e.state==='idle'||(e.state==='chase'&&!e.los))){
   e.state='heal';e.t=3;e.fp=hurt;
  }
 }

 /* BOSS fases */
 if(role==='boss'&&e.hp<e.max*.5&&e.bossPhase===0){e.bossPhase=1;e.grenCD=0;e.state='attack';}
 if(role==='boss'&&e.hp<e.max*.22&&e.bossPhase===1){e.bossPhase=2;spd*=1.2;}

 switch(e.state){
  case 'patrol':{const w=WP[e.wp],wx=w[0]-e.pos.x,wz=w[1]-e.pos.z,wd=Math.hypot(wx,wz);
   if(wd<2)e.wp=(e.wp+1+Math.floor(Math.random()*3))%WP.length;else{mx=wx/wd;mz=wz/wd;spd*=.45;}break;}
  case 'alert':e.t-=dt;face=[dx,dz];if(e.t<=0)e.state=e.los?'chase':'investigate';break;
  case 'investigate':{e.t-=dt;face=[e.last.x-e.pos.x,e.last.z-e.pos.z];
   const px=e.last.x-e.pos.x,pz=e.last.z-e.pos.z,pd=Math.hypot(px,pz)||1;
   if(pd>1.2){mx=px/pd;mz=pz/pd;spd*=.65;}else e.g.rotation.y+=dt*1.5;
   if(e.t<=0)e.state=e.passive?'idle':'patrol';break;}
  case 'chase':{face=[dx,dz];
   const atkR=role==='sniper'?28:role==='scout'?9:role==='heavy'?16:role==='boss'?14:13;
   if(e.los&&dist<atkR){e.state='attack';break;}
   /* flanking chance */
   if(e.flankT<=0&&Math.random()<D.flank*.02&&role!=='heavy'&&role!=='sniper'){
    e.fp=findFlank(e);e.flankT=6;e.state='flank';break;
   }
   const px=e.last.x-e.pos.x,pz=e.last.z-e.pos.z,pd=Math.hypot(px,pz)||1;mx=px/pd;mz=pz/pd;
   if(pd<1.5&&!e.los){e.state='search';e.t=5;}break;}
  case 'flank':{face=[dx,dz];e.t=(e.t||5)-dt;
   if(e.fp){const fx=e.fp.x-e.pos.x,fz=e.fp.z-e.pos.z,fd=Math.hypot(fx,fz);
    if(fd>.8){mx=fx/fd;mz=fz/fd;spd*=1.15;}else{e.state='attack';e.fp=null;}}
   if(e.los&&dist<12)e.state='attack';
   if(e.t<=0)e.state='chase';break;}
  case 'cover':{face=[dx,dz];e.t-=dt;
   if(e.cp){const cx=e.cp.x-e.pos.x,cz=e.cp.z-e.pos.z,cd=Math.hypot(cx,cz);
    if(cd>.55){mx=cx/cd;mz=cz/cd;spd*=1.25;}
    else{ /* chegou na cobertura: peek-shoot */
     e.peek=(e.peek||0)-dt;
     if(e.peek<=0){e.peek=.9+Math.random()*.6; /* sai um pouco para atirar */
      if(e.los){e.cd=0;}
     }
    }
   }
   if(e.t<=0){e.covered=false;e.state='chase';}break;}
  case 'attack':{face=[dx,dz];
   if(!e.los||dist>(role==='sniper'?40:22)){e.state='chase';break;}
   /* buscar cobertura se ferido */
   if(!e.covered&&role!=='boss'&&e.hp<e.max*(role==='heavy'?.25:.4)&&Math.random()<D.cover){
    e.cp=findCover(e);if(e.cp){e.covered=true;e.state='cover';e.t=2.8+Math.random()*2;break;}
   }
   /* movimento tático por classe */
   if(role==='sniper'){
    if(dist<14){mx=-dx/dist;mz=-dz/dist;spd*=.9;} /* recua */
    else if(dist>32){mx=dx/dist*.2;mz=dz/dist*.2;spd*=.5;}
   }else if(role==='scout'){
    if(dist>6){mx=dx/dist*.5-dz/dist*.7;mz=dz/dist*.5+dx/dist*.7;spd*=1.1;}
   }else if(role==='heavy'||role==='boss'){
    if(dist>8){mx=dx/dist*.45;mz=dz/dist*.45;spd*=.7;}
   }else if(dist>10){mx=dx/dist*.25;mz=dz/dist*.25;spd*=.55;}

   /* granada */
   if(e.grenCD<=0&&!e.passive&&(role==='rifle'||role==='heavy'||role==='boss'||role==='flank')&&dist>6&&dist<18&&Math.random()<D.gren*.35){
    const safe=Math.hypot(e.pos.x-P.x,e.pos.z-P.z)>5.5;
    if(safe&&(P.crouch||!e.los||role==='boss')){
     e.grenCD=8+Math.random()*6*(role==='boss'?.4:1);
     const gx=P.x+(Math.random()-.5)*3,gz=P.z+(Math.random()-.5)*3;
     setTimeout(()=>{if(typeof explode==='function')explode(new THREE.Vector3(gx,.4,gz));},650);
     msg(role==='boss'?'CHEFE: GRANADA!':'Granada inimiga!',1.2);
    }
   }

   /* reforços */
   if(e.callCD<=0&&AI.reinforceCD<=0&&alive+toSpawn<7&&Math.random()<D.call*.08){
    e.callCD=12;AI.reinforceCD=14;
    if(typeof toSpawn==='number'){toSpawn++;if(typeof spawnT==='number')spawnT=Math.min(spawnT||2,1.2);}
    msg('Reforços a caminho!',1.5);
   }

   e.cd-=dt;
   if(e.cd<=0&&!e.passive){
    const rateMul=role==='sniper'?1.1:role==='boss'?(e.bossPhase>=2?.55:.75):1;
    e.cd=e.T.rate*rateMul*(.75+Math.random()*.45)*D.react;
    SFX.enemy();e.kick=1;
    let acc=e.T.acc*D.acc*Math.max(.4,1-dist/(role==='sniper'?70:45));
    if(P.crouch)acc*=.72;if(P.dashT>0)acc*=.4;if(role==='sniper'&&dist>12)acc*=1.15;
    if(typeof cbtEnemyAccMul==='function')acc*=cbtEnemyAccMul(e);
    if(Math.random()<acc)hurt(e.T.dmg*(role==='boss'&&e.bossPhase>=1?1.2:1),e.pos);
   }
   break;}
  case 'heal':{e.t-=dt;
   const ally=e.fp&&e.fp.state!=='dead'?e.fp:nearestHurtAlly(e,14);
   if(!ally){e.state='chase';break;}
   e.fp=ally;face=[ally.pos.x-e.pos.x,ally.pos.z-e.pos.z];
   const ad=Math.hypot(ally.pos.x-e.pos.x,ally.pos.z-e.pos.z);
   if(ad>1.4){mx=(ally.pos.x-e.pos.x)/ad;mz=(ally.pos.z-e.pos.z)/ad;spd*=.9;}
   else if(e.healCD<=0){ally.hp=Math.min(ally.max,ally.hp+28);e.healCD=6;e.state=e.los?'attack':'chase';msg('Médico inimigo curou um aliado',1.2);}
   if(e.t<=0)e.state='chase';
   if(e.los&&dist<10)e.state='attack';
   break;}
  case 'track':{e.t-=dt;
   if(typeof trackMoveEnemy==='function'){
    const mv=trackMoveEnemy(e);
    if(mv){mx=mv.mx;mz=mv.mz;face=mv.face;spd*=mv.spdMul;}
    else{e.state='search';e.t=4;}
   }else e.state='search';
   if(e.los)e.state='chase';
   if(e.t<=0){e.state='search';e.t=5;e.trackTarget=null;}
   break;}
  case 'search':e.t-=dt;{const px=e.last.x-e.pos.x,pz=e.last.z-e.pos.z,pd=Math.hypot(px,pz);
   if(pd>1.5){mx=px/pd;mz=pz/pd;spd*=.65;}else e.g.rotation.y+=dt*2.2;}
   if(e.t<=0)e.state=e.passive?'idle':'patrol';break;
  case 'idle':break;
 }
 if(e.passive&&e.state!=='stunned'&&e.state!=='idle'&&!e.los)e.state='idle';
 if(mx||mz){
  if(typeof trackEnemyStep==='function')trackEnemyStep(e,mx,mz,spd,dt);
  const ox=e.pos.x,oz=e.pos.z;moveCollide(e.pos,mx*spd*dt,mz*spd*dt,.45,1.8);
  if(Math.hypot(e.pos.x-ox,e.pos.z-oz)<spd*dt*.3){moveCollide(e.pos,-mz*spd*dt,mx*spd*dt,.45,1.8);if(e.state==='patrol')e.wp=(e.wp+1)%WP.length;}
  if(!face)face=[mx,mz];
  const k=Math.sin(e.anim*spd*2.2)*.7;e.legs[0].rotation.x=k;e.legs[1].rotation.x=-k;e.arms[0].rotation.x=-k*.6;
 }else e.legs[0].rotation.x=e.legs[1].rotation.x=0;
 if(face){let d=Math.atan2(-face[0],-face[1])-e.g.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));e.g.rotation.y+=d*Math.min(1,dt*(role==='sniper'?5:8));}
 if(e.sw&&!e.swFail){
  try{
   if(dist>55){e.lodT=(e.lodT||0)+dt;if(e.lodT>=.16){swatLoco(e,e.lodT,mx,mz,spd);e.lodT=0;}}
   else{swatLoco(e,(e.lodT||0)+dt,mx,mz,spd);e.lodT=0;}
  }
  catch(err){console.warn('Animação SWAT falhou; congelando pose deste inimigo:',err);e.swFail=true;}
 }
 botCombatPose(e,dt);
 e.g.rotation.x=(!e.sw&&e.react>0)?-.15:0;
}

