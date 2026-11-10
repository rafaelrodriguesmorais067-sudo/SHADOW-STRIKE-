"use strict";
/* MODO CONTRA MONSTROS (MONSTER SURVIVAL)
   - Monstros 3D (Quaternius Ultimate Monsters + Skeleton) com animações reais
   - IA: detectar -> perseguir (desvio de obstáculos) -> ataque físico com janela de impacto -> recarga
   - Sem armas: golpes físicos; o cogumelo flanqueia e pisca antes de uma explosão de proximidade
   - Ondas progressivas, barras de vida, pooling de monstros, recorde salvo
   Integra-se aos ganchos de modes.js (gmStart/gmUpdate/gmOnKill/gmHudText/gmEndTitle/gmClear). */

/* ---------- CONFIGURAÇÃO (tudo ajustável individualmente) ----------
   hp: vida (jogador = 100) · dmg: dano por golpe · reach: alcance do golpe (m)
   detect: distância de detecção · chase: distância em que desiste (perde o rastro)
   speed: m/s perseguindo · cd: recarga entre golpes (s) · hit: momento do impacto (fração da animação)
   h: altura em metros · fly: altura de voo · pts: pontos · from: onda mínima */
const MON_TYPES={
 skeleton:{name:'Esqueleto',file:'Skeleton.glb',cls:'comum',hp:200,dmg:11,reach:1.7,detect:50,chase:70,speed:3.91,cd:0.88,hit:.5,h:1.85,pts:150,from:1},
 ninja:   {name:'Ninja',file:'Ninja.glb',cls:'comum',hp:200,dmg:10,reach:1.6,detect:52,chase:70,speed:4.83,cd:0.72,hit:.45,h:1.5,pts:150,from:1},
 cactoro: {name:'Cactoro',file:'Cactoro-IGn9lhdama.glb',cls:'comum',hp:220,dmg:11,reach:1.7,detect:47,chase:65,speed:3.68,cd:0.88,hit:.45,h:1.7,pts:160,from:1},
 alien:   {name:'Alien',file:'Alien.glb',cls:'comum',hp:200,dmg:9,reach:1.6,detect:56,chase:75,speed:5.29,cd:0.64,hit:.45,h:1.4,pts:160,from:2},
 ghost:   {name:'Caveira Fantasma',file:'Ghost Skull.glb',cls:'comum',hp:230,dmg:10,reach:1.9,detect:56,chase:80,speed:4.6,cd:0.8,hit:.45,h:1.3,fly:1.0,pts:180,from:2},
 orc:     {name:'Orc',file:'Orc.glb',cls:'resistente',hp:300,dmg:16,reach:1.9,detect:50,chase:70,speed:4.14,cd:0.96,hit:.45,h:2.0,pts:250,from:3},
 demon:   {name:'Demônio',file:'Demon-LnfIziKv4o.glb',cls:'resistente',hp:320,dmg:16,reach:1.9,detect:55,chase:75,speed:4.48,cd:0.88,hit:.45,h:2.0,pts:260,from:3},
 dino:    {name:'Dino',file:'Dino.glb',cls:'pesado',hp:400,dmg:22,reach:2.2,detect:50,chase:70,speed:3.56,cd:1.12,hit:.5,h:2.3,pts:350,from:4},
 yeti:    {name:'Yeti',file:'Yeti-ceRHrn8HHE.glb',cls:'pesado',hp:420,dmg:23,reach:2.3,detect:47,chase:70,speed:3.33,cd:1.2,hit:.5,h:2.5,pts:380,from:5},
 bluedemon:{name:'Demônio Azul',file:'Blue Demon.glb',cls:'especial',hp:500,dmg:26,reach:2.4,detect:62,chase:90,speed:4.14,cd:1.04,hit:.45,h:2.6,pts:500,from:6},
 mushking:{name:'Rei Cogumelo',file:'Mushroom King.glb',cls:'especial',hp:520,dmg:28,reach:2.5,detect:62,chase:90,speed:3.22,cd:1.2,hit:.5,h:2.8,pts:550,from:7,fuse:1.5,blastRadius:5},
 dragon:  {name:'Dragão',file:'Dragon Evolved.glb',cls:'especial',hp:500,dmg:26,reach:2.4,detect:68,chase:90,speed:4.37,cd:1.04,hit:.45,h:2.2,fly:1.2,pts:550,from:8}
};
const MON_CFG={
 waves:10,            /* concluir as 10 ondas = vitória */
 maxAlive:7,          /* monstros simultâneos (reduzido em qualidade super baixa) */
 minSpawnDist:20,     /* distância mínima do jogador para nascer */
 breakTime:6,         /* intervalo entre ondas (s) */
 basePath:'models/monsters/'
};
const MON_DIFF={easy:{dmg:.65,hp:.85},normal:{dmg:1,hp:1},hard:{dmg:1.3,hp:1.15},extreme:{dmg:1.6,hp:1.3}};

