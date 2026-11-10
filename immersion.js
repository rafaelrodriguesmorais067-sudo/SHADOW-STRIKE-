"use strict";
/* IMERSÃO: ciclo dia/noite, clima, lanterna, visão noturna, efeitos ambientais (mobile-friendly) */

const ENV={
 time:22.5,           // começa de noite para atmosfera horror
 timeSpeed:.008,      // ciclo mais lento (~50 min por dia)
 weather:'clear',     // clear | rain | storm | fog
 weatherT:0,
 weatherNext:90,
 rain:[],
 rainGeo:null,
 rainMat:null,
 rainMesh:null,
 flash:null,          // SpotLight
 flashOn:false,
 nvOn:false,
 nvEl:null,
 wind:0,
 windT:0,
 thunderT:0,
 footprints:[],
 fpPool:[],
 trees:[],
 ambGain:null,
 ambOsc:null,
 enabled:true,
 qFx:1,               // 0-1 scale of effects by quality
 // flashlight extras
 bat:100,             // bateria % (opcional)
 batDrain:0,          // 0 = desativado por padrão
 batEnabled:false,
 flickerT:0,
 emergLights:[]
};

function envQScale(){
 const q=typeof curQ==='function'?curQ():1;
 ENV.qFx=[.35,.55,.8,1][Math.max(0,Math.min(3,q))];
 return ENV.qFx;
}

/* ---------- DIA / NOITE ---------- */
function envSkyColor(h){
 // h: 0-24
 let t=h;
 // cores chave
 const stops=[
  // Noite: céu escuro + chão ainda legível
  {h:0,top:0x0a1020,bot:0x1a1e28,fog:0x121820,sun:0xaabbdd,exp:.78,si:.45,fi:.2},
  {h:5,top:0x1a2840,bot:0x383040,fog:0x2a2838,sun:0xee8866,exp:.85,si:.6,fi:.22},
  {h:6.5,top:0x5a80b0,bot:0xd09060,fog:0xa08070,sun:0xffbb77,exp:.95,si:1.1,fi:.26},
  {h:9,top:0x6a90b8,bot:0xb0c0d0,fog:0x90a0a8,sun:0xffe0b0,exp:1.05,si:1.7,fi:.32},
  {h:12,top:0x6a98b8,bot:0xc0d0e0,fog:0xa0b0b8,sun:0xfff0c8,exp:1.1,si:1.9,fi:.34},
  {h:17,top:0x5a70a0,bot:0xc07040,fog:0xa07050,sun:0xff9955,exp:.9,si:1.2,fi:.24},
  {h:19,top:0x2a3450,bot:0x4a3848,fog:0x383848,sun:0xee7755,exp:.8,si:.55,fi:.2},
  {h:21,top:0x0c1424,bot:0x1c2028,fog:0x141a22,sun:0xaabbdd,exp:.75,si:.42,fi:.18},
  {h:24,top:0x0a1020,bot:0x1a1e28,fog:0x121820,sun:0xaabbdd,exp:.78,si:.45,fi:.2}
 ];
 let a=stops[0],b=stops[1];
 for(let i=0;i<stops.length-1;i++){
  if(t>=stops[i].h&&t<=stops[i+1].h){a=stops[i];b=stops[i+1];break;}
 }
 const u=(t-a.h)/Math.max(.001,b.h-a.h);
 const lerp=(x,y)=>x+(y-x)*u;
 const lerpC=(c1,c2)=>{
  const r1=(c1>>16)&255,g1=(c1>>8)&255,b1=c1&255;
  const r2=(c2>>16)&255,g2=(c2>>8)&255,b2=c2&255;
  const r=r1+(r2-r1)*u|0,g=g1+(g2-g1)*u|0,bl=b1+(b2-b1)*u|0;
  return (r<<16)|(g<<8)|bl;
 };
 return {
  top:lerpC(a.top,b.top),bot:lerpC(a.bot,b.bot),fog:lerpC(a.fog,b.fog),
  sun:lerpC(a.sun,b.sun),exp:lerp(a.exp,b.exp),si:lerp(a.si,b.si),fi:lerp(a.fi,b.fi),
  night:t<6||t>20
 };
}

function envHexToCss(hex){
 const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255;
 return 'rgb('+r+','+g+','+b+')';
}

