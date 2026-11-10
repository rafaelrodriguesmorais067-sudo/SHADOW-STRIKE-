"use strict";
/* WEAPONS: armas, modelo na mão, tiro, recarga e explosões */
const WEAPONS=[
 {name:'FUZIL DE ASSALTO',dmg:22,rate:.095,mag:30,res:150,reload:1.85,spread:.014,recoil:.022,range:95,auto:true,pel:1,snd:'shot',col:0x333b2e,len:.8,model:'rifle'},
 {name:'PISTOLA',dmg:28,rate:.22,mag:12,res:72,reload:1.15,spread:.008,recoil:.032,range:55,auto:false,pel:1,snd:'pistol',col:0x2a2a2a,len:.35},
 {name:'ESCOPETA',dmg:12,rate:.9,mag:6,res:36,reload:2.5,spread:.07,recoil:.09,range:26,auto:false,pel:9,snd:'shotgun',col:0x4a3a2a,len:.6},
 {name:'CARABINA',dmg:36,rate:.34,mag:10,res:60,reload:2.05,spread:.007,recoil:.048,range:130,auto:false,pel:1,snd:'shot',col:0x2e3a2a,len:.9,model:'carabina'},
 {name:'FUZIL DE PRECISÃO',dmg:95,rate:1.15,mag:5,res:25,reload:2.7,spread:.0015,recoil:.13,range:220,auto:false,pel:1,snd:'sniper',col:0x2a2a2a,len:1.2,model:'sniper'}];
const ws=WEAPONS.map(w=>({mag:w.mag,res:w.res}));
let cw=0,lastShot=0,reloading=0,aim=false,fireHeld=false,flashT=0,kick=0;
const tmpV=new THREE.Vector3(),dir=new THREE.Vector3();

const gun=new THREE.Group();cam.add(gun);
const gunBody=new THREE.Mesh(new THREE.BoxGeometry(.06,.08,.5),M(0x333b2e));gun.add(gunBody);
/* Componentes adicionais do viewmodel: polímero, cano, trilho e controles mecânicos */
const gunMetal=new THREE.MeshStandardMaterial({color:0x252a28,metalness:.72,roughness:.36});
const gunPoly=new THREE.MeshStandardMaterial({color:0x343a30,metalness:.08,roughness:.82});
const gunBarrel=new THREE.Mesh(new THREE.CylinderGeometry(.018,.022,.42,10),gunMetal);
gunBarrel.rotation.x=Math.PI/2;gunBarrel.position.set(0,.005,-.36);gun.add(gunBarrel);
const handguard=new THREE.Mesh(new THREE.BoxGeometry(.085,.075,.24),gunPoly);handguard.position.set(0,.005,-.12);gun.add(handguard);
const receiverTop=new THREE.Mesh(new THREE.BoxGeometry(.075,.025,.29),gunMetal);receiverTop.position.set(0,.052,-.08);gun.add(receiverTop);
const mag=new THREE.Mesh(new THREE.BoxGeometry(.052,.15,.09),gunPoly);mag.position.set(0,-.105,-.02);mag.rotation.x=-.12;gun.add(mag);
const stock=new THREE.Mesh(new THREE.BoxGeometry(.075,.07,.16),gunPoly);stock.position.set(0,-.005,.23);gun.add(stock);
const muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.045,10),gunMetal);muzzle.rotation.x=Math.PI/2;muzzle.position.z=-.575;gun.add(muzzle);
const rail=new THREE.Mesh(new THREE.BoxGeometry(.045,.018,.22),gunMetal);rail.position.set(0,.071,-.1);gun.add(rail);
for(let i=0;i<7;i++){const rib=new THREE.Mesh(new THREE.BoxGeometry(.092,.009,.012),gunMetal);rib.position.set(0,.019,-.205+i*.027);gun.add(rib);}
const sightBase=new THREE.Mesh(new THREE.BoxGeometry(.035,.025,.045),gunMetal);sightBase.position.set(0,.077,-.04);gun.add(sightBase);
const gunGrip=new THREE.Mesh(new THREE.BoxGeometry(.05,.14,.06),mats.dark);gun.add(gunGrip);
const gunSight=new THREE.Mesh(new THREE.BoxGeometry(.015,.03,.015),mats.dark);gunSight.position.set(0,.055,-.1);gun.add(gunSight);
const flash=new THREE.Mesh(new THREE.SphereGeometry(.07,6,4),new THREE.MeshBasicMaterial({color:0xffe08a}));flash.visible=false;gun.add(flash);
/* Viewmodels 3D: peças procedurais ficam ocultas quando a arma usa modelo. Modelo centrado: coronha em +0.05. */
const procParts=gun.children.filter(o=>o!==flash);
const VM={};
const PACK_KEYS=['rifle','pistol','shotgun','carabina','sniper'];
WEAPONS.forEach((w,i)=>{w.model=PACK_KEYS[i];});
for(const w of WEAPONS)if(!VM[w.model]){const vm=new THREE.Group();vm.position.z=0.05-w.len/2;vm.visible=false;gun.add(vm);VM[w.model]=vm;WPACK.attach(vm,w.model,w.len,0);}
const GZ=-.18,GS=1; /* Arma próxima: coronha e empunhadura saem pela borda inferior, junto ao jogador. */
gun.position.set(.18*GS,-.24*GS,GZ);

