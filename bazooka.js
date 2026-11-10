"use strict";
/* BAZUCA (modo Contra Monstros, onda 7+)
   - A cada onda a partir da 7ª há chance de surgir uma BASE DE CARREGAMENTO (onda 7 sempre surge).
   - Fique na base AGACHADO até a barra encher: ganha a bazuca com 2 foguetes.
   - TROCAR alterna entre bazuca e arma atual. Foguete explode em área (mais forte que barril). */
const BZ_CFG={fromWave:7,chance:.6,chargeTime:5,padR:1.8,ammo:2,speed:42,rate:1.1,radius:10,dmg:420,selfR:9,selfDmg:60};
const BZ={pad:null,charge:0,ammo:0,on:false,lastShot:0,rockets:[],vm:null};

/* modelo na mão */
(function(){const vm=new THREE.Group();const len=1.15;vm.position.set(0,.06,0.05-len/2+.25);vm.visible=false;gun.add(vm);BZ.vm=vm;WPACK.attach(vm,'bazooka',len,0);})();

/* barra de carregamento */
const bzBar=document.createElement('div');
bzBar.style.cssText='position:fixed;left:50%;top:62%;transform:translateX(-50%);width:220px;padding:6px 8px;background:rgba(0,0,0,.55);border:1px solid #ffb43a;color:#ffd27a;font:600 14px "Barlow Condensed",sans-serif;text-align:center;letter-spacing:1px;display:none;z-index:20;pointer-events:none';
bzBar.innerHTML='<div id="bzt">BASE DE CARREGAMENTO</div><div style="height:8px;background:#332;margin-top:4px"><i id="bzf" style="display:block;height:100%;width:0;background:#ffb43a"></i></div>';
document.body.appendChild(bzBar);