function envUpdateSkyTexture(col){
 if(!window.__sky||!window.__sky.material||!window.__sky.material.map)return;
 const tex=window.__sky.material.map;
 const c=tex.image; if(!c||!c.getContext)return;
 const g=c.getContext('2d');
 const top=envHexToCss(col.top), bot=envHexToCss(col.bot), fog=envHexToCss(col.fog);
 const gr=g.createLinearGradient(0,0,0,c.height);
 if(col.night){
  // Céu noturno escuro com horizonte um pouco mais claro
  gr.addColorStop(0,top);
  gr.addColorStop(0.45,top);
  gr.addColorStop(0.7,fog);
  gr.addColorStop(1,bot);
  g.fillStyle=gr;g.fillRect(0,0,c.width,c.height);
  // estrelas
  g.fillStyle='rgba(220,230,255,0.9)';
  for(let i=0;i<90;i++){
   const x=Math.random()*c.width, y=Math.random()*c.height*0.55;
   const r=Math.random()<0.15?1.4:0.7;
   g.globalAlpha=0.35+Math.random()*0.55;
   g.beginPath();g.arc(x,y,r,0,6.28);g.fill();
  }
  g.globalAlpha=1;
 }else{
  gr.addColorStop(0,top);
  gr.addColorStop(0.35,top);
  gr.addColorStop(0.55,fog);
  gr.addColorStop(1,bot);
  g.fillStyle=gr;g.fillRect(0,0,c.width,c.height);
  // nuvens suaves de dia
  for(let i=0;i<28;i++){
   const x=Math.random()*c.width,y=40+Math.random()*70,r=16+Math.random()*40;
   g.save();g.translate(x,y);g.scale(1.8,0.5);
   const cg=g.createRadialGradient(0,0,0,0,0,r);
   cg.addColorStop(0,'rgba(255,255,255,0.35)');cg.addColorStop(1,'rgba(255,255,255,0)');
   g.fillStyle=cg;g.beginPath();g.arc(0,0,r,0,6.28);g.fill();g.restore();
  }
 }
 tex.needsUpdate=true;
}

function envEnsureMoon(){
 if(window.__moonGlow)return;
 // textura simples de lua
 const c=document.createElement('canvas');c.width=c.height=64;
 const g=c.getContext('2d');
 const rg=g.createRadialGradient(28,28,4,32,32,30);
 rg.addColorStop(0,'rgba(255,255,240,1)');
 rg.addColorStop(0.45,'rgba(220,230,255,0.85)');
 rg.addColorStop(0.75,'rgba(180,200,255,0.25)');
 rg.addColorStop(1,'rgba(120,140,200,0)');
 g.fillStyle=rg;g.beginPath();g.arc(32,32,30,0,6.28);g.fill();
 // crateras sutis
 g.fillStyle='rgba(160,170,190,0.35)';
 g.beginPath();g.arc(22,26,5,0,6.28);g.fill();
 g.beginPath();g.arc(38,34,4,0,6.28);g.fill();
 g.beginPath();g.arc(28,40,3,0,6.28);g.fill();
 const mat=new THREE.SpriteMaterial({
  map:new THREE.CanvasTexture(c),
  color:0xe8f0ff,
  blending:THREE.AdditiveBlending,
  fog:false,depthWrite:false,transparent:true,opacity:0
 });
 const moon=new THREE.Sprite(mat);
 moon.scale.set(28,28,1);
 moon.renderOrder=-1;
 moon.frustumCulled=false;
 moon.userData.dir=new THREE.Vector3(0.4,0.7,-0.3).normalize();
 moon.onBeforeRender=function(r,sc,cm){
  if(!this.visible)return;
  const d=this.userData.dir;
  this.position.copy(cm.position).addScaledVector(d,110);
 };
 scene.add(moon);
 window.__moonGlow=moon;
}