function setWeapon(i){
 cw=i;reloading=0;
 const usesVM=!!WEAPONS[i].model;procParts.forEach(o=>o.visible=!usesVM);for(const k in VM)VM[k].visible=(WEAPONS[i].model===k);
 gunBody.material.color.set(WEAPONS[i].col);
 gunBody.scale.z=WEAPONS[i].len/.5;gunBarrel.scale.z=WEAPONS[i].len/.7;gunBarrel.position.z=-WEAPONS[i].len*.52;muzzle.position.z=-WEAPONS[i].len*.82;
 flash.position.z=usesVM?(0.05-WEAPONS[i].len-.03):(-WEAPONS[i].len/2-.06);
 gunGrip.position.z=WEAPONS[i].len/4;
 updAmmo();
}
function reload(){const w=WEAPONS[cw],s=ws[cw];if(reloading>0||s.mag>=w.mag||s.res<=0)return;reloading=w.reload;SFX.reload();updAmmo();}
function finishReload(){const w=WEAPONS[cw],s=ws[cw],t=Math.min(w.mag-s.mag,s.res);s.mag+=t;s.res-=t;reloading=0;updAmmo();}
function swap(){if(reloading>0)return;setWeapon((cw+1)%WEAPONS.length);SFX.ui();}

/* EXPLOSÃO */
function explode(pos,self){
 SFX.boom();if(typeof vegOnExplosion==='function')vegOnExplosion(pos,1.8);if(typeof aiNoise==='function')aiNoise(pos.x,pos.z,34);
 burst(pos,22,0xff8a20,.6,7,2,1.6);burst(pos,14,0x444444,1.6,2.5,-.5,3.2);
 if(typeof gfxBoom==='function')gfxBoom(pos);
 for(const e of enemies){if(e.state==='dead')continue;const d=Math.hypot(e.pos.x-pos.x,e.pos.z-pos.z);
  if(d<7){e.hp-=130*(1-d/7);e.react=.3;if(e.hp<=0)onKill(e);else{e.state='alert';e.t=.2;e.last.set(P.x,0,P.z);}}}
 const dp=Math.hypot(P.x-pos.x,P.z-pos.z);if(dp<8){let blocked=false;if(typeof canSee==='function'){const a=pos.clone().setY(1),b=new THREE.Vector3(P.x,P.y+1.2,P.z);blocked=!canSee(a,b);}hurt((blocked?18:48)*(1-dp/8),pos);}
 for(const b of barrels.slice()){if(b!==self&&b.userData.barrel&&Math.hypot(b.position.x-pos.x,b.position.z-pos.z)<5)setTimeout(()=>killBarrel(b),150);}
}
function killBarrel(m){
 if(!m.userData.barrel)return;
 const b=m.userData.barrel.b;m.userData.barrel=null;
 let i=solids.indexOf(m);if(i>=0)solids.splice(i,1);
 i=colliders.indexOf(b);if(i>=0)colliders.splice(i,1);
 i=barrels.indexOf(m);if(i>=0)barrels.splice(i,1);
 world.remove(m);explode(m.position.clone().setY(.6),m);
}

