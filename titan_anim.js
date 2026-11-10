"use strict";
/* TITAN — SISTEMA DE ANIMAÇÃO DO GOLEM
   O GLB "stone-golem-rigged.glb" traz só dois clipes (walk, run). Os demais 14 clipes são
   gerados aqui sobre o MESMO esqueleto (24 ossos) como THREE.AnimationClip reais e tocados
   pelo AnimationMixer com crossfade.
   As poses são escritas em "espaço do personagem" (X = esquerda do golem, Y = cima, Z = frente)
   e convertidas para o espaço local de cada osso usando a pose de repouso:
     L' = Pw^-1 · R · Pw · L      (Pw = rotação de mundo do pai em repouso)
   Assim "LeftArm:[-90,0,0]" significa "levante o braço esquerdo 90° para frente". */

const TT_BONES=['Hips','Spine02','Spine01','Spine','neck','Head','head_end','headfront',
 'LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand',
 'LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'];

/* Espelha uma pose do lado esquerdo para o direito (rotação em X mantém, Y e Z invertem) */
function ttMirror(p){const o={};for(const k in p){const v=p[k];
 if(k.indexOf('Left')===0)o['Right'+k.slice(4)]=[v[0],-v[1],-v[2]];
 else if(k.indexOf('Right')===0)o['Left'+k.slice(5)]=[v[0],-v[1],-v[2]];
 else if(Array.isArray(v))o[k]=[v[0],-v[1],-v[2]];else o[k]=v;}return o;}
function ttSym(p){return Object.assign({},p,ttMirror(Object.fromEntries(Object.entries(p).filter(([k])=>k.indexOf('Left')===0))));}
function ttPose(...parts){return Object.assign({},...parts);}

/* ---------- BIBLIOTECA DE POSES ---------- */
const TTP={};
TTP.stand=ttSym({LeftArm:[-6,0,-12],LeftForeArm:[-28,0,0],LeftUpLeg:[-10,0,0],LeftLeg:[18,0,0],LeftFoot:[-8,0,0],
 Spine02:[7,0,0],neck:[-6,0,0],hipY:-.05});
TTP.breathe=ttPose(TTP.stand,ttSym({LeftArm:[-8,0,-9],LeftForeArm:[-32,0,0],Spine02:[3,0,0],Spine:[-4,0,0],neck:[-3,0,0]}),{hipY:-.035});
/* golpe pesado (braço direito) */
TTP.swipeWind=ttPose(TTP.stand,{Spine02:[0,-38,4],Spine:[0,-12,0],RightArm:[-35,0,-115],RightForeArm:[-75,0,0],
 LeftArm:[-40,0,-10],LeftForeArm:[-45,0,0],neck:[0,25,0],RightUpLeg:[-25,0,0],RightLeg:[30,0,0],hipY:-.12});
TTP.swipeHit=ttPose(TTP.stand,{Spine02:[22,42,-6],Spine:[8,14,0],RightArm:[-95,0,-10],RightForeArm:[-8,0,0],
 LeftArm:[10,0,-30],LeftForeArm:[-30,0,0],neck:[-10,-20,0],LeftUpLeg:[-35,0,0],LeftLeg:[40,0,0],hipY:-.2});
/* esmagamento com os dois braços (Earthquake Smash) */
TTP.overhead=ttPose(TTP.stand,ttSym({LeftArm:[-168,0,-8],LeftForeArm:[-35,0,0]}),{Spine02:[-16,0,0],Spine:[-8,0,0],neck:[-14,0,0],hipY:.03});
TTP.slam=ttPose(TTP.stand,ttSym({LeftArm:[-70,0,-6],LeftForeArm:[-8,0,0],LeftUpLeg:[-62,0,-6],LeftLeg:[92,0,0],LeftFoot:[-30,0,0]}),
 {Spine02:[38,0,0],Spine01:[14,0,0],Spine:[10,0,0],neck:[-25,0,0],hipY:-.62});