function envApplyLighting(col){
 if(typeof sun==='undefined')return;
 sun.color.setHex(col.sun);
 sun.intensity=col.si*(ENV.weather==='storm'?.7:ENV.weather==='fog'?.85:1);
 if(typeof fill!=='undefined')fill.intensity=col.fi;
 if(typeof hemi!=='undefined'){
  hemi.color.setHex(col.top);
  hemi.groundColor.setHex(col.bot);
  hemi.intensity=col.night?.55:.85;
 }
 if(typeof fill!=='undefined'&&col.night)fill.intensity=Math.min(fill.intensity,.22);
 if(typeof renderer!=='undefined')renderer.toneMappingExposure=col.exp*(ENV.weather==='fog'?.85:1);

 // posição do sol/lua no céu
 const ang=((ENV.time-6)/12)*Math.PI;
 const elev=Math.sin(ang);
 const az=Math.cos(ang);
 if(col.night){
  // Lua no lado oposto / altura moderada
  const mang=((ENV.time-18)/12)*Math.PI;
  const me=Math.max(0.25,Math.sin(mang));
  const ma=Math.cos(mang);
  sun.position.set(ma*50, me*40+8, -20);
  sun.intensity=Math.max(sun.intensity,0.35);
  sun.color.setHex(0xc8d4f0);
 }else{
  sun.position.set(az*50,Math.max(.5,elev*55)+5,20);
 }

 // Sol (dia) vs Lua (noite)
 envEnsureMoon();
 if(window.__sunGlow){
  window.__sunGlow.visible=!col.night;
  if(!col.night){
   window.__sunGlow.position.copy(sun.position).normalize().multiplyScalar(90);
   window.__sunGlow.material.opacity=0.7;
   window.__sunGlow.material.color.setHex(0xfff2c0);
  }
 }
 if(window.__moonGlow){
  window.__moonGlow.visible=!!col.night;
  if(col.night){
   window.__moonGlow.userData.dir.copy(sun.position).normalize();
   window.__moonGlow.material.opacity=0.95;
  }else{
   window.__moonGlow.material.opacity=0;
  }
 }

 // Atualiza textura do céu só quando muda o modo dia/noite ou a cada ~2s
 if(ENV._lastSkyNight!==col.night || !ENV._skyT || ENV._skyT<=0){
  envUpdateSkyTexture(col);
  ENV._lastSkyNight=col.night;
  ENV._skyT=2.5;
 }

 // fog + background
 const fogNear=ENV.weather==='fog'?14:ENV.weather==='storm'?20:ENV.weather==='rain'?30:col.night?35:48;
 const fogFar=ENV.weather==='fog'?58:ENV.weather==='storm'?80:ENV.weather==='rain'?110:col.night?125:155;
 if(scene.fog){
  scene.fog.color.setHex(col.fog);
  scene.fog.near=fogNear;scene.fog.far=fogFar;
 }
 scene.background.setHex(col.fog);
}

/* ---------- CLIMA ---------- */
function envSetWeather(w){
 ENV.weather=w;
 ENV.weatherT=0;
 const names={clear:'Céu limpo',rain:'Chuva',storm:'Tempestade',fog:'Neblina'};
 if(typeof msg==='function')msg(names[w]||w,2);
}

function envPickWeather(){
 const r=Math.random();
 if(r<.45)envSetWeather('clear');
 else if(r<.7)envSetWeather('rain');
 else if(r<.85)envSetWeather('fog');
 else envSetWeather('storm');
 ENV.weatherNext=60+Math.random()*120;
}

