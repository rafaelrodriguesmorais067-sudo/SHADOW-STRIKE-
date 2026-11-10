"use strict";
/* COMBATE AVANÇADO: balística, penetração, zonas de dano, recoil, supressão, casings, armor */

const CBT={
 recoilV:0,recoilH:0,bloom:0,heat:0,
 suppress:0,        // player under fire (0-1)
 armor:0,           // player armor points
 casings:[],casingI:0,
 impactPool:[],
 dropScale:1,       // quality scale
 _v:new THREE.Vector3(),
 _d:new THREE.Vector3()
};

/* Balística por arma (extende WEAPONS em runtime) */
const BALLISTICS={
 0:{vel:720,drop:.012,pen:55,armorPen:.65,head:2.6,torso:1,limb:.7,recoilUp:.018,recoilSide:.008,bloomAdd:.012,adsMul:.35,moveMul:1.4,name:'AR'},
 1:{vel:380,drop:.028,pen:25,armorPen:.4,head:2.4,torso:1,limb:.75,recoilUp:.028,recoilSide:.012,bloomAdd:.008,adsMul:.4,moveMul:1.2,name:'Pistol'},
 2:{vel:400,drop:.04,pen:20,armorPen:.35,head:1.8,torso:1,limb:.85,recoilUp:.07,recoilSide:.03,bloomAdd:.02,adsMul:.55,moveMul:1.5,name:'SG'},
 3:{vel:800,drop:.009,pen:70,armorPen:.8,head:2.7,torso:1,limb:.65,recoilUp:.04,recoilSide:.01,bloomAdd:.01,adsMul:.3,moveMul:1.5,name:'Carbine'},
 4:{vel:900,drop:.006,pen:90,armorPen:.95,head:3.2,torso:1.05,limb:.55,recoilUp:.11,recoilSide:.015,bloomAdd:.004,adsMul:.2,moveMul:1.8,name:'Sniper'}
};

/* Resistência de materiais (pen need) */
const MAT_PEN={wood:30,glass:15,metal:70,concrete:85,default:60,barrel:40};

function cbtMatOf(obj){
 if(!obj)return 'default';
 if(obj.userData&&obj.userData.barrel)return 'barrel';
 const n=(obj.name||'').toLowerCase();
 const mat=obj.material;
 const col=mat&&mat.color?mat.color.getHex():0;
 // heurística por cor/nome dos materiais do mapa
 if(col===0x8b7355||n.indexOf('wood')>=0)return 'wood';
 if(col>0xc0c0c0&&col<0xffffff)return 'metal';
 return 'concrete';
}

function cbtInit(){
 // shell casings pool
 if(!CBT.casings.length){
  for(let i=0;i<16;i++){
   const m=new THREE.Mesh(
    new THREE.CylinderGeometry(.008,.01,.03,5),
    new THREE.MeshBasicMaterial({color:0xc8a050})
   );
   m.visible=false;scene.add(m);
   CBT.casings.push({m,vx:0,vy:0,vz:0,life:0});
  }
 }
 if(typeof P!=='undefined'&&P.armor===undefined)P.armor=0;
}

function cbtEjectCasing(){
 cbtInit();
 const c=CBT.casings[CBT.casingI++%CBT.casings.length];
 cam.getWorldPosition(CBT._v);
 const right=CBT._d.set(1,0,0).transformDirection(cam.matrixWorld);
 c.m.position.copy(CBT._v).addScaledVector(right,.15).add(new THREE.Vector3(0,-.05,-.1));
 c.vx=right.x*(2+Math.random())+ (Math.random()-.5);
 c.vy=1.5+Math.random();
 c.vz=right.z*(2+Math.random());
 c.life=.8+Math.random()*.5;
 c.m.visible=true;
 c.m.rotation.set(Math.random(),Math.random(),Math.random());
}

