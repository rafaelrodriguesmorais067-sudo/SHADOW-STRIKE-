"use strict";
/* SWAT: personagem animado (GLB do Quaternius, embutido em swatdata.js).
   Carregador mínimo de GLB feito à mão para o THREE r128 puro (sem GLTFLoader, sem internet extra):
   lê a malha, o esqueleto (62 ossos), as animações e monta uma instância por inimigo.
   Geometria, clipes e materiais são compartilhados; cada inimigo tem seu próprio esqueleto e mixer. */
const SWAT={D:null,mats:{},SC:1};   /* SC: escala do modelo (tamanho natural: ~1,81 m com capacete) */

/* cores (linear) por tipo: índice do material GLB -> [r,g,b]. Material 0 = armadura, 1 = detalhes pretos */
const SWAT_VAR={
 std:{0:[.10,.11,.13]},
 heavy:{0:[.17,.03,.025],1:[.03,.02,.02]},
 scout:{0:[.22,.15,.07],1:[.07,.05,.03]}
};

const swatName=n=>String(n).replace(/\s/g,'_').replace(/[\[\]\.:\/]/g,'');

function swatLoad(){
 if(SWAT.D)return SWAT.D;
 const bin=atob(SWAT_B64),n=bin.length,u8=new Uint8Array(n);
 for(let i=0;i<n;i++)u8[i]=bin.charCodeAt(i);
 const dv=new DataView(u8.buffer);
 if(dv.getUint32(0,true)!==0x46546C67)throw new Error('GLB inválido');
 const jl=dv.getUint32(12,true);
 let js='';for(let i=0;i<jl;i+=8192)js+=String.fromCharCode.apply(null,u8.subarray(20+i,20+Math.min(jl,i+8192)));
 const J=JSON.parse(js);
 const bo=20+jl,bl=dv.getUint32(bo,true),buf=u8.buffer.slice(bo+8,bo+8+bl);
 const CT={5126:Float32Array,5123:Uint16Array,5121:Uint8Array,5125:Uint32Array};
 const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
 function acc(i){
  const a=J.accessors[i],bv=J.bufferViews[a.bufferView],C=CT[a.componentType],nc=NC[a.type],es=C.BYTES_PER_ELEMENT;
  const off=(bv.byteOffset||0)+(a.byteOffset||0);
  if(bv.byteStride&&bv.byteStride!==nc*es){   /* dados intercalados */
   const out=new C(a.count*nc),dv2=new DataView(buf);
   for(let k=0;k<a.count;k++)for(let c=0;c<nc;c++){
    const p=off+k*bv.byteStride+c*es;
    out[k*nc+c]=C===Float32Array?dv2.getFloat32(p,true):C===Uint16Array?dv2.getUint16(p,true):C===Uint32Array?dv2.getUint32(p,true):dv2.getUint8(p);
   }
   return out;
  }
  return off%es===0?new C(buf,off,a.count*nc):new C(buf.slice(off,off+a.count*nc*es));
 }
 /* geometrias (uma por primitiva) */
 const geos=J.meshes.map(m=>m.primitives.map(p=>{
  const A=p.attributes,g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(acc(A.POSITION),3));
  g.setAttribute('normal',new THREE.BufferAttribute(acc(A.NORMAL),3));
  g.setAttribute('skinIndex',new THREE.BufferAttribute(acc(A.JOINTS_0),4));
  const w=Float32Array.from(acc(A.WEIGHTS_0));
  for(let i=0;i<w.length;i+=4){const s=w[i]+w[i+1]+w[i+2]+w[i+3];if(s>0){const k=1/s;w[i]*=k;w[i+1]*=k;w[i+2]*=k;w[i+3]*=k;}}
  g.setAttribute('skinWeight',new THREE.BufferAttribute(w,4));
  g.setIndex(new THREE.BufferAttribute(acc(p.indices),1));
  return g;
 }));
 /* clipes de animação: nomes "Run", "Idle_Gun", "Death"... (sem o prefixo "CharacterArmature|") */
 const clips={};
 for(const a of J.animations){
  const tr=[];
  for(const ch of a.channels){
   const s=a.samplers[ch.sampler],t=ch.target,nm=swatName(J.nodes[t.node].name);
   if(t.path==='rotation')tr.push(new THREE.QuaternionKeyframeTrack(nm+'.quaternion',acc(s.input),acc(s.output)));
   else if(t.path==='translation')tr.push(new THREE.VectorKeyframeTrack(nm+'.position',acc(s.input),acc(s.output)));
   else if(t.path==='scale')tr.push(new THREE.VectorKeyframeTrack(nm+'.scale',acc(s.input),acc(s.output)));
  }
  const cn=a.name.replace(/^.*\|/,'');
  clips[cn]=new THREE.AnimationClip(cn,-1,tr);
 }
 /* matrizes inversas do bind e conjunto de ossos */
 const sk=J.skins[0],ibm=acc(sk.inverseBindMatrices),inv=[];
 for(let i=0;i<sk.joints.length;i++)inv.push(new THREE.Matrix4().fromArray(ibm,i*16));
 const byName={};J.nodes.forEach((n,i)=>{byName[n.name]=i;});
 return SWAT.D={J,geos,clips,inv,joints:sk.joints,jointSet:new Set(sk.joints),byName};
}