function envInitRain(){
 if(ENV.rainMesh)return;
 const n=Math.floor(400*envQScale());
 const pos=new Float32Array(n*3);
 for(let i=0;i<n;i++){
  pos[i*3]=(Math.random()-.5)*40;
  pos[i*3+1]=Math.random()*20;
  pos[i*3+2]=(Math.random()-.5)*40;
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
 const mat=new THREE.PointsMaterial({
  color:0xaaccff,size:.12,transparent:true,opacity:.55,
  depthWrite:false,fog:true
 });
 ENV.rainMesh=new THREE.Points(geo,mat);
 ENV.rainMesh.visible=false;
 ENV.rainMesh.frustumCulled=false;
 scene.add(ENV.rainMesh);
 ENV.rainCount=n;
}

function envUpdateRain(dt){
 if(!ENV.rainMesh)return;
 const on=ENV.weather==='rain'||ENV.weather==='storm';
 ENV.rainMesh.visible=on&&ENV.enabled;
 if(!on)return;
 ENV.rainMesh.position.set(P.x,P.y,P.z);
 const arr=ENV.rainMesh.geometry.attributes.position.array;
 const spd=ENV.weather==='storm'?28:16;
 for(let i=0;i<ENV.rainCount;i++){
  arr[i*3+1]-=spd*dt*(.7+Math.random()*.6);
  arr[i*3]+=ENV.wind*dt*3;
  if(arr[i*3+1]<0){
   arr[i*3]=(Math.random()-.5)*40;
   arr[i*3+1]=12+Math.random()*10;
   arr[i*3+2]=(Math.random()-.5)*40;
  }
 }
 ENV.rainMesh.geometry.attributes.position.needsUpdate=true;
 ENV.rainMesh.material.opacity=ENV.weather==='storm'?.7:.45;
}

function envThunder(dt){
 if(ENV.weather!=='storm')return;
 ENV.thunderT-=dt;
 if(ENV.thunderT<=0){
  ENV.thunderT=4+Math.random()*10;
  // flash
  const prev=renderer.toneMappingExposure;
  renderer.toneMappingExposure=Math.min(2.2,prev+1.2);
  setTimeout(()=>{if(renderer)renderer.toneMappingExposure=prev;},80);
  setTimeout(()=>{if(renderer)renderer.toneMappingExposure=Math.min(2,prev+.5);setTimeout(()=>{renderer.toneMappingExposure=prev;},60);},160);
  if(typeof SFX!=='undefined'&&SFX.boom)setTimeout(()=>SFX.boom(),200+Math.random()*400);
 }
}

/* ---------- LANTERNA / VISÃO NOTURNA ---------- */
function envInitFlash(){
 if(ENV.flash)return;
 // SpotLight realista: ângulo ~42°, alcance 24m, penumbra suave, decay físico
 ENV.flash=new THREE.SpotLight(0xfff4e0,0,26,0.48,0.65,1.4);
 ENV.flash.castShadow=false; // ativado só em qualidade alta para performance
 ENV.flash.shadow.mapSize.set(512,512);
 ENV.flash.shadow.bias=-0.0005;
 ENV.flash.shadow.normalBias=0.02;
 ENV.flash.shadow.camera.near=0.3;
 ENV.flash.shadow.camera.far=22;
 cam.add(ENV.flash);
 ENV.flash.position.set(0.18,-0.12,-0.15); // posição tipo lanterna na mão/ombro
 const tgt=new THREE.Object3D();
 tgt.position.set(0,0,-14);
 cam.add(tgt);
 ENV.flash.target=tgt;
 ENV.flash.intensity=0;
 ENV.flash.visible=true;
}

function envFlashIntensity(){
 // Útil à noite, sem ofuscar
 const night=typeof ENV.time==='number'&&(ENV.time<6||ENV.time>19.5);
 let base=night?2.8:1.2;
 if(ENV.batEnabled&&ENV.bat<20)base*=0.4+ENV.bat/50;
 if(ENV.flickerT>0)base*=0.35+Math.random()*0.7;
 return base;
}

function envToggleFlash(){
 envInitFlash();
 ENV.flashOn=!ENV.flashOn;
 if(ENV.nvOn&&ENV.flashOn)envToggleNV(); // não usa os dois juntos
 const q=typeof curQ==='function'?curQ():1;
 if(ENV.flashOn){
  ENV.flash.intensity=envFlashIntensity();
  // sombras só em qualidade alta/ultra para não matar FPS em mobile
  ENV.flash.castShadow=q>=2&&renderer&&renderer.shadowMap.enabled;
 }else{
  ENV.flash.intensity=0;
  ENV.flash.castShadow=false;
 }
 // atualiza botão visual
 const btn=$('flashbtn');
 if(btn)btn.classList.toggle('on',ENV.flashOn);
 if(typeof msg==='function')msg(ENV.flashOn?'Lanterna ON':'Lanterna OFF',1);
 if(typeof SFX!=='undefined'&&SFX.ui)SFX.ui();
}

function envUpdateFlash(dt){
 if(!ENV.flash||!ENV.flashOn)return;
 // bateria opcional
 if(ENV.batEnabled){
  ENV.bat=Math.max(0,ENV.bat-ENV.batDrain*dt);
  if(ENV.bat<=0){ENV.flashOn=false;ENV.flash.intensity=0;ENV.flash.castShadow=false;const btn=$('flashbtn');if(btn)btn.classList.remove('on');if(typeof msg==='function')msg('Bateria da lanterna esgotada',2);return;}
  if(ENV.bat<15&&Math.random()<0.02)ENV.flickerT=0.15+Math.random()*0.25;
 }
 if(ENV.flickerT>0)ENV.flickerT-=dt;
 ENV.flash.intensity=envFlashIntensity();
}

function envEnsureNV(){
 if(ENV.nvEl)return;
 const d=document.createElement('div');
 d.id='nvfx';
 d.style.cssText='display:none;position:fixed;inset:0;z-index:15;pointer-events:none;background:radial-gradient(ellipse at center,rgba(20,80,30,.25) 0%,rgba(0,40,10,.55) 100%);mix-blend-mode:multiply';
 d.innerHTML='<div style="position:absolute;inset:0;box-shadow:inset 0 0 80px #000,inset 0 0 40px #020;border:3px solid #1a3a1a;opacity:.8"></div>';
 document.body.appendChild(d);
 ENV.nvEl=d;
}

function envToggleNV(){
 envEnsureNV();
 ENV.nvOn=!ENV.nvOn;
 if(ENV.flashOn&&ENV.nvOn){ENV.flashOn=false;if(ENV.flash)ENV.flash.intensity=0;}
 ENV.nvEl.style.display=ENV.nvOn?'block':'none';
 if(typeof renderer!=='undefined'){
  // slight green lift
  if(ENV.nvOn)renderer.toneMappingExposure=Math.max(renderer.toneMappingExposure,1.1);
 }
 if(typeof msg==='function')msg(ENV.nvOn?'Visão noturna ON':'Visão noturna OFF',1);
 if(typeof SFX!=='undefined'&&SFX.ui)SFX.ui();
}

/* ---------- PEGADAS ---------- */
function envInitFootprints(){
 for(let i=0;i<20;i++){
  const m=new THREE.Mesh(
   new THREE.CircleGeometry(.12,6),
   new THREE.MeshBasicMaterial({color:0x3a3228,transparent:true,opacity:.35,depthWrite:false})
  );
  m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);
  ENV.fpPool.push(m);
 }
}

