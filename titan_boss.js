const TT_V0=new THREE.Vector3();
"use strict";
/* TITAN — O GOLEM: carregamento e validação do GLB, hitboxes por osso, pontos fracos,
   sistema de dano, IA por estados, cinco habilidades e sequência de morte.
   O modelo usado é SEMPRE models/boss/stone-golem.glb (o golem fornecido, otimizado). */

const TT={asset:null,loading:null,err:null,B:null,active:false,lockFire:false,hitZone:null,hitObj:null,pend:[],stats:null,
 prison:null,meteors:[],waves:[],beam:null,charge:null,pv:new THREE.Vector3(),lastPX:0,lastPZ:0,god:false,
 _v:new THREE.Vector3(),_v2:new THREE.Vector3(),_v3:new THREE.Vector3(),_q:new THREE.Quaternion(),_m:new THREE.Matrix4(),_up:new THREE.Vector3(0,1,0)};
const TT_STATES=['INTRO','IDLE','DETECT_PLAYER','APPROACH_PLAYER','CHASE_PLAYER','MELEE_ATTACK','EARTHQUAKE_ATTACK','METEOR_ATTACK',
 'ROCK_PRISON_ATTACK','CHARGE_ATTACK','ENERGY_BEAM_ATTACK','STAGGERED','ENRAGED','PHASE_TRANSITION','DEFEATED','HIT','TURN','RECOVER','VICTORY'];

function ttDiff(){return TITAN_DIFF[typeof diffKey!=='undefined'?diffKey:'normal']||TITAN_DIFF.normal;}
function ttDmgK(){const B=TT.B;return ttDiff().dmg*(B?TITAN_CFG.dmgMul[B.phase]:1);}
function ttLog(...a){console.log('%c[TITAN]','color:#3fe0d0;font-weight:bold',...a);}
function ttFail(m){TT.err=m;console.error('[TITAN] '+m);}

/* ---------- CARREGAMENTO + VALIDAÇÃO ---------- */
function ttLoad(onProgress){
 if(TT.loading)return TT.loading;
 TT.loading=new Promise((res,rej)=>{
  if(!THREE.GLTFLoader){ttFail('GLTFLoader indisponível');rej(new Error(TT.err));return;}
  new THREE.GLTFLoader().load(TITAN_CFG.model,gltf=>{
   try{TT.asset=ttValidate(gltf);ttLog('modelo validado',TT.asset.report);res(TT.asset);}
   catch(e){ttFail('Modelo do golem inválido: '+e.message);rej(e);}
  },xhr=>{if(onProgress&&xhr.total)onProgress(xhr.loaded/xhr.total);TT.progress=xhr.total?xhr.loaded/xhr.total:0;},
  err=>{ttFail('Falha ao carregar '+TITAN_CFG.model+': '+(err&&err.message||err));rej(err);});
 });
 TT.loading.catch(()=>{});
 return TT.loading;
}
function ttValidate(gltf){
 const sc=gltf.scene;if(!sc)throw new Error('GLB sem cena');
 let meshes=0,skinned=null,verts=0;const mats=new Set();
 sc.traverse(o=>{if(o.isMesh){meshes++;verts+=o.geometry&&o.geometry.attributes.position?o.geometry.attributes.position.count:0;
  if(o.isSkinnedMesh)skinned=o;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m&&mats.add(m));}});
 if(!meshes||!verts)throw new Error('nenhuma malha visível');
 if(!skinned)throw new Error('malha sem esqueleto (SkinnedMesh ausente)');
 const bones=skinned.skeleton?skinned.skeleton.bones.length:0;if(bones<20)throw new Error('esqueleto incompleto ('+bones+' ossos)');
 for(const m of mats){
  if(m.transparent||m.opacity<1||m.alphaTest>0||m.visible===false){console.warn('[TITAN] material corrigido (estava transparente/oculto):',m.name);m.transparent=false;m.opacity=1;m.alphaTest=0;m.visible=true;}
  m.depthWrite=true;m.depthTest=true;if(!m.map)console.warn('[TITAN] material sem textura base:',m.name);m.needsUpdate=true;}
 sc.updateMatrixWorld(true);
 /* SkinnedMesh: a malha é desenhada pelos ossos (bind pose = coordenadas da geometria), então a caixa
    vem da geometria e não do setFromObject (que aplicaria a escala 0,01 do Armature) */
 skinned.geometry.computeBoundingBox();
 const box=skinned.geometry.boundingBox.clone(),size=box.getSize(new THREE.Vector3()),ctr=box.getCenter(new THREE.Vector3());
 if(box.min.y<-.5*size.y)console.warn('[TITAN] modelo com origem abaixo dos pés; corrigido pelo deslocamento');
 if(!isFinite(size.x+size.y+size.z)||size.y<.01)throw new Error('caixa delimitadora inválida');
 const scale=TITAN_CFG.height/size.y;if(!(scale>0)||!isFinite(scale))throw new Error('escala inválida');
 const clips=gltf.animations.map(c=>c.name);
 const built=ttBuildClips(sc);if(built.missing.length>4)throw new Error('ossos humanoides ausentes: '+built.missing.join(','));
 return {gltf,scene:sc,skinned,mats:[...mats],size,ctr,minY:box.min.y,scale,clips:built.clips,bones:built.bones,
  report:{meshes,vertices:verts,bones,materials:mats.size,sizeModel:size.toArray().map(v=>+v.toFixed(2)),scale:+scale.toFixed(3),heightM:TITAN_CFG.height,
   clipsInGLB:clips,clipsBuilt:Object.keys(built.clips)}};
}
/* máscara de emissão: só as rachaduras/olhos/núcleo ciano da textura original brilham */
function ttCrackMask(map){
 try{const img=map&&map.image;if(!img)return null;const S=512,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
  g.drawImage(img,0,0,S,S);const id=g.getImageData(0,0,S,S),d=id.data;
  for(let i=0;i<d.length;i+=4){const r=d[i],gg=d[i+1],b=d[i+2];let v=0;
   if(b>r+28&&gg>r+20&&b>gg*.62)v=Math.min(255,(Math.min(gg,b)-r-18)*3.2);
   d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}
  g.putImageData(id,0,0);
  const t=new THREE.CanvasTexture(c);t.flipY=map.flipY;t.encoding=THREE.sRGBEncoding;t.wrapS=map.wrapS;t.wrapT=map.wrapT;return t;
 }catch(e){console.warn('[TITAN] máscara de brilho indisponível',e);return null;}
}

/* ---------- MONTAGEM DO CHEFE (uma única vez) ---------- */
function ttBuildBoss(){
 if(TT.B)return TT.B;
 const A=TT.asset,model=A.scene,H=TITAN_CFG.height,S=A.scale;
 const root=new THREE.Group();root.name='TITAN';const tilt=new THREE.Group();const holder=new THREE.Group();
 holder.scale.setScalar(S);holder.position.set(-A.ctr.x*S,-A.minY*S,-A.ctr.z*S);holder.add(model);tilt.add(holder);root.add(tilt);
 const mat=A.skinned.material;
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
 const mask=ttCrackMask(mat.map);
 if(mat.emissive){mat.emissive.setHex(0x2fe6d6);mat.emissiveMap=mask||null;mat.emissiveIntensity=mask?.25:0;mat.needsUpdate=true;}
 mat.envMapIntensity=.5;
 const anim=new TTAnimator(model,A.gltf.animations,A.clips);
 const bones=A.bones;
 /* âncoras: núcleo do peito, cabeça, olhos, mãos (filhas dos ossos, seguem a animação) */
 const toLocal=(bone,x,y,z)=>{model.updateMatrixWorld(true);const o=new THREE.Object3D();const p=new THREE.Vector3(x,y,z);model.localToWorld(p);bone.worldToLocal(p);o.position.copy(p);bone.add(o);return o;};
 const anchors={core:toLocal(bones.Spine,0,2.1,.4),head:toLocal(bones.Head,0,2.56,.07),eye:toLocal(bones.Head,0,2.6,.33),
  handL:toLocal(bones.LeftHand,1.02,1.15,.25),handR:toLocal(bones.RightHand,-1.02,1.15,.25)};
 /* hitboxes invisíveis por região (atualizadas por osso a cada quadro) */
 const hbg=new THREE.Group();hbg.name='titanHitboxes';
 const boxG=new THREE.BoxGeometry(1,1,1),sphG=new THREE.SphereGeometry(1,10,8);
 const hmat=new THREE.MeshBasicMaterial({color:0xff00ff,wireframe:true,visible:false});
 const mk=(zone,geo)=>{const m=new THREE.Mesh(geo,hmat);m.userData.ttZone=zone;hbg.add(m);return m;};
 const segs=[['torso','Hips','neck',.9,.62,1.08],['armL','LeftArm','LeftForeArm',.5,.5,1],['armL','LeftForeArm','LeftHand',.44,.44,1.5],
  ['armR','RightArm','RightForeArm',.5,.5,1],['armR','RightForeArm','RightHand',.44,.44,1.5],
  ['legL','LeftUpLeg','LeftLeg',.52,.52,1],['legL','LeftLeg','LeftFoot',.46,.46,1.12],['legR','RightUpLeg','RightLeg',.52,.52,1],['legR','RightLeg','RightFoot',.46,.46,1.12]];
 const hit=segs.map(s=>({m:mk(s[0],boxG),zone:s[0],a:bones[s[1]],b:bones[s[2]],w:s[3],d:s[4],ext:s[5]}));
 const headHB=mk('head',sphG),coreHB=mk('core',sphG);
 /* luz e brilho do núcleo, olhos */
 const coreLight=new THREE.PointLight(0x3fffe8,1.2,20,2);
 const coreGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:TTFX.tex.glow,color:0x5ffff0,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));coreGlow.scale.setScalar(1.4);
 const eyeGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:TTFX.tex.glow,color:0x7ffff4,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,opacity:.7}));eyeGlow.scale.set(1.6,.7,1);
 scene.add(coreLight);coreLight.intensity=0;
 const B=TT.B={root,tilt,holder,model,mat,mask,anim,bones,anchors,hbg,hit,headHB,coreHB,coreLight,coreGlow,eyeGlow,H,S,
  hp:1,max:1,phase:0,ai:{state:'INTRO',t:0,sub:0},e:null,glow:.25,glowT:.25};
 /* entidade compatível com o restante do jogo (tiro, mira assistida, radar, bazuca) */
 const e={golem:true,type:'titan',role:'boss',g:root,pos:root.position,meshes:[...hit.map(h=>h.m),headHB,coreHB],head:headHB,
  T:{pts:5000,scale:H/1.8,hp:TITAN_CFG.hp},MT:{h:H},state:'fight',last:new THREE.Vector3(),react:0,suppress:0,hitAccPen:0,passive:false,legs:[],arms:[],dmgMul:1};
 Object.defineProperty(e,'hp',{get(){return Math.max(.001,B.hp);},set(v){const cur=Math.max(.001,B.hp),d=cur-v;if(d>0)ttDamage(d,TT.hitZone||'torso',TT.hitObj);TT.hitZone=null;TT.hitObj=null;},configurable:true});
 Object.defineProperty(e,'max',{get(){return B.max;},configurable:true});
 e.meshes.forEach(m=>m.userData.enemy=e);
 B.e=e;
 return B;
}