/* pisão sísmico (Earthquake) */
TTP.stompLift=ttPose(TTP.stand,{RightUpLeg:[-85,0,-10],RightLeg:[80,0,0],RightFoot:[-10,0,0],LeftUpLeg:[-6,0,0],LeftLeg:[12,0,0],
 Spine02:[-6,0,-6],LeftArm:[-30,0,40],RightArm:[-30,0,-40],LeftForeArm:[-60,0,0],RightForeArm:[-60,0,0],hipY:.02});
TTP.stompHit=ttPose(TTP.stand,ttSym({LeftUpLeg:[-30,0,-8],LeftLeg:[50,0,0],LeftFoot:[-18,0,0],LeftArm:[-25,0,12],LeftForeArm:[-45,0,0]}),
 {Spine02:[24,0,0],Spine:[6,0,0],neck:[-20,0,0],hipY:-.32});
/* investida (Colossus Charge) */
TTP.chargePrep=ttPose(TTP.stand,ttSym({LeftArm:[35,0,10],LeftForeArm:[-55,0,0],LeftUpLeg:[-50,0,0],LeftLeg:[75,0,0],LeftFoot:[-22,0,0]}),
 {Spine02:[42,0,0],Spine01:[12,0,0],Spine:[6,0,0],neck:[-38,0,0],hipY:-.45,RightUpLeg:[-20,0,0],RightLeg:[55,0,0]});
TTP.chargeA=ttPose(TTP.stand,{Spine02:[38,0,0],Spine01:[10,0,0],neck:[-34,0,0],LeftArm:[45,0,10],RightArm:[45,0,-10],LeftForeArm:[-50,0,0],RightForeArm:[-50,0,0],
 LeftUpLeg:[-70,0,0],LeftLeg:[60,0,0],RightUpLeg:[25,0,0],RightLeg:[40,0,0],hipY:-.25});
TTP.chargeB=ttPose(TTP.chargeA,{LeftUpLeg:[25,0,0],LeftLeg:[40,0,0],RightUpLeg:[-70,0,0],RightLeg:[60,0,0],hipY:-.12});
/* invocação de meteoros (braço esquerdo erguido) */
TTP.summonUp=ttPose(TTP.stand,{LeftArm:[-175,0,-15],LeftForeArm:[-5,0,0],LeftHand:[0,0,0],RightArm:[-20,0,30],RightForeArm:[-70,0,0],
 Spine02:[-14,0,8],Spine:[-6,0,0],neck:[-28,0,0],hipY:0});
TTP.summonDown=ttPose(TTP.stand,{LeftArm:[-40,0,-30],LeftForeArm:[-20,0,0],RightArm:[-10,0,30],RightForeArm:[-60,0,0],
 Spine02:[25,0,0],neck:[-20,0,0],LeftUpLeg:[-30,0,0],LeftLeg:[45,0,0],hipY:-.22});
/* prisão de rocha (mãos no chão canalizando) */
TTP.channel=ttPose(TTP.stand,ttSym({LeftArm:[-55,0,14],LeftForeArm:[-40,0,0],LeftUpLeg:[-40,0,-12],LeftLeg:[60,0,0],LeftFoot:[-20,0,0]}),
 {Spine02:[16,0,0],neck:[-12,0,0],hipY:-.3});
/* raio de energia */
TTP.beamCharge=ttPose(TTP.stand,ttSym({LeftArm:[28,0,42],LeftForeArm:[-35,0,0],LeftShoulder:[0,-10,0],LeftUpLeg:[-25,0,-10],LeftLeg:[35,0,0]}),
 {Spine02:[-20,0,0],Spine:[-10,0,0],neck:[-8,0,0],hipY:-.16});
TTP.beamFire=ttPose(TTP.stand,ttSym({LeftArm:[42,0,50],LeftForeArm:[-22,0,0],LeftUpLeg:[-35,0,-12],LeftLeg:[45,0,0],LeftFoot:[-10,0,0]}),
 {Spine02:[-8,0,0],Spine:[-4,0,0],neck:[10,0,0],hipY:-.22});
