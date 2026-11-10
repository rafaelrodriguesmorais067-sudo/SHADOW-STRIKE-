"use strict";
/* VEGETAÇÃO: vento global, árvores, grama instanciada, partículas e reações a movimento/explosões */

const VEG={
 trees:[],
 grass:null,       // InstancedMesh
 grassBase:[],     // {x,y,z,sx,sy,sz,rx,ry,rz,phase}
 grassN:0,
 windDir:0,        // radianos
 windStr:.25,
 windT:0,
 gust:0,
 leaves:null,
 leafArr:null,
 leafN:0,
 dust:null,
 dustArr:null,
 _m:new THREE.Matrix4(),
 _p:new THREE.Vector3(),
 _s:new THREE.Vector3(),
 _q:new THREE.Quaternion(),
 _e:new THREE.Euler(),
 _o:new THREE.Object3D(),
 impulse:[],       // {x,z,force,t}
 ready:false
};

function vegQ(){
 const q=typeof curQ==='function'?curQ():1;
 return [0.35,0.55,0.8,1][Math.max(0,Math.min(3,q))];
}

function vegRegisterTree(tree){
 if(!tree)return;
 tree.userData=tree.userData||{};
 tree.userData.veg={
  baseRx:tree.rotation.x||0,
  baseRy:tree.rotation.y||0,
  baseRz:tree.rotation.z||0,
  phase:Math.random()*6.28,
  flex:.7+Math.random()*.6,
  impulse:0
 };
 VEG.trees.push(tree);
}

function vegRegisterGrass(mesh,count){
 if(!mesh||!count)return;
 VEG.grass=mesh;
 VEG.grassN=count;
 VEG.grassBase=[];
 const m=new THREE.Matrix4(),p=new THREE.Vector3(),s=new THREE.Vector3(),q=new THREE.Quaternion(),e=new THREE.Euler();
 for(let i=0;i<count;i++){
  mesh.getMatrixAt(i,m);
  m.decompose(p,q,s);
  e.setFromQuaternion(q);
  VEG.grassBase.push({
   x:p.x,y:p.y,z:p.z,
   sx:s.x,sy:s.y,sz:s.z,
   rx:e.x,ry:e.y,rz:e.z,
   phase:Math.random()*6.28,
   impulse:0
  });
 }
}