/* ---------- RESET POR LUTA (sem recarregar nada) ---------- */
function ttResetBoss(){
 const B=TT.B,d=ttDiff();
 B.max=Math.round(TITAN_CFG.hp*d.hp);B.hp=B.max;B.phase=0;B.dead=false;B.deadT=0;B.exploded=false;
 B.root.position.set(0,0,-8);B.root.rotation.set(0,0,0);B.tilt.position.set(0,0,0);B.tilt.rotation.set(0,0,0);B.holder.visible=true;
 B.ai={state:'INTRO',t:0,sub:0,last:[],cd:{melee:2,smash:5,charge:6,meteor:3,prison:6,beam:4},next:0,stuck:0,combo:0};
 B.exposed=0;B.armAcc={L:0,R:0};B.weak={L:0,R:0};B.legAcc=0;B.legSlow=0;B.headAcc=0;B.headCD=0;B.flinch=0;B.hitCD=0;B.hitFlash=0;
 B.glow=.25;B.glowT=.25;B.coreK=1;B.rage=0;B.feet={L:false,R:false};B.speed=0;B.auraT=0;B.stepK=1;
 B.anim.stop();B.anim.play('idle',0);
 B.coreLight.intensity=1.2;
 if(!B.root.parent)scene.add(B.root);if(!B.hbg.parent)scene.add(B.hbg);
 if(!B.coreGlow.parent)scene.add(B.coreGlow);if(!B.eyeGlow.parent)scene.add(B.eyeGlow);
 B.e.state='fight';B.e.pos=B.root.position;
 TT.meteors.forEach(m=>{m.on=false;m.m.visible=false;ttfxWarnOff(m.warn);});TT.waves.length=0;ttBeamOff();ttPrisonClear(true);ttChargeTeleOff();
 TT.stats={t0:performance.now(),dealt:0,taken:0,crits:0,weak:0,hits:0,maxCombo:0};
}
function ttRemoveBoss(){
 const B=TT.B;if(!B)return;
 [B.root,B.hbg,B.coreGlow,B.eyeGlow].forEach(o=>{if(o.parent)o.parent.remove(o);});B.coreLight.intensity=0;
 const i=enemies.indexOf(B.e);if(i>=0)enemies.splice(i,1);
 B.anim.stop();ttBeamOff();ttPrisonClear(true);ttChargeTeleOff();TT.waves.length=0;
 TT.meteors.forEach(m=>{m.on=false;m.m.visible=false;});
}

/* ---------- DANO NO GOLEM ---------- */
function ttDamage(raw,zone,obj){
 const B=TT.B;if(!B||!TT.active||B.dead||B.ai.state==='INTRO'||TT.cine)return;
 const Z=TITAN_CFG.zones[zone]||TITAN_CFG.zones.torso;
 let mul=Z.mul;if(zone==='core')mul=B.exposed>0?Z.mul:Z.closedMul;
 if(B.ai.state==='PHASE_TRANSITION')mul*=TITAN_CFG.phaseShield;
 const dmg=raw*mul;B.hp-=dmg;
 const S=TT.stats;S.dealt+=Math.min(dmg,B.hp+dmg);S.hits++;
 const weak=zone!=='torso'&&!(zone==='core'&&B.exposed<=0),crit=mul>=TITAN_CFG.critMul;
 if(weak)S.weak++;if(crit)S.crits++;
 B.hitFlash=.07;B.flinch+=dmg;
 /* efeitos por região */
 if(zone==='head'){B.headAcc+=dmg;}
 if(zone==='armL'||zone==='armR'){const s=zone==='armL'?'L':'R';B.armAcc[s]+=dmg;if(B.weak[s]<=0&&B.armAcc[s]>=TITAN_CFG.armWeak.dmg){B.weak[s]=TITAN_CFG.armWeak.dur;B.armAcc[s]=0;msg('BRAÇO '+(s==='L'?'ESQUERDO':'DIREITO')+' DO TITÃ ENFRAQUECIDO!',2);TTS.stagger(B.anchors['hand'+s].getWorldPosition(TT._v));}}
 if(zone==='legL'||zone==='legR'){B.legAcc+=dmg;if(B.legSlow<=0&&B.legAcc>=TITAN_CFG.legSlow.dmg){B.legSlow=TITAN_CFG.legSlow.dur;B.legAcc=0;msg('PERNAS ATINGIDAS — O TITÃ ESTÁ MAIS LENTO!',2);}}
 TT.pend.push({dmg,zone,crit,weak,core:zone==='core'&&B.exposed>0,armor:zone==='core'&&B.exposed<=0,obj});
 if(TT.pend.length>6)TT.pend.shift();
 if(crit)TTS.crit();else if(zone==='core'&&B.exposed>0)TTS.coreHit();else if(weak)TTS.weak();
 /* fases */
 const f=B.hp/B.max;
 if(B.hp<=0){B.hp=0;ttDefeat();return;}
 if(B.phase===0&&f<=TITAN_CFG.phase2At)ttPhaseTransition(1);
 else if(B.phase===1&&f<=TITAN_CFG.phase3At)ttPhaseTransition(2);
}
/* mostra número de dano no ponto exato do impacto (chamado pelo burst do tiro) */
function ttFlushHit(point){
 const B=TT.B;const h=TT.pend.shift();if(!h)return;
 const p=point||(h.obj?h.obj.getWorldPosition(TT._v3):B.anchors.core.getWorldPosition(TT._v3));
 const n=Math.round(h.dmg);
 if(h.core){ttfxNum(p,n+' NÚCLEO!','core big');ttfxSpark(p,10,0x7ffff0,7,.5,.35);ttfxFlash(p,0x5ffff0,4,.15);}
 else if(h.crit){ttfxNum(p,n+' CRÍTICO','crit big');ttfxSpark(p,6,0xffd060,6,.4,.3);}
 else if(h.armor){ttfxNum(p,n+' BLINDADO','armor');ttfxSpark(p,4,0xdddddd,5,.25,.18);}
 else if(h.weak){ttfxNum(p,String(n),'weak');ttfxSpark(p,3,0xffe080,4,.3,.2);}
 else ttfxNum(p,String(n),'');
 ttfxDebris(p,1,3,.08,.6);
}