function cbtUpdateCasings(dt){
 for(const c of CBT.casings){
  if(!c.m.visible)continue;
  c.life-=dt;c.vy-=9*dt;
  c.m.position.x+=c.vx*dt;c.m.position.y+=c.vy*dt;c.m.position.z+=c.vz*dt;
  c.m.rotation.x+=dt*8;
  if(c.m.position.y<0.02){c.m.position.y=0.02;c.vy*=-.2;c.vx*=.5;c.vz*=.5;}
  if(c.life<=0)c.m.visible=false;
 }
}

function cbtImpactFX(point,normal,mat){
 const col=mat==='metal'?0xffcc66:mat==='wood'?0x8a6a40:mat==='glass'?0xaaddff:0xcfc8a0;
 const n=mat==='metal'?5:3;
 burst(point,n,col,.25,2.2,.5,1.2);
 if(normal)decal(point,normal);
 // sparks for metal
 if(mat==='metal'&&typeof QI!=='undefined'&&QI>=1)burst(point,4,0xffee88,.12,4,1,1.5);
}

function cbtZoneMul(hitObj,ball){
 if(hitObj.userData&&hitObj.userData.head)return ball.head;
 // body hitbox height heuristic
 const ly=hitObj.position?hitObj.position.y:0.7;
 if(ly>1.35)return ball.head;
 if(ly<0.45)return ball.limb;
 return ball.torso;
}

function cbtApplyRecoil(w,ball){
 const ads=aim?ball.adsMul:1;
 const crouch=P.crouch?.75:1;
 const moving=(typeof MV!=='undefined'&&MV.hs>1.5)?ball.moveMul:1;
 const heat=1+CBT.heat*.4;
 CBT.recoilV+=ball.recoilUp*ads*crouch*moving*heat;
 CBT.recoilH+=(Math.random()-.5)*2*ball.recoilSide*ads*moving*heat;
 CBT.bloom=Math.min(.08,CBT.bloom+ball.bloomAdd*moving);
 CBT.heat=Math.min(1,CBT.heat+.08);
 kick=1;
 // camera kick
 P.pitch=Math.min(1.4,P.pitch+ball.recoilUp*ads*.9);
 P.yaw+= (Math.random()-.5)*ball.recoilSide*ads*1.2;
}

function cbtSuppressEnemies(origin,dir,maxDist){
 // near-miss suppression along shot
 for(const e of enemies){
  if(e.state==='dead')continue;
  const toE=CBT._v.set(e.pos.x-origin.x,0,e.pos.z-origin.z);
  const dist=toE.length();
  if(dist>maxDist||dist<1)continue;
  toE.normalize();
  const dot=toE.x*dir.x+toE.z*dir.z;
  if(dot<.82)continue;
  // lateral miss distance
  const cross=Math.abs(toE.x*dir.z-toE.z*dir.x)*dist;
  if(cross>2.2)continue;
  e.suppress=(e.suppress||0)+.45;
  e.react=.2;
  if(['patrol','idle','search'].includes(e.state)){e.state='alert';e.t=.4;e.last.set(P.x,0,P.z);}
  // seek cover when heavily suppressed
  if(e.suppress>1.2&&e.hp>0&&typeof findCover==='function'&&Math.random()<.35){
   const cp=findCover(e);if(cp){e.cp=cp;e.state='cover';e.t=2.5;e.covered=true;}
  }
 }
}

function cbtPlayerSuppress(dt){
 CBT.suppress=Math.max(0,CBT.suppress-dt*.35);
 if(CBT.suppress>0.15){
  // vignette via dmg overlay faint
  const el=$('dmg');
  if(el&&Math.random()<.08){el.style.opacity=String(Math.min(.35,CBT.suppress*.3));setTimeout(()=>{if(el)el.style.opacity=0;},80);}
 }
}

