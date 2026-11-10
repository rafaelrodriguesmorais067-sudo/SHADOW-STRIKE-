"use strict";
/* WEAPON PACK: modelos GLB (Low Poly Weapons Pack) que substituem as armas antigas.
   Cada modelo é centralizado, alinhado com o cano para -Z e escalado para o comprimento pedido. */
const WPACK={
 files:{rifle:'models/weapons/rifle.glb',pistol:'models/weapons/pistol.glb',shotgun:'models/weapons/shotgun.glb',carabina:'models/weapons/carabina.glb',sniper:'models/weapons/sniper.glb',bazooka:'models/weapons/bazooka.glb'},
 flip:{rifle:true,pistol:false,shotgun:false,carabina:false,sniper:false,bazooka:false},
 size:{pistol:.7}, /* ajuste fino de tamanho por modelo */ /* true = gira 180° se o cano apontar para trás */
 cache:{},
 load(name){
  if(!this.cache[name])this.cache[name]=new Promise((res,rej)=>{
   new THREE.GLTFLoader().load(this.files[name],g=>{
    const root=g.scene;
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;const m=o.material;if(m){m.side=THREE.FrontSide;if('metalness' in m){m.metalness=Math.min(m.metalness,.5);m.roughness=Math.max(m.roughness,.45);}}}});
    res(root);
   },undefined,rej);
  });
  return this.cache[name];
 },
 /* Anexa o modelo ao grupo; len = comprimento final (unidades do jogo), zCenter = centro em Z. */
 attach(group,name,len,zCenter,onReady){
  this.load(name).then(src=>{
   const m=src.clone(true);
   const wrap=new THREE.Group();wrap.add(m);
   if(this.flip[name])m.rotation.y=Math.PI;
   const box=new THREE.Box3().setFromObject(wrap),size=new THREE.Vector3(),c=new THREE.Vector3();
   box.getSize(size);box.getCenter(c);
   m.position.sub(c);
   const s=len*(this.size[name]||1)/Math.max(.001,size.z);
   const out=new THREE.Group();out.add(wrap);out.scale.setScalar(s);out.position.z=zCenter||0;
   out.userData.wpack=true;
   group.add(out);
   if(onReady)onReady(out);
  }).catch(e=>console.warn('weapon pack',name,e));
 }
};