/* reação, atordoamento, exposição */
TTP.flinch=ttPose(TTP.stand,ttSym({LeftArm:[-30,0,-25],LeftForeArm:[-60,0,0]}),{Spine02:[-18,0,0],Spine:[-8,0,0],neck:[-25,0,0],hipY:-.08});
TTP.staggerA=ttPose(TTP.stand,{Spine02:[-24,14,10],Spine:[-10,0,0],neck:[-30,10,0],LeftArm:[-50,0,50],RightArm:[-10,0,-60],LeftForeArm:[-30,0,0],RightForeArm:[-50,0,0],
 LeftUpLeg:[15,0,0],LeftLeg:[30,0,0],RightUpLeg:[-40,0,0],RightLeg:[50,0,0],hipY:-.2});
TTP.staggerB=ttPose(TTP.stand,{Spine02:[-10,-16,-10],Spine:[-6,0,0],neck:[-15,-12,0],LeftArm:[-10,0,60],RightArm:[-55,0,-40],LeftForeArm:[-50,0,0],RightForeArm:[-30,0,0],
 LeftUpLeg:[-45,0,0],LeftLeg:[55,0,0],RightUpLeg:[10,0,0],RightLeg:[30,0,0],hipY:-.25});
TTP.kneel=ttPose(TTP.stand,{LeftUpLeg:[-88,0,-8],LeftLeg:[95,0,0],LeftFoot:[-5,0,0],RightUpLeg:[-5,0,6],RightLeg:[110,0,0],RightFoot:[40,0,0],
 Spine02:[30,0,0],Spine01:[8,0,0],neck:[-30,0,0],LeftArm:[-35,0,-20],RightArm:[-15,0,25],LeftForeArm:[-30,0,0],RightForeArm:[-15,0,0],hipY:-1.0});
/* exposição do núcleo: ajoelhado, peito aberto e braços abertos para trás */
TTP.expose=ttPose(TTP.kneel,{Spine02:[-12,0,0],Spine01:[-6,0,0],neck:[-20,0,0],LeftArm:[30,0,45],RightArm:[30,0,-45],LeftForeArm:[-25,0,0],RightForeArm:[-25,0,0]});
TTP.exposeB=ttPose(TTP.expose,{Spine02:[-16,0,0],LeftArm:[34,0,50],RightArm:[34,0,-50],neck:[-26,0,0]});
/* fúria (rugido) */
TTP.roar=ttPose(TTP.stand,ttSym({LeftArm:[-25,0,48],LeftForeArm:[-75,0,0],LeftUpLeg:[-25,0,-12],LeftLeg:[35,0,0],LeftFoot:[-10,0,0]}),
 {Spine02:[-22,0,0],Spine:[-10,0,0],neck:[-30,0,0],hipY:-.15});
TTP.roarB=ttPose(TTP.roar,ttSym({LeftArm:[-30,0,55],LeftForeArm:[-90,0,0]}),{Spine02:[-26,0,0],neck:[-34,0,0]});
/* virar no lugar (passos curtos) */
TTP.turnA=ttPose(TTP.stand,{LeftUpLeg:[-45,0,0],LeftLeg:[55,0,0],Spine02:[7,8,0],hipY:-.02});
TTP.turnB=ttPose(TTP.stand,{RightUpLeg:[-45,0,0],RightLeg:[55,0,0],Spine02:[7,-8,0],hipY:-.02});
/* morte */
TTP.deathFall=ttPose(TTP.kneel,{Spine02:[60,0,0],Spine01:[20,0,0],Spine:[15,0,0],neck:[10,0,0],LeftArm:[-10,0,-10],RightArm:[-10,0,10],LeftForeArm:[-10,0,0],RightForeArm:[-10,0,0],hipY:-1.3,
 LeftUpLeg:[-80,0,-8],RightUpLeg:[0,0,6],RightLeg:[120,0,0]});