const MON={assets:{},loading:null,pool:{},wave:0,queue:[],spawnT:0,killed:0,breakT:0,inWave:false,ready:false,bars:[]};

/* ---------- CARREGAMENTO DOS MODELOS ---------- */
function monFindClip(clips,names){
 for(const n of names){const c=clips.find(c=>c.name.split('|').pop().toLowerCase()===n.toLowerCase());if(c)return c;}
 return null;
}
function monLoadAll(){
 if(MON.loading)return MON.loading;
 const loader=new THREE.GLTFLoader();
 const jobs=Object.keys(MON_TYPES).map(k=>new Promise(res=>{
  const T=MON_TYPES[k];
  loader.load(MON_CFG.basePath+encodeURIComponent(T.file),g=>{
   const sc=g.scene;
   sc.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});
   const box=new THREE.Box3().setFromObject(sc),size=new THREE.Vector3(),c=new THREE.Vector3();box.getSize(size);box.getCenter(c);
   const s=T.h/Math.max(.01,size.y);
   const cl=g.animations;
   MON.assets[k]={scene:sc,scale:s,offY:-box.min.y*s,offX:-c.x*s,offZ:-c.z*s,width:Math.max(size.x,size.z)*s,
    clips:{
     idle:monFindClip(cl,['Idle','Flying_Idle']),
     walk:monFindClip(cl,['Walk','Flying_Idle']),
     run:monFindClip(cl,['Run','Run2','Fast_Flying','Walk']),
     attack:monFindClip(cl,['Attack','Punch','Bite_Front','Headbutt']),
     hit:monFindClip(cl,['HitReact','HitRecieve']),
     death:monFindClip(cl,['Death'])
    }};
   res(true);
  },undefined,err=>{console.warn('Monstro não carregou:',T.file,err);res(false);});
 }));
 MON.loading=Promise.all(jobs).then(r=>{MON.ready=true;return r;});
 return MON.loading;
}

/* ---------- BARRA DE VIDA (2 sprites, sem criar texturas por quadro) ---------- */
const MON_BAR_BG=new THREE.SpriteMaterial({color:0x111111,transparent:true,opacity:.75,depthTest:false});
function monMakeBar(){
 const bg=new THREE.Sprite(MON_BAR_BG);bg.scale.set(1.1,.12,1);bg.renderOrder=999;
 const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0xd23a2a,depthTest:false}));fill.scale.set(1.04,.08,1);fill.renderOrder=1000;
 const grp=new THREE.Group();grp.add(bg);grp.add(fill);
 return {grp,bg,fill};
}
function monSetBar(e){
 const f=Math.max(.001,e.hp/e.max),b=e.bar;
 b.fill.scale.x=1.04*f;b.fill.center.x=.5/f;   /* ancora a barra na esquerda */
 b.fill.material.color.setHex(f>.6?0x9bc35a:f>.3?0xe0b030:0xd23a2a);
 b.grp.visible=e.state!=='dead'&&(f<.999||e.seen);
}