/** Tiro avançado — substitui a lógica principal de shoot() */
function cbtShoot(){
 const w=WEAPONS[cw],s=ws[cw],ball=BALLISTICS[cw]||BALLISTICS[0];
 const now=performance.now()/1000;
 if(reloading>0||now-lastShot<w.rate||P.dead)return false;
 if(s.mag<=0){SFX.empty();lastShot=now;if(s.res>0)reload();return true;}
 lastShot=now;s.mag--;shots++;
 if(SFX[w.snd])SFX[w.snd]();
 flashT=cw===4?.08:cw===2?.06:.045;flash.visible=true;
 if(typeof aiNoise==='function')aiNoise(P.x,P.z,22+ball.pen*.15);
 cbtApplyRecoil(w,ball);
 cbtEjectCasing();

 const ens=[];
 enemies.forEach(e=>{if(e.state!=='dead')ens.push(...e.meshes);});
 let hitConfirm=false;
 cam.updateMatrixWorld(true);
 cam.getWorldPosition(tmpV);

 // spread: base + bloom + movement
 const moveSp=(typeof MV!=='undefined'&&MV.hs>2)?1.3:1;
 const adsSp=aim?(ball.adsMul):1;
 const crouchSp=P.crouch?.7:1;
 const baseSp=w.spread*adsSp*crouchSp*moveSp+CBT.bloom;

 for(let p=0;p<w.pel;p++){
  let dmgLeft=w.dmg;
  let penLeft=ball.pen;
  dir.set((Math.random()-.5)*baseSp*2,(Math.random()-.5)*baseSp*2,-1).normalize().transformDirection(cam.matrixWorld);

  // bullet drop approximation: pitch down based on range estimate mid-path
  // multi-segment hitscan for drop + penetration
  let origin=tmpV.clone();
  let direction=dir.clone();
  let traveled=0;
  const maxRange=w.range;
  const segments=cw===4?3:cw===3?2:1;
  const segLen=maxRange/segments;
  let hitSomething=false;

  for(let seg=0;seg<segments&&traveled<maxRange&&dmgLeft>1;seg++){
   // apply drop each segment
   direction.y-=ball.drop*segLen*0.0015*(traveled*.01+1);
   direction.normalize();
   ray.set(origin,direction);ray.far=segLen;

   const hitsW=ray.intersectObjects(solids,false);
   const hitsE=ray.intersectObjects(ens,false);
   const hw=hitsW[0],he=hitsE[0];

   // enemy first if closer
   if(he&&(!hw||he.distance<hw.distance)){
    const e=he.object.userData.enemy;
    if(!e||e.state==='dead'){origin.addScaledVector(direction,he.distance+.05);traveled+=he.distance;continue;}
    const zone=cbtZoneMul(he.object,ball);
    // distance falloff
    const dist=traveled+he.distance;
    let fall=1;
    if(w.pel>1)fall=Math.max(.25,1-dist/w.range);
    else fall=Math.max(.4,1-dist/(w.range*1.2));
    // armor on enemy heavy types
    let dmg=dmgLeft*zone*fall;
    if(e.type==='heavy'||e.type==='boss')dmg*=(1-Math.min(.55,ball.armorPen*.35));
    e.hp-=dmg;
    if(e.monster&&typeof monPwOnShot==='function')monPwOnShot(e,dmg,he.point);
    e.react=.12+zone*.05;
    e.suppress=(e.suppress||0)+.3;
    // accuracy penalty when hit
    e.hitAccPen=(e.hitAccPen||0)+.15;
    burst(he.point,zone>2?6:4,0xb02020,.3,2.5,.4,1.3);
    hitConfirm=true;hitSomething=true;
    if(['patrol','idle','search','investigate','track'].includes(e.state)){e.state='alert';e.t=.25;e.last.set(P.x,0,P.z);}
    if(e.hp<=0&&e.state!=='dead'){
     onKill(e,zone>=ball.head*.9);
     msg(zone>=2.2?'TIRO NA CABEÇA':'ELIMINADO',1);
    }else if((e.type==='heavy'||e.type==='boss')&&Math.random()<.15)e.stun=.35;
    // bullets stop on body (no overpen on characters for balance)
    break;
   }

   if(hw){
    const mat=cbtMatOf(hw.object);
    const need=MAT_PEN[mat]||MAT_PEN.default;
    const nrm=hw.face?hw.face.normal.clone():direction.clone().negate();
    if(hw.face)nrm.transformDirection(hw.object.matrixWorld);
    cbtImpactFX(hw.point,nrm,mat);
    hitSomething=true;

    if(hw.object.userData.barrel){
     const bd=hw.object.userData.barrel;bd.hp-=dmgLeft;if(bd.hp<=0)killBarrel(hw.object);
     break;
    }
    // penetration?
    if(penLeft>need&&mat!=='concrete'){
     penLeft-=need;
     dmgLeft*=Math.max(.35,1-need/penLeft);
     origin=hw.point.clone().addScaledVector(direction,0.08);
     traveled+=hw.distance+.08;
     burst(hw.point,2,0xaaaaaa,.15,1.5,0,1); // exit dust
     continue;
    }
    break;
   }

   // empty segment
   origin.addScaledVector(direction,segLen);
   traveled+=segLen;
  }

  cbtSuppressEnemies(tmpV,dir,Math.min(50,w.range));
 }

 if(hitConfirm){hitsN++;SFX.hit();$('hm').style.opacity=1;setTimeout(()=>$('hm').style.opacity=0,90);}
 updAmmo();
 if(s.mag<=0&&s.res>0)setTimeout(()=>{if(ws[cw].mag<=0)reload();},250);
 return true;
}