let _fpCD=0,_fpSide=1;
function envFootprint(dt){
 if(!ENV.fpPool.length||typeof P==='undefined')return;
 if(ENV.weather==='rain'||ENV.weather==='storm'){
  // rain washes prints faster
  ENV.fpPool.forEach(m=>{if(m.visible){m.material.opacity-=dt*.25;if(m.material.opacity<=0)m.visible=false;}});
 }else{
  ENV.fpPool.forEach(m=>{if(m.visible){m.material.opacity-=dt*.08;if(m.material.opacity<=0)m.visible=false;}});
 }
 if(typeof MV==='undefined'||!P.ground||MV.hs<1.2)return;
 _fpCD-=dt;
 if(_fpCD>0)return;
 _fpCD=.32;
 const m=ENV.fpPool[_fpSide>0?0:1];
 // cycle pool
 const idx=ENV.fpPool.findIndex(x=>!x.visible);
 const fp=ENV.fpPool[idx>=0?idx:(Math.random()*ENV.fpPool.length)|0];
 const side=_fpSide*.12;_fpSide*=-1;
 const sy=Math.sin(P.yaw),cy=Math.cos(P.yaw);
 fp.position.set(P.x+cy*side,0.02,P.z-sy*side);
 fp.rotation.z=-P.yaw;
 fp.material.opacity=.4;
 fp.visible=true;
}

/* ---------- VENTO NAS ÁRVORES ---------- */
function envCollectTrees(){
 if(ENV.trees.length||typeof world==='undefined')return;
 world.traverse(o=>{
  if(o.isMesh&&o.parent&&o.parent!==world){
   // group trees by root under world with scale
  }
 });
 // store top-level children that look like trees (have many meshes)
 world.children.forEach(c=>{
  if(c.isGroup||(c.children&&c.children.length>2)){
   if(!c.userData)c.userData={};
   if(c.userData.envTree)return;
   // heuristic: tall thin
   c.userData.envTree=true;
   c.userData.baseRy=c.rotation.y;
   ENV.trees.push(c);
  }
 });
}

function envWindTrees(dt){
 ENV.windT+=dt;
 ENV.wind=Math.sin(ENV.windT*.7)*.4+(ENV.weather==='storm'?1.2:ENV.weather==='rain'?.6:.2);
 if(!ENV.trees.length)return;
 const amp=ENV.wind*.04*ENV.qFx;
 ENV.trees.forEach((t,i)=>{
  t.rotation.z=Math.sin(ENV.windT*1.3+i)*.5*amp;
  t.rotation.x=Math.cos(ENV.windT*1.1+i*.7)*.3*amp;
 });
}

/* ---------- ÁUDIO AMBIENTE SIMPLES ---------- */
function envAmbStart(){
 if(ENV.ambGain||typeof AC==='undefined'||!AC)return;
 try{
  ENV.ambGain=AC.createGain();ENV.ambGain.gain.value=0;
  ENV.ambGain.connect(AC.destination);
  // brown-ish noise via looped buffer
  const n=2*AC.sampleRate,buf=AC.createBuffer(1,n,AC.sampleRate);
  const d=buf.getChannelData(0);
  let last=0;
  for(let i=0;i<n;i++){last=(last+(.02*Math.random()*2-1)*.1)*.98;d[i]=last*3;}
  const src=AC.createBufferSource();src.buffer=buf;src.loop=true;
  src.connect(ENV.ambGain);src.start();
  ENV.ambSrc=src;
 }catch(e){}
}