/* ---------- CRIAÇÃO / POOL ---------- */
function monBuild(k){
 const A=MON.assets[k],T=MON_TYPES[k];
 const g=new THREE.Group();
 const holder=new THREE.Group();
 const model=THREE.SkeletonUtils.clone(A.scene);
 const blinkMaterials=[];
 if(k==='mushking')model.traverse(o=>{if(!o.isMesh)return;
  const clone=mat=>{const m=mat.clone();if(m.emissive)blinkMaterials.push({mat:m,color:m.emissive.clone(),intensity:m.emissiveIntensity});return m;};
  o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);
 });
 holder.scale.setScalar(A.scale);holder.position.set(A.offX,A.offY,A.offZ);
 holder.add(model);g.add(holder);
 const mixer=new THREE.AnimationMixer(model);
 const acts={};for(const n in A.clips){if(A.clips[n])acts[n]=mixer.clipAction(A.clips[n]);}
 if(acts.attack){acts.attack.setLoop(THREE.LoopOnce);acts.attack.clampWhenFinished=true;}
 if(acts.hit){acts.hit.setLoop(THREE.LoopOnce);acts.hit.clampWhenFinished=false;}
 if(acts.death){acts.death.setLoop(THREE.LoopOnce);acts.death.clampWhenFinished=true;}
 /* Hitboxes invisíveis (malha animada não serve para raycast) */
 const w=Math.min(1.6,Math.max(.6,A.width*.7)),bh=T.h*.78;
 const fy=T.fly||0;const bodyG=new THREE.BoxGeometry(w,bh,w);bodyG.translate(0,bh/2-.8+fy,0);
 const body=new THREE.Mesh(bodyG,new THREE.MeshBasicMaterial({visible:false}));body.position.y=.8;g.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.22,w*.32),8,6),new THREE.MeshBasicMaterial({visible:false}));
 head.position.y=T.h*.86+fy;head.userData.head=true;g.add(head);
 const bar=monMakeBar();bar.grp.position.y=T.h+.35+fy;g.add(bar.grp);
 return {g,holder,mixer,acts,body,head,bar,blinkMaterials,cur:null};
}
function monPlay(e,name,fade){
 const a=e.m.acts[name]||e.m.acts.idle;if(!a||e.m.cur===a)return a;
 if(!e.m.cur)e.m.mixer.stopAllAction();
 a.reset();a.timeScale=1;a.enabled=true;a.setEffectiveWeight(1);a.play();
 if(e.m.cur)e.m.cur.crossFadeTo(a,fade==null?.18:fade,false);
 e.m.cur=a;return a;
}
function monSpawn(k){
 if(!MON.assets[k])return null;
 const T=MON_TYPES[k],dm=MON_DIFF[typeof diffKey!=='undefined'?diffKey:'normal']||MON_DIFF.normal;
 const pos=monSpawnPoint();if(!pos)return null;
 const pool=MON.pool[k]||(MON.pool[k]=[]);
 const m=pool.pop()||monBuild(k);
 m.mixer.stopAllAction();m.cur=null;
 m.g.visible=true;m.g.rotation.set(0,Math.atan2(P.x-pos.x,P.z-pos.z),0);m.g.position.set(pos.x,0,pos.z);m.holder.position.y=MON.assets[k].offY;
 scene.add(m.g);
 /* Escala de dificuldade por onda: +6% de vida por onda */
 const hp=Math.round(T.hp*dm.hp*(1+(MON.wave-1)*.06));
 const e={monster:true,mkey:k,g:m.g,m,type:'monster_'+k,T:{pts:T.pts,scale:1,hp},MT:T,hp,max:hp,state:'idle',pos:m.g.position,
  meshes:[m.body,m.head],head:m.head,bar:m.bar,role:'monster',passive:false,dead:0,
  atkT:0,atkCD:.6+Math.random()*.6,struck:false,hitT:0,stuckT:0,detour:0,detourT:0,think:Math.random()*.2,seen:false,
  lastX:pos.x,lastZ:pos.z,dmgMul:dm.dmg,legs:[],arms:[],sw:null,stun:0,react:0,last:new THREE.Vector3(),fuseT:0,beepT:0,exploded:false,flankSide:Math.random()<.5?-1:1};
 monBlink(e,false);
 m.body.userData.enemy=e;m.head.userData.enemy=e;
 monPlay(e,'idle',0);
 monSetBar(e);
 enemies.push(e);alive++;
 return e;
}
function monRecycle(e){
 monBlink(e,false);
 scene.remove(e.g);e.m.mixer.stopAllAction();e.m.cur=null;
 e.m.body.userData.enemy=null;e.m.head.userData.enemy=null;
 (MON.pool[e.mkey]||(MON.pool[e.mkey]=[])).push(e.m);
 const i=enemies.indexOf(e);if(i>=0)enemies.splice(i,1);
}