function cbtUpdate(dt){
 // recoil recovery
 CBT.recoilV=Math.max(0,CBT.recoilV-dt*1.8);
 CBT.recoilH+=(0-CBT.recoilH)*Math.min(1,dt*6);
 CBT.bloom=Math.max(0,CBT.bloom-dt*.05);
 CBT.heat=Math.max(0,CBT.heat-dt*.25);
 // apply residual recoil to view gently
 if(CBT.recoilV>0.0005)P.pitch=Math.min(1.4,P.pitch+CBT.recoilV*dt*2);
 if(Math.abs(CBT.recoilH)>0.0005)P.yaw+=CBT.recoilH*dt*2;
 cbtUpdateCasings(dt);
 cbtPlayerSuppress(dt);
 // enemy suppress decay + accuracy
 if(typeof enemies!=='undefined'){
  for(const e of enemies){
   if(e.suppress>0)e.suppress=Math.max(0,e.suppress-dt*.4);
   if(e.hitAccPen>0)e.hitAccPen=Math.max(0,e.hitAccPen-dt*.2);
  }
 }
}

/** Dano no player com colete */
function cbtHurt(d,from){
 if(P.dead||mode==='practice'||P.dashT>0)return;
 // armor absorbs
 if(typeof P.armor==='number'&&P.armor>0){
  const absorb=Math.min(P.armor,d*.55);
  P.armor-=absorb;d-=absorb;
 }
 P.hp-=d;
 CBT.suppress=Math.min(1,CBT.suppress+.25);
 $('dmg').style.opacity=1;setTimeout(()=>$('dmg').style.opacity=0,120);
 if(from){const dx=from.x-P.x,dz=from.z-P.z,cy=Math.cos(P.yaw),sy=Math.sin(P.yaw);
  $('dd').style.transform='rotate('+Math.atan2(dx*cy-dz*sy,-dx*sy-dz*cy)+'rad)';$('dd').style.opacity=1;setTimeout(()=>$('dd').style.opacity=0,500);}
 SFX.hurt();updHud();
 if(P.hp<=0){P.hp=0;P.dead=true;endGame(false);}
}

/** Enemy shot accuracy under suppress */
function cbtEnemyAccMul(e){
 let m=1;
 if(e.suppress>0)m*=Math.max(.35,1-e.suppress*.4);
 if(e.hitAccPen>0)m*=Math.max(.4,1-e.hitAccPen);
 return m;
}