/* ---------- AUXILIARES ---------- */
function ttFwd(B,out){const y=B.root.rotation.y;return (out||TT._v).set(Math.sin(y),0,Math.cos(y));}
function ttAngTo(B,x,z){return Math.atan2(x-B.root.position.x,z-B.root.position.z);}
function ttWrap(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
function ttTurn(B,target,rate){const d=ttWrap(target-B.root.rotation.y);B.root.rotation.y+=Math.max(-rate,Math.min(rate,d));return Math.abs(d);}
function ttDistP(B){return Math.hypot(P.x-B.root.position.x,P.z-B.root.position.z);}
function ttPredict(t,out){out=out||TT._v2;out.set(P.x+TT.pv.x*t,0,P.z+TT.pv.z*t);const r=Math.hypot(out.x,out.z),R=TITAN_CFG.arenaR-3;if(r>R){out.x*=R/r;out.z*=R/r;}return out;}
function ttSpeedMul(B){return TITAN_CFG.speedMul[B.phase]*(B.legSlow>0?TITAN_CFG.legSlow.mul:1);}
function ttArmMul(B,s){return B.weak[s]>0?TITAN_CFG.armWeak.mul:1;}
function ttPlayerGrounded(h){return P.y<(h===undefined?TITAN_CFG.smash.jumpClear:h);}
function ttHurt(d,from){if(TT.god||P.dead)return;hurt(d*ttDmgK(),from);}
function ttKnock(dx,dz,f){const L=Math.hypot(dx,dz)||1;if(typeof MONPW_KB!=='undefined'){MONPW_KB.t=.32;MONPW_KB.vx=dx/L*f/.32;MONPW_KB.vz=dz/L*f/.32;}}
/* colisão circular do golem contra os colisores AABB */
function ttBlockedAt(x,z,r){
 if(Math.hypot(x,z)>TITAN_CFG.arenaR-r*.6)return {wall:true,strong:true};
 for(const c of colliders){if(c.ttSpike||c.top<.6)continue;const cx=Math.max(c.x0,Math.min(x,c.x1)),cz=Math.max(c.z0,Math.min(z,c.z1));if((cx-x)*(cx-x)+(cz-z)*(cz-z)<r*r)return c;}
 return null;
}
function ttPropOf(c){return c?(c.prop||(c.fallenOf)||null):null;}
function ttSmashCol(c,from){const p=ttPropOf(c);if(!p)return false;
 if(c.fallenOf){const i=colliders.indexOf(c);if(i>=0)colliders.splice(i,1);p.fallen=null;p.g.visible=false;p.solids.forEach(s=>{const k=solids.indexOf(s);if(k>=0)solids.splice(k,1);});
  const pos=TT._v3.set((c.x0+c.x1)/2,1,(c.z0+c.z1)/2);ttfxDebris(pos,14,7,.45);ttfxDust(pos,5,4,2.5,4);TTS.rockBreak(pos,1);return true;}
 if(p.breakable&&!p.strong){ttPropBreak(p,from);return true;}return false;}
function ttMove(B,dx,dz,smash){
 const R=TITAN_CFG.radius,p=B.root.position;let moved=false,blk=null;
 const nx=p.x+dx,nz=p.z+dz;let c=ttBlockedAt(nx,nz,R);
 if(c&&smash!==false&&!c.wall&&ttSmashCol(c,p))c=ttBlockedAt(nx,nz,R);
 if(!c){p.x=nx;p.z=nz;return {moved:true,blk:null};}
 blk=c;
 if(!ttBlockedAt(nx,p.z,R)){p.x=nx;moved=true;}else if(!ttBlockedAt(p.x,nz,R)){p.z=nz;moved=true;}
 return {moved,blk};
}
/* escolhe uma direção livre (desvio de obstáculos) */
function ttSteer(B,ang){
 const R=TITAN_CFG.radius,p=B.root.position;
 for(const off of [0,.45,-.45,.9,-.9,1.35,-1.35,1.9,-1.9]){const a=ang+off*(B.ai.side||1);const x=p.x+Math.sin(a)*3.2,z=p.z+Math.cos(a)*3.2;const c=ttBlockedAt(x,z,R);
  if(!c||(!c.wall&&ttPropOf(c)&&ttPropOf(c).breakable&&!ttPropOf(c).strong))return a;}
 return ang;
}
function ttCanSee(from,to){return canSee(from,to);}

/* ---------- FASES ---------- */
function ttPhaseTransition(n){
 const B=TT.B;if(B.phase>=n||B.dead)return;
 B.phase=n;ttInterrupt(B);ttSet(B,'PHASE_TRANSITION');if(typeof updHud==='function')updHud();
 B.anim.restart('enraged',.2);TTS.phase();TTS.roar(B.root.position,1.3);
 msg('FASE '+(n+1)+' — '+TITAN_CFG.phaseNames[n],3.2);
 if(typeof ttHudPhase==='function')ttHudPhase(n);
 /* novas habilidades disponíveis rapidamente */
 if(n===1){B.ai.cd.meteor=1.5;B.ai.cd.prison=7;}if(n===2){B.ai.cd.beam=1.2;}
 if(typeof bzMakePad==='function'&&typeof BZ!=='undefined'&&!BZ.pad&&BZ.ammo<=0)setTimeout(()=>{if(TT.active&&!TT.B.dead){bzMakePad();ttFixPad();}},4500);
}
function ttFixPad(){if(typeof BZ==='undefined'||!BZ.pad)return;const g=BZ.pad.g.position;
 if(Math.hypot(g.x,g.z)>30||hitsBox(g.x,g.z,0,2,2)){for(let i=0;i<30;i++){const a=Math.random()*6.283,r=14+Math.random()*14;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(!hitsBox(x,z,0,2.2,2.2)&&Math.hypot(x-TT.B.root.position.x,z-TT.B.root.position.z)>12){g.set(x,0,z);break;}}}}

/* ---------- MÁQUINA DE ESTADOS ---------- */
function ttSet(B,s,sub){B.ai.state=s;B.ai.t=0;B.ai.sub=sub||0;B.ai.flag={};}
function ttInterrupt(B){
 /* cancela ataque em andamento (telegrafias e projetéis pendentes do golem) */
 ttChargeTeleOff();ttBeamOff();ttaStop('beamc');ttaStop('beam');
 if(B.ai.warn){ttfxWarnOff(B.ai.warn);B.ai.warn=null;}
 B.tilt.rotation.x=0;
}
function ttRecover(B,mul){const k=B.phase;
 if(Math.random()<TITAN_CFG.comboChance[k]&&B.ai.combo<2){B.ai.combo++;B.ai.next=.15;}else{B.ai.combo=0;B.ai.next=TITAN_CFG.recover[k]*(mul||1);}
 ttSet(B,'RECOVER');}
function ttUseCd(B,name,base){B.ai.cd[name]=base*TITAN_CFG.cdMul[B.phase];B.ai.last.unshift(name);B.ai.last.length=Math.min(B.ai.last.length,3);}

function ttChooseAttack(B,d){
 const C=TITAN_CFG,k=B.phase,cd=B.ai.cd,cand=[];
 const eye=B.anchors.head.getWorldPosition(TT._v3),pt=TT._v2.set(P.x,P.y+1.2,P.z);
 const covered=!ttCanSee(eye,pt);
 const ang=Math.abs(ttWrap(ttAngTo(B,P.x,P.z)-B.root.rotation.y));
 if(cd.melee<=0&&d<C.melee.range+1.2&&(ang<1.0||d<C.melee.stompR))cand.push(['melee',3.2+(d<5.5?1:0)]);
 if(cd.smash<=0&&d<C.smash.maxR[k]*.85&&d>3)cand.push(['smash',2.1+(d>6&&d<15?1:0)]);
 if(cd.charge<=0&&d>11&&d<44){let w=1.8+(d>20?.8:0);
  /* evita investir contra um obstáculo forte entre ele e o jogador (exceto na fase 3) */
  const blockedStrong=ttLineStrong(B.root.position,P);if(blockedStrong&&k<2)w*=.15;cand.push(['charge',w]);}
 if(k>=1&&cd.meteor<=0&&(!TT.prison||k>=2))cand.push(['meteor',1.8+(covered?1.6:0)+(d>15?.8:0)]);
 if(k>=1&&cd.prison<=0&&!TT.prison&&P.ground&&ttPlayerGrounded(.4))cand.push(['prison',1.4+(TT.pv.length()>3?1:0)+(d>14?.5:0)]);
 if(k>=2&&cd.beam<=0&&d>9)cand.push(['beam',2.4+(d>18?1.2:0)+(covered?.4:0)]);
 if(!cand.length)return null;
 let best=null,bw=-1;
 for(const [n,w0] of cand){let w=w0;if(B.ai.last[0]===n)w*=.25;else if(B.ai.last[1]===n)w*=.65;w*=.75+Math.random()*.5;if(w>bw){bw=w;best=n;}}
 return best;
}
/* existe obstáculo forte na linha golem → jogador? */
function ttLineStrong(a,b){const dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz),n=Math.ceil(L/2);
 for(let i=2;i<n;i++){const x=a.x+dx*i/n,z=a.z+dz*i/n;for(const c of colliders){if(!c.strong||c.wall)continue;if(x>c.x0-1.5&&x<c.x1+1.5&&z>c.z0-1.5&&z<c.z1+1.5)return true;}}return false;}

function ttStartAttack(B,name){
 const C=TITAN_CFG;
 if(name==='melee'){const d=ttDistP(B),ang=Math.abs(ttWrap(ttAngTo(B,P.x,P.z)-B.root.rotation.y));
  if(d<C.melee.stompR&&(ang>.7||d<4.6)){ttSet(B,'MELEE_ATTACK',1);B.anim.restart('earthquake',.2,1.15);B.ai.warn=ttfxWarn(B.root.position,C.melee.stompR,1.2,0xff5020);}
  else{ttSet(B,'MELEE_ATTACK',0);B.anim.restart('heavyAttack',.2,1.05);}
  ttUseCd(B,'melee',C.melee.cd);TTS.swing(B.root.position);return;}
 if(name==='smash'){ttSet(B,'EARTHQUAKE_ATTACK');B.anim.restart('groundSmash',.25,1+B.phase*.08);ttUseCd(B,'smash',C.smash.cd);
  const c=ttFwd(B,TT._v).multiplyScalar(C.smash.reach).add(B.root.position);B.ai.center=c.clone();B.ai.warn=ttfxWarn(c,C.smash.inner,1.6,0xff3a20);
  B.ai.warn2=ttfxWarn(c,C.smash.maxR[B.phase],1.6,0xff7a30);B.ai.warn2.m.material.opacity=.2;
  msg('O TITÃ ERGUE OS BRAÇOS — PULE A ONDA DE CHOQUE!',1.8);TTS.roar(B.root.position,.6);return;}
 if(name==='charge'){ttSet(B,'CHARGE_ATTACK',0);B.anim.restart('charging',.25);ttUseCd(B,'charge',C.charge.cd);TTS.chargeRoar(B.root.position);msg('INVESTIDA! ESQUIVE PARA O LADO',1.6);return;}
 if(name==='meteor'){ttSet(B,'METEOR_ATTACK');B.anim.restart('summon',.25,1+B.phase*.06);ttUseCd(B,'meteor',C.meteor.cd);msg('CHUVA DE METEOROS — FUJA DOS CÍRCULOS VERMELHOS!',2);return;}
 if(name==='prison'){ttSet(B,'ROCK_PRISON_ATTACK');B.anim.restart('rockPrison',.25);ttUseCd(B,'prison',C.prison.cd);TTS.roar(B.root.position,.7);return;}
 if(name==='beam'){ttSet(B,'ENERGY_BEAM_ATTACK',0);B.anim.restart('beamCharge',.3);ttUseCd(B,'beam',C.beam.cd);
  B.ai.aim=ttPredict(.5,new THREE.Vector3()).setY(P.y+1);ttaLoop('beamc',{f:200,gain:.18,tone:80,wave:'sawtooth',toneGain:.12,type:'bandpass',q:2,pos:B.root.position,ref:16});
  msg('O NÚCLEO DO TITÃ ESTÁ CARREGANDO — PROCURE COBERTURA!',2.2);return;}
}