function bzEquip(on){
 if(on&&BZ.ammo<=0)return;
 BZ.on=on;reloading=0;
 if(on){gun.children.forEach(o=>o.visible=false);BZ.vm.visible=true;updAmmo();}
 else{BZ.vm.visible=false;setWeapon(cw);}
}
function bzMakePad(){
 if(BZ.pad)return;
 let x=0,z=0,ok=false;
 for(let t=0;t<60&&!ok;t++){const a=Math.random()*Math.PI*2,r=8+Math.random()*12;x=P.x+Math.cos(a)*r;z=P.z+Math.sin(a)*r;
  if(Math.abs(x)>SZ-4||Math.abs(z)>SZ-4)continue;if(hitsBox(x,z,0,BZ_CFG.padR,2.2))continue;ok=true;}
 if(!ok)return;
 const g=new THREE.Group();
 const base=new THREE.Mesh(new THREE.CylinderGeometry(BZ_CFG.padR,BZ_CFG.padR+.15,.12,28),new THREE.MeshStandardMaterial({color:0x2b2b2b,metalness:.6,roughness:.4}));base.position.y=.06;g.add(base);
 const ring=new THREE.Mesh(new THREE.RingGeometry(BZ_CFG.padR*.75,BZ_CFG.padR*.92,32),new THREE.MeshBasicMaterial({color:0xffa020,side:THREE.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.13;g.add(ring);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,6,12,1,true),new THREE.MeshBasicMaterial({color:0xffb43a,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}));beam.position.y=3;g.add(beam);
 const light=new THREE.PointLight(0xffa030,1.4,9);light.position.y=1.5;g.add(light);
 g.position.set(x,0,z);scene.add(g);BZ.pad={g,ring,beam};BZ.charge=0;
 msg('BASE DE CARREGAMENTO apareceu! Agache sobre ela para liberar a BAZUCA',4);
}
function bzRemovePad(){if(BZ.pad){scene.remove(BZ.pad.g);BZ.pad=null;}BZ.charge=0;bzBar.style.display='none';}
function bzReset(){bzRemovePad();BZ.rockets.forEach(r=>scene.remove(r.m));BZ.rockets=[];BZ.ammo=0;if(BZ.on){BZ.on=false;BZ.vm.visible=false;}}

/* disparo */
const bzRocketGeo=new THREE.CylinderGeometry(.07,.07,.5,8),bzRocketMat=new THREE.MeshStandardMaterial({color:0x4a5a3a,emissive:0x331800});
function bzFire(){
 const now=performance.now()/1000;
 if(P.dead||now-BZ.lastShot<BZ_CFG.rate)return false;
 if(BZ.ammo<=0){SFX.empty();BZ.lastShot=now;return true;}
 BZ.lastShot=now;BZ.ammo--;shots++;kick=2.2;
 if(SFX.shotgun)SFX.shotgun();
 cam.updateMatrixWorld(true);
 const o=new THREE.Vector3();cam.getWorldPosition(o);
 const d=new THREE.Vector3(0,0,-1).transformDirection(cam.matrixWorld);
 o.addScaledVector(d,.8);
 const m=new THREE.Mesh(bzRocketGeo,bzRocketMat);m.position.copy(o);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);scene.add(m);
 BZ.rockets.push({m,d,life:4,trail:0});
 P.pitch=Math.min(1.4,P.pitch+.05);
 if(typeof aiNoise==='function')aiNoise(P.x,P.z,40);
 updAmmo();
 if(BZ.ammo<=0)setTimeout(()=>{if(BZ.on&&BZ.ammo<=0){bzEquip(false);msg('Bazuca sem munição',1.5);}},700);
 return true;
}
function bzExplode(pos){
 SFX.boom();setTimeout(()=>SFX.boom(),60);
 if(typeof vegOnExplosion==='function')vegOnExplosion(pos,3);if(typeof aiNoise==='function')aiNoise(pos.x,pos.z,50);
 burst(pos,40,0xff8a20,.8,11,2,2.4);burst(pos,26,0xffd060,.5,8,1,1.6);burst(pos,24,0x444444,2,3.5,-.5,4.5);
 if(typeof gfxBoom==='function'){gfxBoom(pos);gfxBoom(pos.clone().setY(pos.y+1));}
 const R=BZ_CFG.radius;
 for(const e of enemies.slice()){if(e.state==='dead')continue;const dd=Math.hypot(e.pos.x-pos.x,e.pos.z-pos.z);
  if(dd<R){e.hp-=BZ_CFG.dmg*(1-dd/R*.7);e.react=.4;if(e.hp<=0)onKill(e);else{e.state='alert';e.t=.2;e.last.set(P.x,0,P.z);}}}
 const dp=Math.hypot(P.x-pos.x,P.z-pos.z);if(dp<BZ_CFG.selfR)hurt(BZ_CFG.selfDmg*(1-dp/BZ_CFG.selfR),pos);
 for(const b of barrels.slice()){if(b.userData.barrel&&Math.hypot(b.position.x-pos.x,b.position.z-pos.z)<7)setTimeout(()=>killBarrel(b),150);}
}
const bzRay=new THREE.Raycaster();
function bzUpdateRockets(dt){
 for(let i=BZ.rockets.length-1;i>=0;i--){const r=BZ.rockets[i];const step=BZ_CFG.speed*dt;r.life-=dt;
  bzRay.set(r.m.position,r.d);bzRay.far=step;const hw=bzRay.intersectObjects(solids,false)[0];
  let hit=null;
  if(hw)hit=hw.point.clone().addScaledVector(r.d,-.2);
  else{r.m.position.addScaledVector(r.d,step);const p=r.m.position;
   if(p.y<=.05)hit=p.clone().setY(.1);
   else for(const e of enemies){if(e.state==='dead')continue;const h=(e.MT&&e.MT.h||1.9)+(e.MT&&e.MT.fly||0);
    if(Math.hypot(e.pos.x-p.x,e.pos.z-p.z)<1.3&&p.y<h+.3){hit=p.clone();break;}}}
  r.trail-=dt;if(r.trail<=0){r.trail=.03;burst(r.m.position,1,0xbbbbbb,.5,.4,-.3,.8);}
  if(hit||r.life<=0){scene.remove(r.m);BZ.rockets.splice(i,1);bzExplode(hit||r.m.position.clone());}
 }
}
function bzUpdate(dt){
 bzUpdateRockets(dt);
 const pd=BZ.pad;
 if(!pd){bzBar.style.display='none';return;}
 const t=performance.now()/1000;pd.ring.rotation.z=t;pd.beam.material.opacity=.12+.08*Math.sin(t*3);
 const near=Math.hypot(P.x-pd.g.position.x,P.z-pd.g.position.z)<BZ_CFG.padR;
 if(near&&P.crouch&&!P.dead)BZ.charge+=dt;else if(!near)BZ.charge=Math.max(0,BZ.charge-dt*.5);
 const f=Math.min(1,BZ.charge/BZ_CFG.chargeTime);
 bzBar.style.display=(near||f>0)?'block':'none';
 $('bzf').style.width=(f*100)+'%';
 $('bzt').textContent=near?(P.crouch?'CARREGANDO… '+((f*100)|0)+'%':'AGACHE PARA CARREGAR'):'BASE DE CARREGAMENTO '+((f*100)|0)+'%';
 if(f>=1){bzRemovePad();BZ.ammo=BZ_CFG.ammo;bzEquip(true);msg('BAZUCA LIBERADA! 2 foguetes · TROCAR alterna a arma',3);SFX.win();}
}

/* ganchos */
const _bzStartWave=monStartWave;
monStartWave=function(){_bzStartWave();if(MON.wave>=BZ_CFG.fromWave&&!BZ.pad&&BZ.ammo<=0&&(MON.wave===BZ_CFG.fromWave||Math.random()<BZ_CFG.chance))setTimeout(()=>{if(GM.active==='monsters')bzMakePad();},3200);};
const _bzUpdate=gmUpdate;
gmUpdate=function(dt){_bzUpdate(dt);if(state==='play')bzUpdate(dt);};
const _bzClear=gmClear;
gmClear=function(){bzReset();_bzClear();};
const _bzShoot=shoot;
shoot=function(){return BZ.on?bzFire():_bzShoot();};
const _bzReload=reload;
reload=function(){if(BZ.on)return;_bzReload();};
const _bzSetW=setWeapon;
setWeapon=function(i){if(BZ.on){BZ.on=false;BZ.vm.visible=false;}_bzSetW(i);};
const bzHook=setInterval(()=>{if(typeof startGame!=='function')return;clearInterval(bzHook);
 const _bzAmmo=updAmmo;updAmmo=function(){if(BZ.on){$('ammo').innerHTML='BAZUCA<br>'+BZ.ammo+' FOGUETE'+(BZ.ammo===1?'':'S');return;}_bzAmmo();};
 const _sw=swap;swap=function(){if(BZ.on){bzEquip(false);SFX.ui();return;}if(BZ.ammo>0){bzEquip(true);SFX.ui();return;}_sw();};},50);