/* despertar (início deitado/ajoelhado sob a terra) */
TTP.dormant=ttPose(TTP.kneel,{Spine02:[55,0,0],Spine01:[18,0,0],neck:[-10,0,0],LeftArm:[-5,0,-5],RightArm:[-5,0,5],hipY:-1.1});

/* ---------- CLIPES (tempo em segundos) ---------- */
const TT_CLIPS={
 idle:{loop:true,keys:[[0,'stand'],[1.6,'breathe'],[3.2,'stand']]},
 turn:{loop:true,keys:[[0,'turnA'],[.5,'turnB'],[1,'turnA']]},
 heavyAttack:{loop:false,keys:[[0,'stand'],[.7,'swipeWind'],[.95,'swipeWind'],[1.18,'swipeHit'],[1.7,'swipeHit'],[2.3,'stand']]},
 groundSmash:{loop:false,keys:[[0,'stand'],[.9,'overhead'],[1.35,'overhead'],[1.6,'slam'],[2.3,'slam'],[3.0,'stand']]},
 earthquake:{loop:false,keys:[[0,'stand'],[.8,'stompLift'],[1.1,'stompLift'],[1.3,'stompHit'],[1.9,'stompHit'],[2.5,'stand']]},
 charging:{loop:false,keys:[[0,'stand'],[.6,'chargePrep'],[1.2,'chargePrep']]},
 chargeRun:{loop:true,keys:[[0,'chargeA'],[.25,'chargeB'],[.5,'chargeA']]},
 summon:{loop:false,keys:[[0,'stand'],[.8,'summonUp'],[1.6,'summonUp'],[1.9,'summonDown'],[2.5,'summonDown'],[3.1,'stand']]},
 rockPrison:{loop:false,keys:[[0,'stand'],[.6,'roar'],[1.0,'channel'],[2.4,'channel'],[3.0,'stand']]},
 beamCharge:{loop:true,keys:[[0,'beamCharge'],[.6,'beamFire'],[1.2,'beamCharge']],ease:true},
 beamFire:{loop:true,keys:[[0,'beamFire'],[.15,'beamCharge'],[.3,'beamFire']]},
 stagger:{loop:false,keys:[[0,'flinch'],[.35,'staggerA'],[.8,'staggerB'],[1.3,'staggerA'],[1.9,'kneel']]},
 hit:{loop:false,keys:[[0,'stand'],[.12,'flinch'],[.55,'stand']]},
 weakExpose:{loop:true,keys:[[0,'expose'],[.8,'exposeB'],[1.6,'expose']]},
 enraged:{loop:false,keys:[[0,'stand'],[.5,'roar'],[.8,'roarB'],[1.1,'roar'],[1.4,'roarB'],[1.7,'roar'],[2.0,'roarB'],[2.6,'stand']]},
 death:{loop:false,keys:[[0,'flinch'],[.5,'staggerA'],[1.1,'staggerB'],[1.8,'kneel'],[2.6,'kneel'],[3.6,'deathFall']]},
 awaken:{loop:false,keys:[[0,'dormant'],[1.2,'dormant'],[2.6,'kneel'],[3.8,'stand']]}
};