/* Material compartilhado por tipo e índice. Baixa qualidade usa Lambert (mais leve). */
function swatMat(variant,idx){
 const key=variant+'_'+idx;if(SWAT.mats[key])return SWAT.mats[key];
 const D=swatLoad(),gm=D.J.materials[idx]||D.J.materials[0],pm=gm.pbrMetallicRoughness||{};
 const c=(SWAT_VAR[variant]&&SWAT_VAR[variant][idx])||pm.baseColorFactor||[.1,.1,.1];
 const col=new THREE.Color().setRGB(c[0],c[1],c[2]);
 const m=(typeof QI!=='undefined'&&QI===0)?new THREE.MeshLambertMaterial({color:col}):new THREE.MeshStandardMaterial({color:col,roughness:.55,metalness:.15});
 m.skinning=true;   /* necessário no r128 (ignorado nas versões novas) */
 return SWAT.mats[key]=m;
}

/* Cria uma instância animada. Retorna {body,root,mixer,b,play,once,death,...}.
   body já vem virado para -Z (frente do jogo) e na escala certa. */
function swatMake(variant){
 const D=swatLoad(),J=D.J;
 const objs=J.nodes.map((n,i)=>{
  const o=D.jointSet.has(i)?new THREE.Bone():new THREE.Group();
  o.name=swatName(n.name||('n'+i));
  if(n.translation)o.position.fromArray(n.translation);
  if(n.rotation)o.quaternion.fromArray(n.rotation);
  if(n.scale)o.scale.fromArray(n.scale);
  return o;
 });
 J.nodes.forEach((n,i)=>{(n.children||[]).forEach(c=>objs[i].add(objs[c]));});
 const root=objs[J.scenes[J.scene||0].nodes[0]];
 /* malhas com pele */
 const skinned=[];
 J.nodes.forEach((n,i)=>{
  if(n.mesh===undefined)return;
  J.meshes[n.mesh].primitives.forEach((p,k)=>{
   const sm=new THREE.SkinnedMesh(D.geos[n.mesh][k],swatMat(variant,p.material||0));
   sm.frustumCulled=false;sm.castShadow=true;sm.name=(J.meshes[n.mesh].name||'mesh')+k;
   objs[i].add(sm);skinned.push(sm);
  });
 });
 /* esqueleto compartilhado pelas 4 malhas. Pela especificação glTF a matriz do nó da malha é ignorada na pele,
    então o bind usa matriz identidade (o modo 'attached' do SkinnedMesh cancela o resto). */
 const skel=new THREE.Skeleton(D.joints.map(i=>objs[i]),D.inv.map(m=>m.clone()));
 root.updateMatrixWorld(true);
 skinned.forEach(sm=>sm.bind(skel,new THREE.Matrix4()));
 const body=new THREE.Group();body.add(root);body.rotation.y=Math.PI;body.scale.setScalar(SWAT.SC);
 const B=n=>objs[D.byName[n]];
 const mixer=new THREE.AnimationMixer(root);
 const sw={body,root,mixer,skel,variant,cur:null,curName:'',lockT:0,flinchCd:0,
  b:{uaR:B('UpperArm.R'),laR:B('LowerArm.R'),wR:B('Wrist.R'),uaL:B('UpperArm.L'),laL:B('LowerArm.L'),wL:B('Wrist.L'),chest:B('Chest'),head:B('Head')}};
 const acts={};
 const act=name=>{
  if(!acts[name]){
   const a=mixer.clipAction(D.clips[name]);
   if(name==='Death'||name.indexOf('HitRecieve')===0){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=(name==='Death');}
   acts[name]=a;
  }
  return acts[name];
 };
 /* toca uma animação em loop (com transição suave); só troca se for outra */
 sw.play=(name,fade,ts,force)=>{
  const a=act(name);
  if(sw.cur!==a||force){
   a.reset();a.setEffectiveWeight(1);a.play();
   if(sw.cur&&sw.cur!==a)sw.cur.crossFadeTo(a,fade||.2,false);
   sw.cur=a;sw.curName=name;
  }
  a.setEffectiveTimeScale(ts||1);
 };
 /* animação de uma vez só (reação a tiro): bloqueia a locomoção por 'lock' segundos */
 sw.once=(name,lock)=>{sw.play(name,.06,1,true);sw.lockT=lock;};
 sw.death=()=>{sw.lockT=99;sw.play('Death',.1,1);};
 return sw;
}
SWAT.make=swatMake;SWAT.load=swatLoad;