/* TIRO (hitscan: o raio para na primeira parede, então não atravessa) */
function shoot(){
 if(typeof cbtShoot==='function')return cbtShoot();
 const w=WEAPONS[cw],s=ws[cw],now=performance.now()/1000;
 if(reloading>0||now-lastShot<w.rate||P.dead)return false;
 if(s.mag<=0){SFX.empty();lastShot=now;if(s.res>0)reload();return true;}
 lastShot=now;s.mag--;shots++;SFX[w.snd]();kick=1;flashT=.05;flash.visible=true;if(typeof aiNoise==='function')aiNoise(P.x,P.z,26);
 P.pitch=Math.min(1.4,P.pitch+w.recoil*(aim?.6:1));
 const ens=[];enemies.forEach(e=>{if(e.state!=='dead')ens.push(...e.meshes);});
 let hit=false;cam.updateMatrixWorld(true);
 for(let p=0;p<w.pel;p++){
  const sp=w.spread*(aim?.4:1)*(P.crouch?.8:1);
  dir.set((Math.random()-.5)*sp*2,(Math.random()-.5)*sp*2,-1).normalize().transformDirection(cam.matrixWorld);
  cam.getWorldPosition(tmpV);ray.set(tmpV,dir);ray.far=w.range;
  const hw=ray.intersectObjects(solids,false)[0],he=ray.intersectObjects(ens,false)[0];
  if(he&&(!hw||he.distance<hw.distance)){
   const e=he.object.userData.enemy,hs=he.object.userData.head;
   e.hp-=w.dmg*(hs?2.5:1)*(w.pel>1?Math.max(.3,1-he.distance/w.range):1);
   e.react=.15;burst(he.point,4,0xb02020);hit=true;
   if(['patrol','idle','search'].includes(e.state)){e.state='alert';e.t=.2;e.last.set(P.x,0,P.z);}
   if(e.hp<=0&&e.state!=='dead'){onKill(e,!!hs);msg(hs?'TIRO NA CABEÇA':'ELIMINADO',1);}
  }else if(hw){
   burst(hw.point,3,0xcfc8a0);
   if(hw.object.userData.barrel){const bd=hw.object.userData.barrel;bd.hp-=w.dmg;if(bd.hp<=0)killBarrel(hw.object);}
   else if(hw.face)decal(hw.point,hw.face.normal.clone());
  }
 }
 if(hit){hitsN++;SFX.hit();$('hm').style.opacity=1;setTimeout(()=>$('hm').style.opacity=0,90);}
 updAmmo();
 if(s.mag<=0&&s.res>0)setTimeout(()=>{if(ws[cw].mag<=0)reload();},250);
 return true;
}

/* ATUALIZAÇÃO POR FRAME: animação da arma, recarga e disparo */
function updateWeapon(dt){
 kick=Math.max(0,kick-dt*10);
 if(typeof cbtUpdate==='function')cbtUpdate(dt);
 if(reloading>0){reloading-=dt;if(reloading<=0)finishReload();}
 const heatKick=(typeof CBT!=='undefined'?CBT.heat*.015:0);
 const tx=aim?0:.18*GS,ty=(aim?-.10:-.24)*GS-kick*.02-heatKick+(reloading>0?-.15:0);
 gun.position.x+=(tx-gun.position.x)*Math.min(1,dt*14);
 gun.position.y+=(ty-gun.position.y)*Math.min(1,dt*14);
 gun.position.z=GZ+kick*.06;gun.rotation.x=kick*.1;
 $('cross').style.opacity=aim?.3:1;
 if(flashT>0){flashT-=dt;if(flashT<=0)flash.visible=false;}
 if(inp.fire){if(WEAPONS[cw].auto||!fireHeld){if(shoot())fireHeld=true;}}else fireHeld=false;
}