/* Converte as poses em clipes reais a partir do esqueleto em repouso do GLB carregado */
function ttBuildClips(root){
 const bones={};root.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 const missing=TT_BONES.filter(n=>!bones[n]);
 if(missing.length)console.error('[TITAN] Ossos ausentes no GLB:',missing.join(', '));
 root.updateMatrixWorld(true);
 const rootQ=new THREE.Quaternion();root.getWorldQuaternion(rootQ);const rootQi=rootQ.clone().invert();
 const rest={};
 for(const n of TT_BONES){const b=bones[n];if(!b)continue;
  const pw=new THREE.Quaternion();if(b.parent)b.parent.getWorldQuaternion(pw);pw.premultiply(rootQi);
  rest[n]={L:b.quaternion.clone(),Pw:pw,Pwi:pw.clone().invert(),pos:b.position.clone()};}
 const hipsRest=rest.Hips?rest.Hips.pos:new THREE.Vector3();
 /* escala de unidade do Hips (o Armature tem escala 0,01): 1 unidade do modelo = 1/s no osso */
 const hipUnit=(bones.Hips&&bones.Hips.parent)?1/(bones.Hips.parent.scale.y||1):1;
 const e=new THREE.Euler(),R=new THREE.Quaternion();
 function boneQ(n,deg){const r=rest[n];if(!deg)return r.L.clone();
  e.set(deg[0]*Math.PI/180,deg[1]*Math.PI/180,deg[2]*Math.PI/180,'YXZ');R.setFromEuler(e);
  return r.Pwi.clone().multiply(R).multiply(r.Pw).multiply(r.L);}
 const clips={};
 for(const name in TT_CLIPS){
  const C=TT_CLIPS[name],times=C.keys.map(k=>k[0]),tracks=[];
  for(const n of TT_BONES){if(!rest[n])continue;
   const vals=[];for(const k of C.keys){const q=boneQ(n,TTP[k[1]][n]);vals.push(q.x,q.y,q.z,q.w);}
   tracks.push(new THREE.QuaternionKeyframeTrack(bones[n].name+'.quaternion',times,vals));}
  if(rest.Hips){const vals=[];for(const k of C.keys){const p=TTP[k[1]];vals.push(hipsRest.x,hipsRest.y+(p.hipY||0)*hipUnit,hipsRest.z+(p.hipZ||0)*hipUnit);}
   tracks.push(new THREE.VectorKeyframeTrack(bones.Hips.name+'.position',times,vals));}
  const clip=new THREE.AnimationClip('tt_'+name,times[times.length-1],tracks);
  clip.userData={loop:!!C.loop};
  clips[name]=clip;
 }
 return {clips,bones,missing};
}

/* Controlador: um AnimationMixer, ações nomeadas e crossfade suave */
class TTAnimator{
 constructor(model,gltfClips,built){
  this.mixer=new THREE.AnimationMixer(model);
  this.actions={};this.cur=null;this.curName='';
  const add=(n,clip,loop)=>{const a=this.mixer.clipAction(clip);a.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);a.clampWhenFinished=!loop;this.actions[n]=a;};
  for(const c of gltfClips){const n=c.name.split('|').pop().toLowerCase();if(n==='walk'||n==='run')add(n,c,true);}
  for(const n in built)add(n,built[n],built[n].userData.loop);
  if(!this.actions.walk)console.warn('[TITAN] clipe "walk" não encontrado no GLB; usando turn');
  if(!this.actions.run)console.warn('[TITAN] clipe "run" não encontrado no GLB; usando chargeRun');
  this.actions.walk=this.actions.walk||this.actions.turn;this.actions.run=this.actions.run||this.actions.chargeRun;
 }
 play(name,fade,ts){
  const a=this.actions[name];if(!a){console.warn('[TITAN] animação inexistente',name);return null;}
  if(ts!==undefined)a.timeScale=ts;
  if(this.cur===a){return a;}
  a.reset();a.enabled=true;a.setEffectiveTimeScale(ts!==undefined?ts:1);a.setEffectiveWeight(1);a.play();
  if(this.cur)this.cur.crossFadeTo(a,fade==null?.25:fade,false);
  this.cur=a;this.curName=name;return a;
 }
 restart(name,fade,ts){if(this.actions[name]===this.cur){this.cur=null;}return this.play(name,fade,ts);}
 time(){return this.cur?this.cur.time:0;}
 dur(){return this.cur?this.cur.getClip().duration:0;}
 done(){return this.cur&&!this.cur.isRunning();}
 update(dt){this.mixer.update(dt);}
 stop(){this.mixer.stopAllAction();this.cur=null;this.curName='';}
}