/* IK: gira um osso para que a direção 'from' (mundo) passe a apontar para 'to' (mundo) */
const _swk={q1:new THREE.Quaternion(),q2:new THREE.Quaternion()};
function swatAim(bone,from,to){
 _swk.q1.setFromUnitVectors(from,to);
 bone.getWorldQuaternion(_swk.q2);
 _swk.q2.premultiply(_swk.q1);
 if(bone.parent){bone.parent.getWorldQuaternion(_swk.q1);_swk.q1.conjugate();_swk.q2.premultiply(_swk.q1);}
 bone.quaternion.copy(_swk.q2);
 bone.updateMatrixWorld(true);
}
const _swS=new THREE.Vector3(),_swE=new THREE.Vector3(),_swW=new THREE.Vector3(),_swu=new THREE.Vector3(),_swp=new THREE.Vector3(),_swel=new THREE.Vector3(),_swd1=new THREE.Vector3(),_swd2=new THREE.Vector3(),_swhd=new THREE.Vector3();
/* IK de dois ossos (ombro-cotovelo-mão) em espaço de mundo. side: +1 braço direito, -1 esquerdo. gq: rotação do corpo. */
function swatArmIK(up,lo,wr,T,side,gq){
 up.getWorldPosition(_swS);lo.getWorldPosition(_swE);wr.getWorldPosition(_swW);
 const L1=_swS.distanceTo(_swE),L2=_swE.distanceTo(_swW);if(L1<1e-4||L2<1e-4)return;
 _swu.subVectors(T,_swS);let d=_swu.length();
 d=Math.min(L1+L2-.002,Math.max(Math.abs(L1-L2)+.002,d));_swu.normalize();
 const c=(L1*L1+d*d-L2*L2)/(2*L1*d),a=Math.acos(Math.max(-1,Math.min(1,c)));
 /* polo: cotovelo para baixo e para fora, perpendicular ao eixo ombro-mão */
 _swp.set(side*.35,-1,.25).applyQuaternion(gq);_swp.addScaledVector(_swu,-_swp.dot(_swu)).normalize();
 _swel.copy(_swS).addScaledVector(_swu,L1*Math.cos(a)).addScaledVector(_swp,L1*Math.sin(a));
 _swd1.subVectors(_swE,_swS).normalize();_swd2.subVectors(_swel,_swS).normalize();swatAim(up,_swd1,_swd2);
 lo.getWorldPosition(_swE);wr.getWorldPosition(_swW);
 _swd1.subVectors(_swW,_swE).normalize();
 _swhd.copy(_swS).addScaledVector(_swu,d);_swd2.subVectors(_swhd,_swE).normalize();swatAim(lo,_swd1,_swd2);
}