/* Ponto válido: fora de paredes, longe do jogador, dentro do mapa */
function monSpawnPoint(){
 for(let t=0;t<40;t++){
  let x,z;
  if(t<20&&typeof SPAWNS!=='undefined'){const s=pick(SPAWNS);x=s[0]+(Math.random()-.5)*6;z=s[1]+(Math.random()-.5)*6;}
  else{const a=Math.random()*Math.PI*2,r=MON_CFG.minSpawnDist+Math.random()*14;x=P.x+Math.cos(a)*r;z=P.z+Math.sin(a)*r;}
  if(Math.abs(x)>SZ-3||Math.abs(z)>SZ-3)continue;
  if(Math.hypot(x-P.x,z-P.z)<MON_CFG.minSpawnDist)continue;
  if(hitsBox(x,z,0,1.0,2.2))continue;
  let close=false;for(const o of enemies){if(o.state!=='dead'&&Math.hypot(o.pos.x-x,o.pos.z-z)<2.2){close=true;break;}}
  if(close)continue;
  return {x,z};
 }
 return null;
}

/* ---------- ONDAS ---------- */
function monWaveList(w){
 const n=6+w*3+(w>=5?4:0);  /* hordas maiores */
 const avail=Object.keys(MON_TYPES).filter(k=>MON.assets[k]&&MON_TYPES[k].from<=w);
 const list=[];
 for(let i=0;i<n;i++){
  /* ondas altas: chance maior de criaturas pesadas/especiais */
  let pool=avail;
  const r=Math.random();
  if(w>=6&&r<.25)pool=avail.filter(k=>MON_TYPES[k].cls==='especial'||MON_TYPES[k].cls==='pesado');
  else if(w>=3&&r<.45)pool=avail.filter(k=>MON_TYPES[k].cls!=='comum');
  if(!pool.length)pool=avail;
  list.push(pick(pool));
 }
 return list;
}
function monStartWave(){
 MON.wave++;MON.queue=monWaveList(MON.wave);MON.inWave=true;MON.spawnT=.5;wave=MON.wave;
 const tot=MON.queue.length;
 msg('ONDA '+MON.wave+(MON.wave===MON_CFG.waves?' — ONDA FINAL':'')+' · '+tot+' MONSTROS',3);SFX.enemy();
 updHud();
}
function monRemaining(){return MON.queue.length+enemies.filter(e=>e.monster&&e.state!=='dead').length;}

/* ---------- NAVEGAÇÃO: grade 1m + campo de fluxo (um BFS para todos os monstros) ---------- */
const NAV={n:0,c:1,blk:null,dist:null,q:null,t:0,pc:-1};
const MON_REAR={dist:null,q:null,t:0,pc:-1};
function monRearTarget(){
 /* Camera forward is -sin(yaw), -cos(yaw); the rear is its opposite. */
 for(const d of [1.8,1.2,.7]){const x=P.x+Math.sin(P.yaw)*d,z=P.z+Math.cos(P.yaw)*d;
  if(!monBlocked(x,z,.45))return {x,z};}
 return {x:P.x,z:P.z};
}
function navBuild(){
 NAV.n=Math.floor(SZ*2/NAV.c);const N=NAV.n*NAV.n;
 NAV.blk=new Uint8Array(N);NAV.dist=new Int32Array(N);NAV.q=new Int32Array(N);
 for(let j=0;j<NAV.n;j++)for(let i=0;i<NAV.n;i++){const x=-SZ+(i+.5)*NAV.c,z=-SZ+(j+.5)*NAV.c;NAV.blk[j*NAV.n+i]=(Math.abs(x)>SZ-1.5||Math.abs(z)>SZ-1.5||hitsBox(x,z,0,.45,1.6))?1:0;}
 NAV.pc=-1;
}
function navCell(x,z){const i=Math.floor((x+SZ)/NAV.c),j=Math.floor((z+SZ)/NAV.c);if(i<0||j<0||i>=NAV.n||j>=NAV.n)return -1;return j*NAV.n+i;}
function navUpdate(dt,target=P,field=NAV){
 if(!NAV.blk)navBuild();
 const N=NAV.n*NAV.n;if(!field.dist||field.dist.length!==N){field.dist=new Int32Array(N);field.q=new Int32Array(N);field.pc=-1;}
 field.t-=dt;const pc=navCell(target.x,target.z);
 if(field.t>0&&pc===field.pc)return;field.t=.35;field.pc=pc;
 const n=NAV.n,D=field.dist,B=NAV.blk,Q=field.q;D.fill(-1);if(pc<0)return;
 let h=0,t=0;D[pc]=0;Q[t++]=pc;
 while(h<t){const c=Q[h++],i=c%n,j=(c/n)|0,d=D[c]+1;
  if(i>0){const k=c-1;if(D[k]<0&&!B[k]){D[k]=d;Q[t++]=k;}}
  if(i<n-1){const k=c+1;if(D[k]<0&&!B[k]){D[k]=d;Q[t++]=k;}}
  if(j>0){const k=c-n;if(D[k]<0&&!B[k]){D[k]=d;Q[t++]=k;}}
  if(j<n-1){const k=c+n;if(D[k]<0&&!B[k]){D[k]=d;Q[t++]=k;}}}
}
const _navN=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function monFlowDir(x,z,field=NAV){
 if(!field.dist)return null;const n=NAV.n,c=navCell(x,z);if(c<0)return null;
 const i=c%n,j=(c/n)|0;let best=field.dist[c]<0?1e9:field.dist[c],bi=-1,bj=-1;
 for(const [di,dj] of _navN){const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=n||jj>=n)continue;const k=jj*n+ii,d=field.dist[k];if(d<0)continue;
  if(di&&dj&&(NAV.blk[j*n+ii]||NAV.blk[jj*n+i]))continue;   /* sem cortar quinas */
  const dd=d+(di&&dj?.4:0);if(dd<best){best=dd;bi=ii;bj=jj;}}
 if(bi<0)return null;
 const tx=-SZ+(bi+.5)*NAV.c,tz=-SZ+(bj+.5)*NAV.c;return Math.atan2(tx-x,tz-z);
}