function envUpdateAmb(){
 if(!ENV.ambGain)return;
 let target=0;
 if(ENV.weather==='rain')target=.04*save.vol;
 if(ENV.weather==='storm')target=.07*save.vol;
 if(ENV.weather==='fog')target=.02*save.vol;
 ENV.ambGain.gain.value+=(target-ENV.ambGain.gain.value)*.05;
}

/* ---------- UPDATE PRINCIPAL ---------- */
function envUpdate(dt){
 if(!ENV.enabled||typeof state==='undefined'||state!=='play'){
  if(ENV.rainMesh)ENV.rainMesh.visible=false;
  return;
 }
 ENV.time=(ENV.time+ENV.timeSpeed*dt)%24;
 if(ENV._skyT>0)ENV._skyT-=dt;
 const col=envSkyColor(ENV.time);
 // night vision brightens perception of night
 if(ENV.nvOn){col.exp=Math.max(col.exp,1.05);col.si=Math.max(col.si,.4);}
 envApplyLighting(col);

 ENV.weatherT+=dt;
 if(ENV.weatherT>=ENV.weatherNext)envPickWeather();

 envUpdateRain(dt);
 envThunder(dt);
 /* pegadas: tracks.js */ if(typeof trackUpdateAll==='function')trackUpdateAll(dt);
 /* vento: vegetation.js */ if(typeof vegUpdate==='function')vegUpdate(dt);
 envUpdateAmb();

 // flashlight follows look - already parented to cam
 envUpdateFlash(dt);
 // atualiza luzes de emergência (pisca ocasional)
 if(ENV.emergLights&&ENV.emergLights.length){
  ENV.emergLights.forEach((L,i)=>{
   if(L.userData.flick){
    L.userData.t=(L.userData.t||0)-dt;
    if(L.userData.t<=0){
     L.intensity=L.userData.base*(0.15+Math.random()*0.9);
     L.userData.t=0.05+Math.random()*0.35;
    }
   }
  });
 }
}

function envInitEmergLights(){
 if(ENV.emergLights.length)return;
 // Luzes vermelhas de emergência sutis em pontos-chave do mapa (atmosfera militar abandonada)
 const pts=[
  {x:12,y:3.2,z:-8,c:0xff2200,i:.28},
  {x:-14,y:2.8,z:10,c:0xff1800,i:.22},
  {x:0,y:4.5,z:-28,c:0xff3000,i:.32},
  {x:18,y:2.5,z:18,c:0xff1a00,i:.2},
  {x:-8,y:3.0,z:-18,c:0xff2200,i:.25}
 ];
 pts.forEach(p=>{
  const L=new THREE.PointLight(p.c,p.i,14,2);
  L.position.set(p.x,p.y,p.z);
  L.castShadow=false;
  L.userData={base:p.i,flick:true,t:Math.random()*2};
  scene.add(L);
  ENV.emergLights.push(L);
 });
}

function envInit(){
 envQScale();
 envInitRain();
 envInitFlash();
 envEnsureNV();
 envInitFootprints();
 envInitEmergLights();
 setTimeout(envCollectTrees,2000);
 // Começa de noite (horror) — 21h a 23h30
 ENV.time=21+Math.random()*2.5;
 ENV.weather=Math.random()<.35?'fog':(Math.random()<.2?'rain':'clear');
 ENV.weatherNext=70+Math.random()*80;
 if(typeof initAudio==='function'){/* amb after audio */}
 setTimeout(envAmbStart,1500);
 // aplica lighting inicial
 const col=envSkyColor(ENV.time);
 envApplyLighting(col);
}

/* API para UI / teclas */
function envCycleWeather(){
 const order=['clear','rain','fog','storm'];
 const i=order.indexOf(ENV.weather);
 envSetWeather(order[(i+1)%order.length]);
 ENV.weatherNext=9999; // hold until user cycles again or long time
}

// HUD clock helper
function envTimeStr(){
 const h=ENV.time|0,m=((ENV.time-h)*60)|0;
 return (h<10?'0':'')+h+':'+(m<10?'0':'')+m+(ENV.weather!=='clear'?' · '+ENV.weather:'');
}