/* ---------- ATUALIZAÇÃO PRINCIPAL DO GOLEM ---------- */
function ttBossUpdate(dt){
 const B=TT.B,C=TITAN_CFG,ai=B.ai;ai.t+=dt;
 /* velocidade do jogador (para previsão) */
 const vx=(P.x-TT.lastPX)/Math.max(dt,1e-3),vz=(P.z-TT.lastPZ)/Math.max(dt,1e-3);TT.lastPX=P.x;TT.lastPZ=P.z;
 if(Math.hypot(vx,vz)<30){TT.pv.x+=(vx-TT.pv.x)*Math.min(1,dt*4);TT.pv.z+=(vz-TT.pv.z)*Math.min(1,dt*4);}
 for(const k in ai.cd)ai.cd[k]=Math.max(0,ai.cd[k]-dt);
 B.weak.L=Math.max(0,B.weak.L-dt);B.weak.R=Math.max(0,B.weak.R-dt);B.legSlow=Math.max(0,B.legSlow-dt);B.headCD=Math.max(0,B.headCD-dt);
 B.headAcc=Math.max(0,B.headAcc-dt*C.headStagger.dmg/C.headStagger.window);B.flinch=Math.max(0,B.flinch-dt*120);B.hitCD=Math.max(0,B.hitCD-dt);
 B.exposed=Math.max(0,B.exposed-dt);B.hitFlash=Math.max(0,B.hitFlash-dt);
 const d=ttDistP(B),want=ttAngTo(B,P.x,P.z),turnR=C.turnRate*ttSpeedMul(B);
 /* reações que interrompem: cabeça → atordoamento curto */
 const interruptible=['IDLE','APPROACH_PLAYER','CHASE_PLAYER','RECOVER','TURN','MELEE_ATTACK','METEOR_ATTACK','ROCK_PRISON_ATTACK'].includes(ai.state);
 if(!B.dead&&B.headAcc>=C.headStagger.dmg&&B.headCD<=0&&interruptible&&!(ai.state==='ROCK_PRISON_ATTACK'&&ai.flag&&ai.flag.cast)){
  B.headAcc=0;B.headCD=C.headStagger.cd;ttInterrupt(B);ttSet(B,'STAGGERED',1);B.anim.restart('hit',.08,.8);TTS.stagger(B.root.position);msg('TIRO NA CABEÇA — TITÃ ATORDOADO!',1.6);}
 else if(!B.dead&&B.flinch>480&&B.hitCD<=0&&['IDLE','APPROACH_PLAYER','CHASE_PLAYER','RECOVER','TURN'].includes(ai.state)){B.flinch=0;B.hitCD=4;ttSet(B,'HIT');B.anim.restart('hit',.08,1);TTS.crack(B.root.position,.8);}

 if(P.dead&&!B.dead&&!['VICTORY','DEFEATED'].includes(ai.state)){ttInterrupt(B);ttSet(B,'VICTORY');B.anim.restart('enraged',.3);TTS.roar(B.root.position,1.2);}

 switch(ai.state){
 case 'INTRO':break;
 case 'IDLE':B.anim.play('idle',.3);if(d<70)ttSet(B,'DETECT_PLAYER');break;
 case 'DETECT_PLAYER':{const r=ttTurn(B,want,turnR*dt);B.anim.play(r>.3?'turn':'idle',.3,.8);if(ai.t>.8&&r<.3){ai.next=.4;ttSet(B,'RECOVER');}break;}
 case 'RECOVER':{const r=ttTurn(B,want,turnR*.8*dt);B.anim.play(r>.5?'turn':'idle',.3,.9);ai.next-=dt;if(ai.next<=0)ttDecide(B,d);break;}
 case 'TURN':{const r=ttTurn(B,want,turnR*1.2*dt);B.anim.play('turn',.25,1.1);if(r<.25||ai.t>2.5)ttDecide(B,d);break;}
 case 'HIT':if(ai.t>.55){B.ai.next=.2;ttSet(B,'RECOVER');}break;
 case 'APPROACH_PLAYER':case 'CHASE_PLAYER':ttLocomotion(B,dt,d,want);break;
 case 'MELEE_ATTACK':ttMelee(B,dt,d,want);break;
 case 'EARTHQUAKE_ATTACK':ttSmash(B,dt);break;
 case 'CHARGE_ATTACK':ttCharge(B,dt,d);break;
 case 'METEOR_ATTACK':ttMeteorCast(B,dt);break;
 case 'ROCK_PRISON_ATTACK':ttPrisonCast(B,dt);break;
 case 'ENERGY_BEAM_ATTACK':ttBeam(B,dt);break;
 case 'STAGGERED':ttStagger(B,dt);break;
 case 'PHASE_TRANSITION':ttPhaseUpd(B,dt,d);break;
 case 'ENRAGED':{ttTurn(B,want,turnR*1.5*dt);if(ai.t>.9){ai.next=0;ai.combo=0;ttSet(B,'RECOVER');}break;}
 case 'DEFEATED':ttDeathUpd(B,dt);break;
 case 'VICTORY':if(B.anim.done())B.anim.play('idle',.4);break;
 }
 /* empurra o jogador para fora do corpo */
 if(!B.dead&&!P.dead){const R=C.radius+PR,dx=P.x-B.root.position.x,dz=P.z-B.root.position.z,dd=Math.hypot(dx,dz);
  if(dd<R&&dd>.001&&P.y<B.H*.8){const push=R-dd;moveCollide(P,dx/dd*push,dz/dd*push,PR,1.6);}}
 ttFeet(B);
}
function ttDecide(B,d){
 const k=B.phase,want=ttAngTo(B,P.x,P.z),ang=Math.abs(ttWrap(want-B.root.rotation.y));
 const a=ttChooseAttack(B,d);
 if(a&&(ang<.9||a==='meteor'||a==='prison'||(a==='melee'&&d<TITAN_CFG.melee.stompR))){ttStartAttack(B,a);return;}
 if(a&&ang>=.9){ttSet(B,'TURN');return;}
 if(ang>1.3&&d<14){ttSet(B,'TURN');return;}
 ttSet(B,d>(k?16:22)?'CHASE_PLAYER':'APPROACH_PLAYER');B.ai.side=Math.random()<.5?1:-1;
}
function ttLocomotion(B,dt,d,want){
 const C=TITAN_CFG,ai=B.ai,run=ai.state==='CHASE_PLAYER';
 const spd=(run?C.runSpeed:C.walkSpeed)*ttSpeedMul(B);
 if(run&&d<(B.phase?11:15))ttSet(B,'APPROACH_PLAYER');else if(!run&&d>(B.phase?18:24))ttSet(B,'CHASE_PLAYER');
 /* animação sincronizada com a velocidade (clipes do GLB: walk 1,8 u/s, run 4,6 u/s em escala 1) */
 const base=run?4.6:1.8,ts=spd/(base*B.S);B.anim.play(run?'run':'walk',.35,ts);
 let ang=ttSteer(B,want);ttTurn(B,ang,C.turnRate*ttSpeedMul(B)*dt);
 const f=ttFwd(B,TT._v);const r=ttMove(B,f.x*spd*dt,f.z*spd*dt);
 if(!r.moved){ai.stuck+=dt;if(ai.stuck>1.4){ai.stuck=0;ai.side=-(ai.side||1);
   /* preso: se houver ataque à distância disponível usa; senão gira e procura outra rota */
   if(B.phase>=1&&ai.cd.meteor<=0){ttStartAttack(B,'meteor');return;}if(ai.cd.smash<=0&&d<18){ttStartAttack(B,'smash');return;}
   ttSet(B,'TURN');return;}}else ai.stuck=Math.max(0,ai.stuck-dt);
 ai.eval=(ai.eval||0)-dt;if(ai.eval<=0){ai.eval=.25;const a=ttChooseAttack(B,d);const ag=Math.abs(ttWrap(want-B.root.rotation.y));
  if(a&&(ag<.9||a==='meteor'||a==='prison'||a==='melee')){ttStartAttack(B,a);}}
}
/* passos: detecta o pé tocando o chão pela altura do osso */
function ttFeet(B){
 const moving=['APPROACH_PLAYER','CHASE_PLAYER','TURN','CHARGE_ATTACK','DETECT_PLAYER','RECOVER'].includes(B.ai.state)&&B.anim.curName!=='idle';
 for(const s of ['L','R']){const bone=B.bones[(s==='L'?'Left':'Right')+'Foot'];const y=bone.getWorldPosition(TT._v3).y;const down=y<B.H*.055;
  if(down&&!B.feet[s]&&moving){const dp=Math.hypot(P.x-TT._v3.x,P.z-TT._v3.z),k=B.ai.state==='CHARGE_ATTACK'?1.3:B.anim.curName==='run'?1:.7;
   TTS.step(TT._v3,k);ttfxShake(Math.max(0,.45*k-dp*.012),.25);ttfxDust(TT._v3.setY(.2),2,2.4,1.6,1.2);}
  B.feet[s]=down;}
}