/* ---------- IA ---------- */
function monBlink(e,on){
 for(const b of e.m.blinkMaterials||[]){if(on){b.mat.emissive.setHex(0xff8a20);b.mat.emissiveIntensity=2;}
  else{b.mat.emissive.copy(b.color);b.mat.emissiveIntensity=b.intensity;}}
}
function monMushroomDir(e){
 const rear=monRearTarget(),rx=e.pos.x-P.x,rz=e.pos.z-P.z,d=Math.hypot(rx,rz);
 const behind=rx*Math.sin(P.yaw)+rz*Math.cos(P.yaw);
 /* Circle the player's front instead of trying to walk through them. */
 if(d<8&&behind<.6*d){
  const side=rx*Math.cos(P.yaw)-rz*Math.sin(P.yaw);
  if(Math.abs(side)>.5)e.flankSide=side>0?1:-1;
  const x=rear.x+Math.cos(P.yaw)*e.flankSide*3,z=rear.z-Math.sin(P.yaw)*e.flankSide*3;
  const ang=Math.atan2(x-e.pos.x,z-e.pos.z);
  if(!monBlocked(e.pos.x+Math.sin(ang),e.pos.z+Math.cos(ang),.45))return ang;
 }
 const flow=monFlowDir(e.pos.x,e.pos.z,MON_REAR);
 if(Math.hypot(rear.x-e.pos.x,rear.z-e.pos.z)>2&&flow!==null)return flow;
 return Math.atan2(rear.x-e.pos.x,rear.z-e.pos.z);
}
function monDetonate(e){
 if(e.exploded||e.state==='dead')return;
 e.exploded=true;e.hp=0;e.state='dead';e.dead=4.4;alive=Math.max(0,alive-1);
 monBlink(e,false);e.g.visible=false;e.bar.grp.visible=false;
 const pos=e.pos.clone().setY(e.pos.y+1);
 SFX.boom();burst(pos,22,0xff8a20,.6,7,2,1.6);burst(pos,14,0x444444,1.6,2.5,-.5,3.2);
 if(typeof gfxBoom==='function')gfxBoom(pos);
 if(typeof vegOnExplosion==='function')vegOnExplosion(pos,1.8);
 if(typeof aiNoise==='function')aiNoise(pos.x,pos.z,34);
 const dist=Math.hypot(P.x-pos.x,P.y+1-pos.y,P.z-pos.z);
 const target=new THREE.Vector3(P.x,P.y+1.2,P.z);
 if(!P.dead&&dist<e.MT.blastRadius&&(typeof canSee!=='function'||canSee(pos,target)))hurt(e.MT.dmg*2*e.dmgMul*(1-dist/e.MT.blastRadius),pos);
 /* Suicide removes a hostile but does not award player kills, XP or loot. */
 updHud();
}
function monBlocked(x,z,r){return hitsBox(x,z,0,r,1.6)||Math.abs(x)>SZ-1.5||Math.abs(z)>SZ-1.5;}
function monAI(e,dt){
 const T=e.MT;
 if(e.state==='dead'){
  e.dead+=dt;e.m.mixer.update(dt);
  if(!e.m.acts.death){e.g.rotation.x=Math.min(1.45,e.dead*4);}
  if(T.fly)e.m.holder.position.y=Math.max(MON.assets[e.mkey].offY,e.m.holder.position.y-dt*2.5);
  if(e.dead>3.2){e.g.position.y-=dt*.8;}
  if(e.dead>4.5)monRecycle(e);
  return;
 }
 e.m.mixer.update(dt);
 if(T.fly)e.m.holder.position.y=MON.assets[e.mkey].offY+T.fly+Math.sin(performance.now()*.003+e.pos.x)*.15;
 e.atkCD=Math.max(0,e.atkCD-dt);e.hitT=Math.max(0,e.hitT-dt);
 const dx=P.x-e.pos.x,dz=P.z-e.pos.z,dist=Math.hypot(dx,dz);
 const want=Math.atan2(dx,dz);

 /* detecção: ataques do jogador e proximidade revelam; distância alta faz perder o rastro */
 if(e.state==='idle'||e.state==='wander'){
  if(!P.dead&&(dist<T.detect||e.hp<e.max)){e.state='chase';e.seen=true;}
  else{
   if(e.state==='idle'){monPlay(e,'idle');e.think-=dt;if(e.think<=0){e.state='wander';e.wa=Math.random()*Math.PI*2;e.think=2+Math.random()*2;}}
   else{monPlay(e,'walk');e.think-=dt;const s=T.speed*.35*dt;monMove(e,Math.sin(e.wa)*s,Math.cos(e.wa)*s);e.g.rotation.y=e.wa;if(e.think<=0){e.state='idle';e.think=1+Math.random()*2;}}
  }
  monSetBar(e);return;
 }
 if(P.dead){e.state='idle';monSetBar(e);return;}
 if(e.state==='chase'&&dist>T.chase&&e.hp>=e.max){e.state='idle';}

 if(e.mkey==='mushking'){
  if(e.state!=='fuse'&&dist<=T.reach&&Math.abs(P.y-e.pos.y)<1.6){e.state='fuse';e.fuseT=0;e.beepT=0;e.hitT=0;}
  if(e.state==='fuse'){
   e.fuseT+=dt;monBlink(e,Math.floor(e.fuseT/(e.fuseT>T.fuse*.6?.07:.14))%2===0);
   if(e.fuseT>=T.fuse){monDetonate(e);return;}
   e.beepT-=dt;
   if(e.beepT<=0){snd(650+e.fuseT/T.fuse*500,.09,'square',.16,950);e.beepT=e.fuseT>T.fuse*.6?.14:.28;}
  }
  if(e.hitT<=0||e.state==='fuse'){
   const ang=monMushroomDir(e),spd=T.speed*dt;
   monPlay(e,'run');monMove(e,Math.sin(ang)*spd,Math.cos(ang)*spd);
   e.g.rotation.y=monTurn(e.g.rotation.y,ang,dt*7);
  }
  monSetBar(e);return;
 }

 /* ATAQUE FÍSICO: só causa dano no quadro de impacto, se ainda estiver no alcance */
 if(e.state==='attack'){
  e.atkT+=dt;
  e.g.rotation.y=monTurn(e.g.rotation.y,want,dt*6);
  const dur=e.atkDur;
  if(!e.struck&&e.atkT>=dur*T.hit){
   e.struck=true;
   const fx=Math.sin(e.g.rotation.y),fz=Math.cos(e.g.rotation.y),facing=(dx*fx+dz*fz)/(dist||1);
   const vert=Math.abs((P.y)-(e.pos.y))<1.6;
   if(dist<=T.reach+PR&&facing>.35&&vert&&!P.dead){
    hurt(T.dmg*e.dmgMul,e.pos);
    SFX.hurt&&snd(70,.15,'sawtooth',.25,40);
   }
  }
  if(e.atkT>=dur){e.state='chase';e.atkCD=T.cd;}
  monSetBar(e);return;
 }

 /* reação a dano (stagger curto) */
 if(e.hitT>0){monSetBar(e);return;}

 if(dist<=T.reach*.9){
  e.g.rotation.y=monTurn(e.g.rotation.y,want,dt*8);
  if(e.atkCD<=0){
   e.state='attack';e.atkT=0;e.struck=false;
   const a=monPlay(e,'attack',.08);
   const clipDur=a&&a.getClip()?a.getClip().duration:.8;
   const spd=Math.max(1,clipDur/1.0);  /* golpes longos são acelerados para ~1s */
   if(a)a.timeScale=spd;
   e.atkDur=clipDur/spd;
  }else monPlay(e,'idle');
  monSetBar(e);return;
 }

 /* PERSEGUIÇÃO com desvio de obstáculos (sondagem de direções + desvio persistente quando preso) */
 monPlay(e,dist>6?'run':'walk');
 const a=e.m.cur;if(a)a.timeScale=dist>6?1:1.1;
 const spd=(dist>6?T.speed:T.speed*.7)*dt;
 /* caminho: segue o campo de fluxo (BFS a partir do jogador) e vai direto quando perto */
 let ang=want;
 if(dist>2.5){const d=monFlowDir(e.pos.x,e.pos.z);if(d!==null)ang=d;}
 const mx=Math.sin(ang)*spd,mz=Math.cos(ang)*spd;
 const bx=e.pos.x,bz=e.pos.z;monMove(e,mx,mz);
 const moved=Math.hypot(e.pos.x-bx,e.pos.z-bz)>spd*.3;
 e.g.rotation.y=monTurn(e.g.rotation.y,ang,dt*7);
 /* separação para não empilhar */
 for(const o of enemies){if(o===e||!o.monster||o.state==='dead')continue;const ox=e.pos.x-o.pos.x,oz=e.pos.z-o.pos.z,od=Math.hypot(ox,oz);
  if(od<1.3&&od>.001){monMove(e,ox/od*(1.3-od)*.5,oz/od*(1.3-od)*.5);}}
 if(!moved){e.stuckT+=dt;if(e.stuckT>.6){const k=(Math.random()<.5?1:-1)*1.57;monMove(e,Math.sin(ang+k)*spd*4,Math.cos(ang+k)*spd*4);e.stuckT=0;}}else e.stuckT=0;
 monSetBar(e);
}
function monMove(e,dx,dz){
 const nx=e.pos.x+dx;if(!monBlocked(nx,e.pos.z,.45))e.pos.x=nx;
 const nz=e.pos.z+dz;if(!monBlocked(e.pos.x,nz,.45))e.pos.z=nz;
 /* nunca atravessa o jogador */
 const px=e.pos.x-P.x,pz=e.pos.z-P.z,pd=Math.hypot(px,pz),min=PR+.45;
 if(pd<min&&pd>.001){e.pos.x=P.x+px/pd*min;e.pos.z=P.z+pz/pd*min;}
}
function monTurn(a,b,k){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*Math.min(1,k);}