function vegInitParticles(){
 if(VEG.leaves)return;
 const nL=Math.floor(40*vegQ());
 if(nL>0){
  const pos=new Float32Array(nL*3);
  for(let i=0;i<nL;i++){
   pos[i*3]=(Math.random()-.5)*60;
   pos[i*3+1]=2+Math.random()*8;
   pos[i*3+2]=(Math.random()-.5)*60;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  VEG.leaves=new THREE.Points(geo,new THREE.PointsMaterial({
   color:0x8a9a40,size:.25,transparent:true,opacity:.7,depthWrite:false
  }));
  VEG.leaves.frustumCulled=false;
  VEG.leaves.visible=false;
  scene.add(VEG.leaves);
  VEG.leafArr=pos;VEG.leafN=nL;
 }
 const nD=Math.floor(25*vegQ());
 if(nD>0){
  const pos=new Float32Array(nD*3);
  for(let i=0;i<nD;i++){
   pos[i*3]=(Math.random()-.5)*30;
   pos[i*3+1]=Math.random()*1.5;
   pos[i*3+2]=(Math.random()-.5)*30;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  VEG.dust=new THREE.Points(geo,new THREE.PointsMaterial({
   color:0xc2b280,size:.15,transparent:true,opacity:.35,depthWrite:false
  }));
  VEG.dust.frustumCulled=false;
  VEG.dust.visible=false;
  scene.add(VEG.dust);
  VEG.dustArr=pos;
 }
 VEG.ready=true;
}

function vegImpulse(x,z,force){
 VEG.impulse.push({x,z,force,t:.8});
 // trees nearby
 for(const t of VEG.trees){
  const d=Math.hypot(t.position.x-x,t.position.z-z);
  if(d<12)t.userData.veg.impulse=Math.max(t.userData.veg.impulse||0,force*(1-d/12));
 }
 // grass nearby (only if we have base data)
 if(VEG.grassBase.length){
  for(let i=0;i<VEG.grassBase.length;i++){
   const g=VEG.grassBase[i];
   const d=Math.hypot(g.x-x,g.z-z);
   if(d<6)g.impulse=Math.max(g.impulse,force*(1-d/6));
  }
 }
}

function vegUpdateWind(dt){
 VEG.windT+=dt;
 // direção muda devagar
 VEG.windDir+=Math.sin(VEG.windT*.11)*.15*dt;
 let base=.2;
 if(typeof ENV!=='undefined'){
  if(ENV.weather==='storm')base=1.15;
  else if(ENV.weather==='rain')base=.55;
  else if(ENV.weather==='fog')base=.15;
  else base=.25;
 }
 // rajadas
 VEG.gust+=(Math.sin(VEG.windT*1.7)*Math.sin(VEG.windT*.4)-VEG.gust)*dt*1.5;
 VEG.windStr=base+VEG.gust*.35;
 // sync ENV.wind used by rain
 if(typeof ENV!=='undefined')ENV.wind=VEG.windStr*Math.sin(VEG.windDir);
}

function vegUpdateTrees(dt){
 if(!VEG.trees.length)return;
 const str=VEG.windStr*vegQ();
 const wx=Math.sin(VEG.windDir),wz=Math.cos(VEG.windDir);
 // LOD: full update near player
 const px=typeof P!=='undefined'?P.x:0,pz=typeof P!=='undefined'?P.z:0;
 for(let i=0;i<VEG.trees.length;i++){
  const t=VEG.trees[i],v=t.userData.veg;
  if(!v)continue;
  const dist=Math.hypot(t.position.x-px,t.position.z-pz);
  if(dist>70){ // far: freeze subtle
   t.rotation.x=v.baseRx;
   t.rotation.z=v.baseRz;
   continue;
  }
  const freq=1.1+v.phase*.05;
  const sway=str*v.flex*(dist>40?.5:1);
  const sx=Math.sin(VEG.windT*freq+v.phase)*sway*.06;
  const sz=Math.cos(VEG.windT*freq*.85+v.phase)*sway*.04;
  // impulso (explosão / passagem)
  if(v.impulse>0){
   v.impulse=Math.max(0,v.impulse-dt*1.8);
  }
  const imp=v.impulse*.12;
  t.rotation.x=v.baseRx+sz*wz+imp*(.5+Math.sin(VEG.windT*8+v.phase)*.5);
  t.rotation.z=v.baseRz+sx*wx+imp*(.5+Math.cos(VEG.windT*7+v.phase)*.5);
 }
}

function vegUpdateGrass(dt){
 if(!VEG.grass||!VEG.grassBase.length)return;
 const str=VEG.windStr*vegQ();
 const px=typeof P!=='undefined'?P.x:0,pz=typeof P!=='undefined'?P.z:0;
 const o=VEG._o;
 let updated=false;
 // only animate subset near player for perf (or all if few)
 const maxDist=28;
 for(let i=0;i<VEG.grassN;i++){
  const g=VEG.grassBase[i];
  const dx=g.x-px,dz=g.z-pz,d2=dx*dx+dz*dz;
  if(d2>maxDist*maxDist){
   // reset far grass occasionally not needed
   continue;
  }
  const d=Math.sqrt(d2);
  let bendX=Math.sin(VEG.windT*2.2+g.phase)*str*.35;
  let bendZ=Math.cos(VEG.windT*1.9+g.phase*.8)*str*.28;
  // player/enemy walk-through
  if(d<1.4){
   const push=(1.4-d)/1.4;
   bendX+=dx/(d+.01)*push*.9;
   bendZ+=dz/(d+.01)*push*.9;
  }
  if(g.impulse>0){
   bendX+=g.impulse*(Math.random()-.5);
   bendZ+=g.impulse*(Math.random()-.5);
   g.impulse=Math.max(0,g.impulse-dt*2.5);
  }
  o.position.set(g.x,g.y,g.z);
  o.scale.set(g.sx,g.sy,g.sz);
  o.rotation.set(g.rx+bendX,g.ry,g.rz+bendZ);
  o.updateMatrix();
  VEG.grass.setMatrixAt(i,o.matrix);
  updated=true;
 }
 // also soft interaction with nearby enemies (cheap, few)
 if(typeof enemies!=='undefined'){
  for(const e of enemies){
   if(e.state==='dead')continue;
   const ex=e.pos.x,ez=e.pos.z;
   if(Math.hypot(ex-px,ez-pz)>25)continue;
   for(let i=0;i<VEG.grassN;i++){
    const g=VEG.grassBase[i];
    const d=Math.hypot(g.x-ex,g.z-ez);
    if(d<1.2)g.impulse=Math.max(g.impulse,.6*(1.2-d));
   }
  }
 }
 if(updated)VEG.grass.instanceMatrix.needsUpdate=true;
}

function vegUpdateParticles(dt){
 if(!VEG.ready)vegInitParticles();
 const storm=typeof ENV!=='undefined'&&ENV.weather==='storm';
 const windy=VEG.windStr>.45||storm;
 // leaves
 if(VEG.leaves&&VEG.leafArr){
  VEG.leaves.visible=windy&&vegQ()>.4;
  if(VEG.leaves.visible){
   const px=P.x,pz=P.z;
   VEG.leaves.position.set(px,0,pz);
   const arr=VEG.leafArr;
   const wx=Math.sin(VEG.windDir)*VEG.windStr*4;
   const wz=Math.cos(VEG.windDir)*VEG.windStr*4;
   for(let i=0;i<VEG.leafN;i++){
    arr[i*3]+=wx*dt*(.5+Math.random());
    arr[i*3+1]-=(.4+VEG.windStr*.5)*dt;
    arr[i*3+2]+=wz*dt*(.5+Math.random());
    if(arr[i*3+1]<0){
     arr[i*3]=(Math.random()-.5)*50;
     arr[i*3+1]=3+Math.random()*10;
     arr[i*3+2]=(Math.random()-.5)*50;
    }
   }
   VEG.leaves.geometry.attributes.position.needsUpdate=true;
  }
 }
 // dust dry
 if(VEG.dust&&VEG.dustArr){
  const dry=typeof ENV==='undefined'||ENV.weather==='clear'||ENV.weather==='fog';
  VEG.dust.visible=dry&&VEG.windStr>.35&&vegQ()>.5;
  if(VEG.dust.visible){
   VEG.dust.position.set(P.x,0,P.z);
   const arr=VEG.dustArr;
   for(let i=0;i<arr.length/3;i++){
    arr[i*3]+=Math.sin(VEG.windDir)*VEG.windStr*2*dt;
    arr[i*3+2]+=Math.cos(VEG.windDir)*VEG.windStr*2*dt;
    arr[i*3+1]+=Math.sin(VEG.windT*3+i)*.2*dt;
    if(Math.abs(arr[i*3])>20||Math.abs(arr[i*3+2])>20){
     arr[i*3]=(Math.random()-.5)*20;
     arr[i*3+1]=Math.random();
     arr[i*3+2]=(Math.random()-.5)*20;
    }
   }
   VEG.dust.geometry.attributes.position.needsUpdate=true;
  }
 }
 // decay impulses list
 for(let i=VEG.impulse.length-1;i>=0;i--){
  VEG.impulse[i].t-=dt;
  if(VEG.impulse[i].t<=0)VEG.impulse.splice(i,1);
 }
}

function vegUpdate(dt){
 if(typeof state!=='undefined'&&state!=='play')return;
 // collect trees once if immersion didn't
 if(!VEG.trees.length&&typeof world!=='undefined'){
  world.children.forEach(c=>{
   if((c.isGroup||(c.children&&c.children.length>1))&&c.position&&(Math.abs(c.position.x)>3||Math.abs(c.position.z)>3)){
    if(!c.userData||!c.userData.veg)vegRegisterTree(c);
   }
  });
 }
 vegUpdateWind(dt);
 vegUpdateTrees(dt);
 vegUpdateGrass(dt);
 vegUpdateParticles(dt);
}

/* Hook para explosões */
function vegOnExplosion(pos,force){
 if(!pos)return;
 vegImpulse(pos.x,pos.z,force||1.5);
}

/* Passagem do player gera impulso local leve */
function vegPlayerTrample(dt){
 if(typeof P==='undefined'||typeof MV==='undefined')return;
 if(MV.hs<1.5)return;
 if(!VEG.grassBase.length)return;
 // cheap: only impulse flags, applied in grass update
 for(let i=0;i<VEG.grassN;i++){
  const g=VEG.grassBase[i];
  const d=Math.hypot(g.x-P.x,g.z-P.z);
  if(d<1.5)g.impulse=Math.max(g.impulse,.8*(1.5-d)/1.5);
 }
}