/* ---------- 0) GOLPE CORPO A CORPO / PISÃO ---------- */
function ttMelee(B,dt,d,want){
 const C=TITAN_CFG.melee,ai=B.ai,a=B.anim.cur,t=a?a.time:0;
 if(ai.sub===0){ /* golpe com o braço direito */
  if(t<.95)ttTurn(B,want,2.4*dt);
  if(!ai.flag.hit&&t>=1.16){ai.flag.hit=true;const hp=B.anchors.handR.getWorldPosition(TT._v3).clone();hp.y=0;
   const ang=Math.abs(ttWrap(want-B.root.rotation.y)),dd=Math.min(d,Math.hypot(P.x-hp.x,P.z-hp.z)+1);
   if(dd<C.range&&ang<1.2&&P.y<B.H*.6){ttHurt(C.dmg*ttArmMul(B,'R'),B.root.position);ttKnock(P.x-B.root.position.x,P.z-B.root.position.z,6);msg('ATINGIDO PELO PUNHO DO TITÃ!',1);}
   TTS.impact(hp,.7);ttfxShake(.7,.4);ttfxDust(hp,4,3.5,2.2,2);ttfxDebris(hp.setY(.4),10,7,.3);ttfxCrater(hp,2.2);
   ttPropsInCircle(hp.x,hp.z,3.2).forEach(p=>ttPropDamage(p,900,B.root.position));}
 }else{ /* pisão sísmico em volta do corpo */
  if(!ai.flag.hit&&t>=1.3){ai.flag.hit=true;ttfxWarnOff(ai.warn);ai.warn=null;const c=B.root.position;
   if(d<C.stompR&&ttPlayerGrounded()){ttHurt(C.stompDmg*ttArmMul(B,'L'),c);ttKnock(P.x-c.x,P.z-c.z,8);}
   TTS.impact(c,.8);ttfxShake(.9,.5);ttfxRing(c,1,C.stompR*1.2,.6,0xffa060);ttfxDust(c,6,4,2.4,4);ttfxDebris(TT._v3.copy(c).setY(.4),14,8,.3);ttfxCrack(c,4,2.5,0xffa070);
   ttPropsInCircle(c.x,c.z,C.stompR).forEach(p=>ttPropDamage(p,500,c));}
 }
 if(a&&!a.isRunning()||ai.t>3)ttRecover(B,.8);
}
/* ---------- 1) EARTHQUAKE SMASH ---------- */
function ttSmash(B,dt){
 const C=TITAN_CFG.smash,ai=B.ai,a=B.anim.cur,t=a?a.time:0,k=B.phase;
 if(t<1.2){ttTurn(B,ttAngTo(B,P.x,P.z),.9*dt);const c=ttFwd(B,TT._v).multiplyScalar(C.reach).add(B.root.position);ai.center.copy(c);if(ai.warn)ai.warn.m.position.set(c.x,.05,c.z);if(ai.warn2)ai.warn2.m.position.set(c.x,.05,c.z);}
 if(!ai.flag.hit&&t>=1.58){ai.flag.hit=true;ttfxWarnOff(ai.warn);ttfxWarnOff(ai.warn2);ai.warn=ai.warn2=null;const c=ai.center;
  const dp=Math.hypot(P.x-c.x,P.z-c.z);
  if(dp<C.inner&&P.y<2.5)ttHurt(C.innerDmg*Math.min(ttArmMul(B,'L'),ttArmMul(B,'R'))+0,c);
  ttSpawnWave(c,C.maxR[k],C.speed*(1+k*.12),C.waveDmg);
  if(k>=2)setTimeout(()=>{if(TT.active&&!TT.B.dead)ttSpawnWave(c,C.maxR[k]*1.15,C.speed*1.25,C.waveDmg);},650);
  TTS.impact(c,1.2);TTS.quake(2);ttfxShake(1.6,.9);ttfxFlash(TT._v3.copy(c).setY(1),0xffa060,6,.3);
  ttfxDust(c,10,5,3.2,6);ttfxDebris(TT._v3.copy(c).setY(.5),26,11,.4,1.2);ttfxCrater(c,4.5);ttfxCrack(c,9,4,0xffa070);ttfxRing(c,1,C.inner*1.6,.5,0xffd0a0);
  ttPropsInCircle(c.x,c.z,C.inner+1).forEach(p=>ttPropDamage(p,1500,c));}
 if(a&&!a.isRunning()||ai.t>4)ttRecover(B,1);
}
function ttSpawnWave(c,maxR,speed,dmg){TT.waves.push({c:c.clone(),r:.5,maxR,speed,dmg,hit:false,i:TT.waves.length%3,t:0});ttfxRing(c,.5,maxR,maxR/speed,0xffb070,.8);}
function ttWavesUpdate(dt){
 const W=TITAN_CFG.smash.width;
 for(let i=TT.waves.length-1;i>=0;i--){const w=TT.waves[i];w.r+=w.speed*dt;w.t+=dt;const k=w.r/w.maxR;
  ttfxWall(w.i,w.c,w.r,1.8*(1-k)+.5,.75*(1-k));
  if(Math.random()<dt*25){const a=Math.random()*6.283;TT._v3.set(w.c.x+Math.cos(a)*w.r,.3,w.c.z+Math.sin(a)*w.r);ttfxDust(TT._v3,1,2.4,1.1,1);if(Math.random()<.4)ttfxDebris(TT._v3,1,5,.2,1);}
  if(!w.hit&&!P.dead){const dp=Math.hypot(P.x-w.c.x,P.z-w.c.z);if(Math.abs(dp-w.r)<W){
   if(ttPlayerGrounded()){w.hit=true;ttHurt(w.dmg,w.c);ttKnock(P.x-w.c.x,P.z-w.c.z,5);ttfxShake(.8,.4);msg('ATINGIDO PELA ONDA DE CHOQUE',1);}}
   else if(dp<w.r-W)w.hit=true;}
  for(const p of TTAR.props){if(!p.alive||!p.breakable||p.strong||p._wv===w)continue;const dp=Math.hypot(p.x-w.c.x,p.z-w.c.z);if(Math.abs(dp-w.r)<1.2){p._wv=w;ttPropDamage(p,p.kind==='rock'?400:180,w.c);}}
  if(w.r>=w.maxR){ttfxWall(w.i,w.c,0,0,0);TT.waves.splice(i,1);}
 }
}
/* ---------- 4) COLOSSUS CHARGE ---------- */
const TT_CHTEL={m:null};
function ttChargeTele(on,from,dir,len){
 if(!TT_CHTEL.m){const tex=ttCanvasTex(64,(g,s)=>{const gr=g.createLinearGradient(0,0,s,0);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.2,'rgba(255,255,255,.8)');gr.addColorStop(.5,'rgba(255,255,255,.35)');gr.addColorStop(.8,'rgba(255,255,255,.8)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);
   g.fillStyle='rgba(255,255,255,.9)';for(let y=0;y<s;y+=16){g.beginPath();g.moveTo(s*.3,y+12);g.lineTo(s*.5,y+2);g.lineTo(s*.7,y+12);g.lineTo(s*.62,y+12);g.lineTo(s*.5,y+6);g.lineTo(s*.38,y+12);g.fill();}});
  tex.wrapT=THREE.RepeatWrapping;const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:tex,color:0xff3a20,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-3}));
  m.rotation.order='YXZ';m.visible=false;TTFX.root.add(m);TT_CHTEL.m=m;}
 const m=TT_CHTEL.m;if(!on){m.visible=false;return;}
 m.visible=true;m.position.set(from.x+dir.x*len/2,.07,from.z+dir.z*len/2);m.rotation.set(-Math.PI/2,Math.atan2(dir.x,dir.z),0);m.scale.set(TITAN_CFG.radius*2,len,1);
 m.material.map.repeat.set(1,len/5);m.material.map.offset.y-=.03;m.material.opacity=.45+Math.sin(performance.now()*.02)*.25;
}
function ttChargeTeleOff(){if(TT_CHTEL.m)TT_CHTEL.m.visible=false;}
function ttCharge(B,dt,d){
 const C=TITAN_CFG.charge,ai=B.ai,k=B.phase;
 if(ai.sub===0){ /* preparação: abaixa o corpo e mira na posição prevista */
  const tg=ttPredict(C.windup*.6+d/C.speed*.5);const ang=ttAngTo(B,tg.x,tg.z);ttTurn(B,ang,3*dt);
  ai.dir=ttFwd(B,ai.dir||new THREE.Vector3());ttChargeTele(true,B.root.position,ai.dir,Math.min(48,d+10));
  if(Math.random()<dt*14)ttfxDust(TT._v3.copy(B.root.position).addScaledVector(ai.dir,-1.5).setY(.2),1,2.5,1.2,2);
  if(ai.t>=C.windup/(1+k*.15)){ai.sub=1;ai.t=0;ai.hitP=false;ai.spd=C.speed*(1+k*.08);B.anim.play('chargeRun',.15,1.3);TTS.roar(B.root.position,.7);msg('',.01);}
  return;}
 if(ai.sub===1){ /* corrida em linha reta */
  ttChargeTele(true,B.root.position,ai.dir,Math.max(6,ai.spd*(C.maxT-ai.t)));
  if(C.homing[k]>0){const want=ttAngTo(B,P.x,P.z);const cur=Math.atan2(ai.dir.x,ai.dir.z);const nd=cur+Math.max(-C.homing[k]*dt,Math.min(C.homing[k]*dt,ttWrap(want-cur)));ai.dir.set(Math.sin(nd),0,Math.cos(nd));}
  B.root.rotation.y=Math.atan2(ai.dir.x,ai.dir.z);B.tilt.rotation.x=.12;
  const step=ai.spd*dt,n=Math.max(1,Math.ceil(step/.6));
  for(let i=0;i<n;i++){
   const R=TITAN_CFG.radius,p=B.root.position,nx=p.x+ai.dir.x*step/n,nz=p.z+ai.dir.z*step/n;const c=ttBlockedAt(nx+ai.dir.x*.3,nz+ai.dir.z*.3,R);
   if(c){const pr=ttPropOf(c);
    if(c.wall||(c.strong)){ttChargeImpact(B,c,pr);return;}
    if(ttSmashCol(c,p)){ai.spd*=.85;ttfxShake(.6,.3);continue;}
    ttChargeImpact(B,c,pr);return;}
   p.x=nx;p.z=nz;
   if(!ai.hitP&&!P.dead){const dx=P.x-p.x,dz=P.z-p.z;if(Math.hypot(dx,dz)<R+PR+.6&&P.y<B.H*.5){ai.hitP=true;
     /* arremessa para o lado (perpendicular à investida) */
     const side=Math.sign(dx*ai.dir.z-dz*ai.dir.x)||1;ttHurt(C.dmg,p);ttKnock(ai.dir.z*side+ai.dir.x*.6,-ai.dir.x*side+ai.dir.z*.6,C.push);ttfxShake(1.4,.6);msg('ATROPELADO PELO TITÃ!',1.2);TTS.impact(p,.8);}}
  }
  if(Math.random()<dt*20)ttfxDust(TT._v3.copy(B.root.position).addScaledVector(ai.dir,-2).setY(.2),1,3,1.8,2.5);
  ttfxShake(Math.max(0,.5-d*.01),.15);
  if(ai.t>=C.maxT){ai.sub=2;ai.t=0;B.anim.play('idle',.4);}
  return;}
 if(ai.sub===2){ /* derrapagem e recuperação */
  B.tilt.rotation.x*=Math.exp(-6*dt);ai.spd*=Math.exp(-4*dt);const r=ttMove(B,ai.dir.x*ai.spd*dt,ai.dir.z*ai.spd*dt);if(Math.random()<dt*14)ttfxDust(TT._v3.copy(B.root.position).setY(.2),1,3,1.5,3);
  if(ai.t>.9){ttChargeTeleOff();B.tilt.rotation.x=0;ttRecover(B,1);}
 }
}
function ttChargeImpact(B,c,pr){
 const ai=B.ai,p=B.root.position,pt=TT._v3.copy(p).addScaledVector(ai.dir,TITAN_CFG.radius).setY(3);
 ttChargeTeleOff();B.tilt.rotation.x=0;
 TTS.impact(pt,1.3);TTS.stagger(pt);ttfxShake(2.0,1.1);ttfxFlash(pt,0xffc080,7,.35);ttfxDebris(pt,30,10,.5,1);ttfxDust(pt,9,5,3,4);
 if(pr&&pr.kind==='pillar')ttPropBreak(pr,p);
 /* obstáculo forte: o golem fica atordoado e expõe o núcleo */
 ttSet(B,'STAGGERED',0);B.anim.restart('stagger',.1);msg('O TITÃ SE CHOCOU! NÚCLEO EXPOSTO — ATIRE NO PEITO!',2.6);
 if(!P.dead&&Math.hypot(P.x-pt.x,P.z-pt.z)<4.5)ttHurt(15,pt);
}
/* ---------- STAGGER + EXPOSIÇÃO DO PONTO FRACO ---------- */
function ttStagger(B,dt){
 const ai=B.ai,C=TITAN_CFG;
 if(ai.sub===1){if(ai.t>C.headStagger.dur){ai.next=.3;ttSet(B,'RECOVER');}return;} /* atordoamento curto (cabeça) */
 if(ai.sub===0){if(ai.t>1.9){ai.sub=2;ai.t=0;B.anim.play('weakExpose',.35);B.exposed=C.exposeTime;TTS.alarm();if(typeof ttHudTag==='function')ttHudTag('NÚCLEO EXPOSTO',C.exposeTime);}return;}
 if(ai.sub===2){B.exposed=Math.max(B.exposed,.05);if(Math.random()<dt*20)ttfxSpark(B.anchors.core.getWorldPosition(TT._v3),1,0x7ffff0,2,.6,.3,-1);
  if(ai.t>C.exposeTime){ai.sub=3;ai.t=0;B.exposed=0;const a=B.anim.restart('awaken',.4,1.3);if(a)a.time=2.6;TTS.roar(B.root.position,.6);}return;}
 if(ai.sub===3){if(ai.t>1.1){ai.next=.2;ttSet(B,'RECOVER');}}
}
/* ---------- TRANSIÇÃO DE FASE ---------- */
function ttPhaseUpd(B,dt,d){
 const ai=B.ai;ttTurn(B,ttAngTo(B,P.x,P.z),dt);
 if(!ai.flag.wave&&ai.t>.9){ai.flag.wave=true;const c=B.root.position;ttfxRing(c,1,26,1.1,0x5ffff0,.9);ttfxRing(c,1,16,.8,0xffffff,.6);ttfxShake(1.5,1);ttfxFlash(TT._v3.copy(c).setY(5),0x5ffff0,8,.6);
  ttfxSpark(B.anchors.core.getWorldPosition(TT._v3),24,0x7ffff0,12,.9,.5,0);ttfxCrack(c,12,5,0x55ffe6);
  if(d<14&&!P.dead){ttKnock(P.x-c.x,P.z-c.z,10);if(d<7)ttHurt(10,c);}
  ttPropsInCircle(c.x,c.z,7).forEach(p=>ttPropDamage(p,600,c));}
 if(ai.t>2.7){ttSet(B,'ENRAGED');B.anim.play('idle',.3);ai.cd.melee=0;ai.cd.smash=Math.min(ai.cd.smash,1);}
}