/* Reação ao receber dano: detectado via queda de HP a cada quadro (o sistema de tiro original desconta e.hp) */
function monCheckHits(){
 for(const e of enemies){
  if(!e.monster||e.state==='dead')continue;
  if(e._lastHp===undefined)e._lastHp=e.hp;
  if(e.hp<e._lastHp){
   e.seen=true;if(e.state==='idle'||e.state==='wander')e.state='chase';
   const lost=e._lastHp-e.hp;
   if(e.state!=='attack'&&lost>=e.max*.12&&e.m.acts.hit){e.hitT=.25;const a=monPlay(e,'hit',.05);if(a)a.timeScale=2;}
  }
  e._lastHp=e.hp;
 }
}

/* ---------- INTEGRAÇÃO COM modes.js ---------- */
MODES_META.monsters={title:'CONTRA MONSTROS',goal:MON_CFG.waves,desc:'Sobreviva a '+MON_CFG.waves+' ondas de monstros'};

/* enemyAI original: monstros usam a IA própria (nunca atiram) */
const _monOrigAI=enemyAI;
enemyAI=function(e,dt){if(e.monster){monAI(e,dt);return;}_monOrigAI(e,dt);};
if(typeof trackAI==='function'){const _ot=trackAI;trackAI=function(e,dt){if(e&&e.monster)return;_ot(e,dt);};}

const _monOrigStart=gmStart;
gmStart=function(m){
 if(m!=='monsters'){_monOrigStart(m);return;}
 gmClear();GM.active='monsters';NAV.blk=null;MON_REAR.dist=null;MON_REAR.pc=-1;
 const startW=Math.min(MON_CFG.waves,Math.max(1,window.MON_START_WAVE||1));
 Object.assign(MON,{wave:startW-1,queue:[],spawnT:0,killed:0,breakT:0,inWave:false});
 wave=startW-1;toSpawn=0;
 MON_CFG.maxAlive=(typeof save!=='undefined'&&save.q===-1)?7:11;
 msg('CONTRA MONSTROS: carregando criaturas…',5);
 monLoadAll().then(()=>{
  if(GM.active!=='monsters')return;
  if(!Object.keys(MON.assets).length){msg('Falha ao carregar os modelos dos monstros',5);return;}
   MON.breakT=1.5;msg(startW>1?'CONTRA MONSTROS: começando na ONDA '+startW+'!':'CONTRA MONSTROS: sobreviva a '+MON_CFG.waves+' ondas!',3);
 });
};
const _monOrigUpdate=gmUpdate;
gmUpdate=function(dt){
 if(GM.active!=='monsters'){_monOrigUpdate(dt);return;}
 if(state!=='play'||P.dead||!MON.ready)return;
 monCheckHits();navUpdate(dt);navUpdate(dt,monRearTarget(),MON_REAR);
 toSpawn=0;
 if(!MON.inWave){
  if(MON.breakT>0){MON.breakT-=dt;if(MON.breakT<=0)monStartWave();}
  return;
 }
 const living=enemies.filter(e=>e.monster&&e.state!=='dead').length;
 if(MON.queue.length&&living<MON_CFG.maxAlive){
  MON.spawnT-=dt;
  if(MON.spawnT<=0){const k=MON.queue[MON.queue.length-1];if(monSpawn(k)){MON.queue.pop();updHud();}MON.spawnT=MON.wave<4?.9:.6;}
 }
 if(!MON.queue.length&&living===0&&!(typeof monPwReviving==='function'&&monPwReviving())){
  MON.inWave=false;
  if(MON.wave>(save.monWave||0)){save.monWave=MON.wave;store();}
  if(MON.wave>=MON_CFG.waves){endGame(true);return;}
  /* recompensa entre ondas: munição e um pouco de vida */
  ws.forEach((s,i)=>{s.res+=WEAPONS[i].mag;});P.hp=Math.min(100,P.hp+20);
  MON.breakT=MON_CFG.breakTime;msg('ONDA '+MON.wave+' CONCLUÍDA! Próxima em '+MON_CFG.breakTime+'s  (+20 vida, +munição)',4);SFX.win();updHud();
 }
};
const _monOrigKill=gmOnKill;
gmOnKill=function(e){
 if(GM.active!=='monsters'){_monOrigKill(e);return;}
 if(!e.monster)return;
 MON.killed++;e.dead=0;e.bar.grp.visible=false;
 monBlink(e,false);
 e.hitT=0;if(e.m.acts.death){monPlay(e,'death',.1);}
 save.xp=(save.xp||0)+e.T.pts/10;store();
};
const _monOrigHud=gmHudText;
gmHudText=function(){
 if(GM.active!=='monsters')return _monOrigHud();
 const liv=enemies.filter(e=>e.monster&&e.state!=='dead').length;
 return 'MONSTROS  Onda '+MON.wave+'/'+MON_CFG.waves+'  ·  Vivos '+liv+'  ·  Restam '+monRemaining()+'  ·  Abatidos '+MON.killed;
};
const _monOrigEnd=gmEndTitle;
gmEndTitle=function(win){
 if(GM.active!=='monsters')return _monOrigEnd(win);
 setTimeout(()=>{const es=$('es');if(es&&mode==='monsters')es.innerHTML='Onda alcançada: '+MON.wave+'/'+MON_CFG.waves+'<br>Monstros abatidos: '+MON.killed+'<br>'+es.innerHTML+'<br>Melhor onda (monstros): '+(save.monWave||0);},0);
 return win?'CONTRA MONSTROS — VITÓRIA':'CONTRA MONSTROS — DERROTA (Onda '+MON.wave+')';
};
const _monOrigClear=gmClear;
gmClear=function(){
 for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];if(e.monster)monRecycle(e);}
 Object.assign(MON,{wave:0,queue:[],inWave:false,breakT:0});
 _monOrigClear();
};
/* pré-carrega em segundo plano para entrar no modo rápido */
setTimeout(()=>{try{monLoadAll();}catch(e){console.warn(e);}},3000);