/* ---------- 2) METEORIC ROCKFALL ---------- */
function ttMeteorPool(){
 if(TT.meteors.length)return;
 const geo=new THREE.DodecahedronGeometry(1.15,1);const p=geo.attributes.position;for(let i=0;i<p.count;i++){const s=.85+Math.random()*.3;p.setXYZ(i,p.getX(i)*s,p.getY(i)*s,p.getZ(i)*s);}geo.computeVertexNormals();
 const mat=TTFX.stoneMat.clone();if(mat.emissive){mat.emissive.setHex(0xff5a10);mat.emissiveIntensity=.6;mat.emissiveMap=null;}
 for(let i=0;i<16;i++){const m=new THREE.Mesh(geo,mat);m.castShadow=true;const f=new THREE.Sprite(new THREE.SpriteMaterial({map:TTFX.tex.glow,color:0xff8a30,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));f.scale.setScalar(4.5);m.add(f);
  m.visible=false;TTFX.root.add(m);TT.meteors.push({m,f,on:false,t:0,T:1,a:new THREE.Vector3(),b:new THREE.Vector3(),warn:null});}
}
function ttMeteorCast(B,dt){
 const C=TITAN_CFG.meteor,ai=B.ai,a=B.anim.cur,t=a?a.time:0,k=B.phase;
 ttTurn(B,ttAngTo(B,P.x,P.z),1.2*dt);
 if(t>.7&&t<1.7&&Math.random()<dt*30)ttfxSpark(B.anchors.handL.getWorldPosition(TT._v3),1,0xff9a40,4,.5,.4,-2);
 if(!ai.flag.v1&&t>=1.6){ai.flag.v1=true;ttMeteorVolley(B,C.count[k]);TTS.roar(B.root.position,.5);}
 if(C.volleys[k]>1&&!ai.flag.v2&&ai.t>=3.0){ai.flag.v2=true;ttMeteorVolley(B,Math.ceil(C.count[k]*.7));}
 if((a&&!a.isRunning()&&ai.t>(C.volleys[k]>1?3.2:0))||ai.t>5)ttRecover(B,1);
}
function ttMeteorVolley(B,n){
 ttMeteorPool();const C=TITAN_CFG.meteor,pts=[];
 const first=ttPredict(C.warn).clone();pts.push(first);
 let tries=0;while(pts.length<n&&tries++<120){
  const r=tries<60?C.spread*Math.sqrt(Math.random()):6+Math.random()*28,a=Math.random()*6.283,base=tries<60?first:TT._v3.set(0,0,0);
  const x=base.x+Math.cos(a)*r,z=base.z+Math.sin(a)*r;if(Math.hypot(x,z)>TITAN_CFG.arenaR-3)continue;
  if(pts.some(p=>Math.hypot(p.x-x,p.z-z)<C.radius*1.7))continue;   /* deixa espaços seguros entre os impactos */
  pts.push(new THREE.Vector3(x,0,z));}
 pts.forEach((pt,i)=>{const M=TT.meteors.find(m=>!m.on);if(!M)return;M.on=true;M.t=-(i===0?0:Math.random()*.9);M.T=C.warn;
  M.b.copy(pt);M.a.set(pt.x+(Math.random()-.5)*16,38+Math.random()*8,pt.z+(Math.random()-.5)*16);M.m.position.copy(M.a);M.m.visible=false;M.warn=null;M.snd=false;});
}
function ttMeteorsUpdate(dt){
 const C=TITAN_CFG.meteor;
 for(const M of TT.meteors){if(!M.on)continue;M.t+=dt;
  if(M.t<0)continue;
  if(!M.warn){M.warn=ttfxWarn(M.b,C.radius,M.T+.1,0xff2a10);}
  if(!M.snd&&M.t>M.T*.25){M.snd=true;TTS.meteorWhistle(M.b,M.T*.75);}
  const k=Math.min(1,M.t/M.T);M.m.visible=k>.05;
  M.m.position.lerpVectors(M.a,M.b,k*k);M.m.position.y=M.a.y*(1-k*k)+1.1*k*k;M.m.rotation.x+=dt*3;M.m.rotation.z+=dt*2;
  if(Math.random()<dt*30)ttfxDust(M.m.position,1,2.2,.9,.4,0x3a3028);
  if(k>=1){M.on=false;M.m.visible=false;ttfxWarnOff(M.warn);M.warn=null;ttMeteorImpact(M.b);}
 }
}
function ttMeteorImpact(p){
 const C=TITAN_CFG.meteor,R=C.radius;
 TTS.explosion(p,.85);ttfxShake(Math.max(.25,1.1-Math.hypot(P.x-p.x,P.z-p.z)*.03),.45);ttfxFlash(TT._v3.copy(p).setY(1.5),0xff8a30,5,.3);
 ttfxDebris(TT._v3.copy(p).setY(.6),14,9,.38,1.1);ttfxDust(p,5,4,2.6,2.5,0x6a5a48);ttfxSpark(TT._v3.copy(p).setY(.8),8,0xffa040,8,.5,.35);ttfxRing(p,.5,R*1.6,.45,0xffa060);ttfxCrater(p,R*.9);
 if(typeof gfxBoom==='function')gfxBoom(TT._v3.copy(p).setY(.3));
 const dp=Math.hypot(P.x-p.x,P.z-p.z);if(dp<R&&P.y<3&&!P.dead){ttHurt(C.dmg*(1-dp/R*.5),p);}
 ttPropsInCircle(p.x,p.z,R).forEach(pr=>ttPropDamage(pr,650,p));
}
/* ---------- 3) ROCK PRISON ---------- */
function ttPrisonPool(){
 if(TT.spikes)return;TT.spikes=[];
 for(let i=0;i<8;i++){const g=new THREE.CylinderGeometry(.18,.75,4.8,6,3);const p=g.attributes.position;for(let j=0;j<p.count;j++){const y=p.getY(j);p.setX(j,p.getX(j)*(.8+Math.random()*.45));p.setZ(j,p.getZ(j)*(.8+Math.random()*.45));p.setY(j,y);}g.computeVertexNormals();g.translate(0,2.4,0);
  const m=new THREE.Mesh(g,TTFX.stoneMat);m.castShadow=true;m.visible=false;TTFX.root.add(m);
  const col={x0:0,x1:0,z0:0,z1:0,top:4.6,bot:0,ttSpike:true};TT.spikes.push({m,col,a:i/8*Math.PI*2+Math.random()*.2,r:2});}
}
function ttPrisonCast(B,dt){
 const ai=B.ai,a=B.anim.cur,t=a?a.time:0;ttTurn(B,ttAngTo(B,P.x,P.z),1.5*dt);
 if(!ai.flag.warn&&t>=.6){ai.flag.warn=true;ai.flag.px=P.x;ai.flag.pz=P.z;TT._crack=ttfxCrack(TT._v3.set(P.x,0,P.z),3.2,2.2,0x55ffe6);ttfxSpark(TT._v3.set(P.x,.2,P.z),12,0x55ffe6,3,.6,.25,-2);TTS.crack(TT._v3,1);}
 if(TT._crack&&!ai.flag.cast)TT._crack.m.position.set(P.x,.045,P.z);
 if(!ai.flag.cast&&t>=1.05){ai.flag.cast=true;ttPrisonSpawn(B);}
 if(a&&!a.isRunning()||ai.t>3.4)ttRecover(B,1.1);
}
function ttPrisonSpawn(B){
 ttPrisonPool();const C=TITAN_CFG.prison,cx=P.x,cz=P.z;
 TT.prison={x:cx,z:cz,t:0,rise:0,prog:0,need:C.need[B.phase],time:C.time*(B.phase>=2?.9:1),done:false,lastJ:true,lastCD:P.dashCD};
 for(const s of TT.spikes){s.r=C.ring;s.m.visible=true;s.m.position.set(cx+Math.cos(s.a)*s.r,-4.8,cz+Math.sin(s.a)*s.r);s.m.rotation.set((Math.random()-.5)*.25,Math.random()*6,(Math.random()-.5)*.25);colliders.push(s.col);}
 ttPrisonCols();TTS.prisonForm(TT._v3.set(cx,0,cz));ttfxShake(.8,.5);ttfxDust(TT._v3,6,3,2,3);ttfxDebris(TT._v3.setY(.4),12,6,.25);
 msg('',.01);if(typeof ttHudPrison==='function')ttHudPrison(true,0);
}
function ttPrisonCols(){const pr=TT.prison;for(const s of TT.spikes){const x=pr.x+Math.cos(s.a)*s.r,z=pr.z+Math.sin(s.a)*s.r;s.m.position.x=x;s.m.position.z=z;
 const h=.55;s.col.x0=x-h;s.col.x1=x+h;s.col.z0=z-h;s.col.z1=z+h;}}
function ttPrisonUpdate(dt){
 const pr=TT.prison;if(!pr)return;const C=TITAN_CFG.prison;pr.t+=dt;
 pr.rise=Math.min(1,pr.t/.35);for(const s of TT.spikes){s.m.position.y=-4.8*(1-pr.rise*(2-pr.rise));}
 /* fecha progressivamente */
 const k=Math.min(1,pr.t/pr.time);for(const s of TT.spikes)s.r=C.ring-(C.ring-1.2)*k;ttPrisonCols();
 if(Math.random()<dt*10)ttfxSpark(TT._v3.set(pr.x+(Math.random()-.5)*3,.2,pr.z+(Math.random()-.5)*3),1,0x55ffe6,1.5,.8,.2,-2);
 /* fuga: apertar PULAR/ESPAÇO repetidamente; ESQUIVA vale mais */
 const j=!!(inp.jump||inp.keys.Space),dsh=P.dashCD>pr.lastCD+.3;pr.lastCD=P.dashCD;
 if(j&&!pr.lastJ){pr.prog+=1;TTS.crack(TT._v3.set(pr.x,1,pr.z),.6);ttfxShake(.15,.1);ttfxDebris(TT._v3,1,4,.15);}
 if(dsh&&!pr.lastD){pr.prog+=C.dashValue;TTS.crack(TT._v3.set(pr.x,1,pr.z),1);}
 pr.lastJ=j;
 /* mantém o jogador dentro (não sai por cima pulando) */
 if(P.y>.2)P.vy=Math.min(P.vy,0);
 if(typeof ttHudPrison==='function')ttHudPrison(true,pr.prog/pr.need,1-k);
 if(pr.prog>=pr.need){ttPrisonBreak(false);return;}
 if(pr.t>=pr.time){ttPrisonBreak(true);}
}
function ttPrisonBreak(crushed){
 const pr=TT.prison;if(!pr)return;const c=TT._v3.set(pr.x,1,pr.z);
 if(crushed){ttHurt(TITAN_CFG.prison.dmg,c);msg('ESMAGADO PELA PRISÃO DE ROCHA!',1.6);ttfxShake(1.2,.5);}else{msg('VOCÊ ESCAPOU DA PRISÃO!',1.4);}
 TTS.prisonBreak(c);ttfxDebris(c,26,8,.35,1);ttfxDust(c,6,3,2,3);ttfxSpark(c,14,0x55ffe6,6,.6,.3);
 ttPrisonClear(false);
}
function ttPrisonClear(silent){
 if(TT.spikes)for(const s of TT.spikes){s.m.visible=false;const i=colliders.indexOf(s.col);if(i>=0)colliders.splice(i,1);}
 TT.prison=null;if(typeof ttHudPrison==='function')ttHudPrison(false);
}
/* ---------- 5) ANCIENT ENERGY BEAM ---------- */
const TT_BEAM={g:null};
function ttBeamBuild(){
 if(TT_BEAM.g)return;const g=new THREE.Group();
 const geo=new THREE.CylinderGeometry(1,1,1,16,1,true);geo.rotateX(Math.PI/2);geo.translate(0,0,.5);
 const tex=TTFX.tex.beam;
 const core=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,color:0x9ff4ec,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
 const glow=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,color:0x2fe6d6,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
 const sight=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xff3a2a,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
 const hit=new THREE.Sprite(new THREE.SpriteMaterial({map:TTFX.tex.glow,color:0x9ffff8,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
 g.add(core,glow,sight,hit);g.visible=false;TTFX.root.add(g);
 const L=new THREE.PointLight(0x5ffff0,0,26,2);TTFX.root.add(L);
 Object.assign(TT_BEAM,{g,core,glow,sight,hit,L,end:new THREE.Vector3()});
}
function ttBeamOff(){if(TT_BEAM.g){TT_BEAM.g.visible=false;TT_BEAM.L.intensity=0;}ttaStop('beam');ttaStop('beamc');}
function ttBeamPose(from,to,mode,w){
 const B=TT_BEAM,len=from.distanceTo(to);B.g.visible=true;
 [B.core,B.glow,B.sight].forEach(m=>{m.position.copy(from);m.lookAt(to);});
 B.sight.visible=mode==='sight';B.core.visible=B.glow.visible=mode==='fire';
 if(mode==='sight'){B.sight.scale.set(.03,.03,Math.max(1,len-2.5));B.sight.material.opacity=.25+Math.random()*.3;B.hit.visible=true;B.hit.position.copy(to);B.hit.scale.setScalar(.6);B.hit.material.color.setHex(0xff4030);}
 else{const f=1+Math.sin(performance.now()*.05)*.12;B.core.scale.set(w*.32*f,w*.32*f,len);B.glow.scale.set(w*.8*f,w*.8*f,len);
  B.core.material.map.offset.y-=.08;B.hit.visible=true;B.hit.position.copy(to);const dc=to.distanceTo(cam.getWorldPosition(TT_V0));B.hit.scale.setScalar(5*f*Math.min(1,Math.max(.15,(dc-1.5)/8)));B.hit.material.color.setHex(0x9ffff8);B.L.position.copy(to).setY(Math.max(1,to.y));B.L.intensity=3.2*f;}
}
/* ponto onde o raio para: primeira superfície sólida ou o chão */
const _ttRay=new THREE.Raycaster();
function ttBeamTrace(from,aim,range){
 const dir=TT._v.copy(aim).sub(from).normalize();_ttRay.set(from,dir);_ttRay.far=range;
 const hits=_ttRay.intersectObjects(solids,false);let dist=range,obj=null;
 if(hits.length){dist=hits[0].distance;obj=hits[0].object;}
 if(dir.y<-.001){const tg=-from.y/dir.y;if(tg<dist){dist=tg;obj=null;}}
 return {end:from.clone().addScaledVector(dir,dist),obj,dir:dir.clone(),dist};
}
function ttBeam(B,dt){
 ttBeamBuild();const C=TITAN_CFG.beam,ai=B.ai,k=B.phase;
 const core=B.anchors.core.getWorldPosition(new THREE.Vector3());
 const tgt=ttPredict(ai.sub===0?.35:.15,TT._v2).setY(P.y+.9);
 const tr=C.track[k]*(ai.sub===0?1:.65);ai.aim.lerp(tgt,Math.min(1,tr*dt*2.2));
 ttTurn(B,ttAngTo(B,ai.aim.x,ai.aim.z),(ai.sub===0?1.2:.7)*dt);
 if(ai.sub===0){ /* carga: núcleo brilha cada vez mais, partículas convergem */
  const f=Math.min(1,ai.t/C.charge);B.coreK=1+f*7;ttaLoopSet('beamc',.12+f*.3,200+f*1600,80+f*300,B.root.position);
  if(Math.random()<dt*(10+f*40))ttfxPull(core,1,3+f*2,0x7ffff0);
  if(ai.t>C.charge*.35){const tr2=ttBeamTrace(core,ai.aim,C.range);ttBeamPose(core,tr2.end,'sight');}
  if(ai.t>=C.charge){ai.sub=1;ai.t=0;ai.tick=0;ai.fx=0;B.anim.play('beamFire',.12);ttaStop('beamc');TTS.impact(core,.6);
   ttaLoop('beam',{f:900,gain:.35,tone:110,wave:'sawtooth',toneGain:.2,type:'bandpass',q:.8,pos:core,ref:20});ttfxShake(.8,.4);}
  return;}
 if(ai.sub===1){ /* disparo contínuo, varrendo devagar */
  B.coreK=7+Math.random()*2;const tr2=ttBeamTrace(core,ai.aim,C.range);ttBeamPose(core,tr2.end,'fire',C.width*(1+k*.1));
  ttfxShake(.35,.1);ai.tick-=dt;ai.fx-=dt;
  if(ai.fx<=0){ai.fx=.09;ttfxSpark(tr2.end,3,0x9ffff8,9,.4,.35);ttfxDust(tr2.end,1,3,1.4,1.5,0x4a5a5a);if(Math.random()<.35){ttfxCrater(tr2.end,1.6);}if(Math.random()<.25){ttfxDebris(tr2.end,5,8,.25);TTS.explosion(tr2.end,.35);}}
  if(ai.tick<=0){ai.tick=C.tick;
   if(tr2.obj&&tr2.obj.userData.ttProp)ttPropDamage(tr2.obj.userData.ttProp,200,B.root.position);
   /* dano: distância do jogador ao segmento do raio */
   if(!P.dead){const pc=TT._v3.set(P.x,P.y+.9,P.z),ab=TT._v.copy(tr2.end).sub(core),L2=ab.lengthSq(),t=Math.max(0,Math.min(1,pc.clone().sub(core).dot(ab)/L2));
    const cl=core.clone().addScaledVector(ab,t);if(cl.distanceTo(pc)<C.width+PR+.25){ttHurt(C.dps*C.tick,core);}}}
  if(ai.t>=C.fire){ai.sub=2;ai.t=0;ttBeamOff();B.anim.play('weakExpose',.4);B.exposed=C.vent;msg('NÚCLEO SUPERAQUECIDO — ATIRE NO PEITO!',2);if(typeof ttHudTag==='function')ttHudTag('NÚCLEO EXPOSTO',C.vent);}
  return;}
 if(ai.sub===2){ /* resfriamento: núcleo exposto */
  B.coreK=Math.max(1,B.coreK-dt*3);B.exposed=Math.max(B.exposed,.05);if(Math.random()<dt*25)ttfxDust(TT._v3.copy(core),1,1.6,1,.6,0xb8c8c8);
  if(ai.t>=C.vent){B.exposed=0;const a=B.anim.restart('awaken',.4,1.4);if(a)a.time=2.6;ai.sub=3;ai.t=0;}return;}
 if(ai.sub===3&&ai.t>1){ttRecover(B,.8);}
}

/* ---------- MORTE ---------- */
function ttDefeat(){
 const B=TT.B;if(B.dead)return;B.dead=true;B.e.state='dead';ttInterrupt(B);ttPrisonClear(true);
 TT.meteors.forEach(m=>{if(m.on){m.on=false;m.m.visible=false;ttfxWarnOff(m.warn);}});TT.waves.length=0;ttfxWalls0();
 ttSet(B,'DEFEATED');B.anim.restart('death',.2,.85);B.deadT=0;TTS.death(B.root.position);ttaStopAll();
 TT.stats.t1=performance.now();alive=0;
 msg('O COLOSSO ESTÁ CAINDO!',3);if(typeof ttHudTag==='function')ttHudTag('DERROTADO',6);
}
function ttfxWalls0(){for(let i=0;i<3;i++)ttfxWall(i,TT._v3,0,0,0);}
function ttDeathUpd(B,dt){
 const ai=B.ai,core=B.anchors.core.getWorldPosition(TT._v3);
 /* núcleo instável: tremula, rachaduras pulsam, energia vaza */
 B.coreK=1+Math.random()*(2+ai.t*1.5);B.glowT=1+ai.t*.6+Math.random()*.6;
 if(Math.random()<dt*(8+ai.t*10))ttfxSpark(core,2,Math.random()<.5?0x7ffff0:0xffffff,6+ai.t*2,.6,.35,0);
 if(Math.random()<dt*3)TTS.crack(core,1.2);
 if(ai.t>2.6&&Math.random()<dt*6)ttfxDebris(core.clone(),2,4,.3,.5);
 if(!B.exploded&&ai.t>=4.4){B.exploded=true;B.holder.visible=false;B.coreGlow.visible=false;B.eyeGlow.visible=false;
  /* fragmentação: pedaços de pedra saindo de cada osso */
  for(const n of ['Hips','Spine01','Spine','Head','LeftArm','LeftForeArm','RightArm','RightForeArm','LeftUpLeg','LeftLeg','RightUpLeg','RightLeg']){
   ttfxDebris(B.bones[n].getWorldPosition(new THREE.Vector3()),6,9,.85,1.2);}
  TTS.explosion(core,1.4);TTS.impact(core,1.4);ttfxShake(2.4,1.4);ttfxFlash(core,0x9ffff8,12,1.2);ttfxRing(TT._v3.copy(B.root.position),1,30,1.4,0x5ffff0,.9);
  ttfxSpark(core,40,0x9ffff8,16,1.4,.6,1);ttfxDust(B.root.position,14,7,4.5,8);ttfxCrater(B.root.position,6);if(typeof gfxBoom==='function')gfxBoom(core.clone());
  B.coreLight.intensity=0;}
 if(B.exploded)B.coreK=0;
 if(ai.t>=7.2&&!ai.flag.end){ai.flag.end=true;if(typeof ttVictory==='function')ttVictory();}
}

/* ---------- VISUAL POR QUADRO (brilho, hitboxes, luz) ---------- */
const _ttA=new THREE.Vector3(),_ttB=new THREE.Vector3(),_ttD=new THREE.Vector3(),_ttR=new THREE.Vector3(),_ttF=new THREE.Vector3(),_ttS=new THREE.Vector3(),_ttMB=new THREE.Matrix4();
function ttBossVisual(dt){
 const B=TT.B;B.root.updateMatrixWorld(true);
 const S=B.S;
 for(const h of B.hit){h.a.getWorldPosition(_ttA);h.b.getWorldPosition(_ttB);_ttD.subVectors(_ttB,_ttA);if(h.ext!==1)_ttB.copy(_ttA).addScaledVector(_ttD,h.ext);
  _ttD.subVectors(_ttB,_ttA);const len=_ttD.length()||.01;_ttD.divideScalar(len);
  ttFwd(B,_ttF);_ttR.crossVectors(_ttD,_ttF);if(_ttR.lengthSq()<1e-4)_ttR.set(1,0,0);_ttR.normalize();_ttF.crossVectors(_ttR,_ttD).normalize();
  _ttMB.makeBasis(_ttR,_ttD,_ttF);h.m.quaternion.setFromRotationMatrix(_ttMB);
  h.m.position.addVectors(_ttA,_ttB).multiplyScalar(.5);h.m.scale.set(h.w*S,len,h.d*S);h.m.updateMatrixWorld(true);}
 B.anchors.head.getWorldPosition(B.headHB.position);B.headHB.scale.setScalar(.34*S);B.headHB.updateMatrixWorld(true);
 B.anchors.core.getWorldPosition(B.coreHB.position);B.coreHB.scale.setScalar(.22*S);B.coreHB.updateMatrixWorld(true);
 /* brilho das rachaduras por fase (+pulso na fase 3, + clarão ao ser atingido) */
 const base=[.3,1.0,1.8][B.phase];B.glowT=B.dead?B.glowT:base+(B.phase===2?Math.sin(performance.now()*.006)*.5:0)+(B.ai.state==='PHASE_TRANSITION'?2:0);
 B.glow+=(B.glowT-B.glow)*Math.min(1,dt*4);
 if(B.mask)B.mat.emissiveIntensity=Math.max(0,B.glow+B.hitFlash*8+(B.exposed>0?.6:0));
 if(B.phase===2&&!B.dead)B.mat.emissive.setHex(0x6ffff2);else B.mat.emissive.setHex(0x2fe6d6);
 /* núcleo */
 const ex=B.exposed>0,pulse=ex?(1+Math.sin(performance.now()*.018)*.5):1;
 if(!B.coreK||B.coreK<1)B.coreK=B.dead?B.coreK:1;
 B.coreLight.position.copy(B.coreHB.position);B.coreLight.intensity=B.dead&&B.exploded?0:(.8+B.phase*.7)*(B.coreK||1)*pulse;
 B.coreGlow.position.copy(B.coreHB.position);B.coreGlow.scale.setScalar(S*(.55+.12*B.phase)*Math.sqrt(B.coreK||1)*pulse);B.coreGlow.material.opacity=ex?1:.75;
 B.coreGlow.material.color.setHex(ex?0xbffffa:0x5ffff0);
 B.anchors.eye.getWorldPosition(B.eyeGlow.position);B.eyeGlow.scale.set(S*(.5+B.phase*.2),S*(.2+B.phase*.06),1);B.eyeGlow.material.opacity=.45+B.phase*.25;
 /* aura de energia nas fases 2 e 3 */
 if(B.phase>0&&!B.dead){B.auraT-=dt;if(B.auraT<=0){B.auraT=B.phase===2?.06:.14;const bn=B.hit[(Math.random()*B.hit.length)|0].m.position;ttfxSpark(bn,1,B.phase===2?0x9ffff8:0x5ffff0,1.5,1,.25,-2.5);}}
}
