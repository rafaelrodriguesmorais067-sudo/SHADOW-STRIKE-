"use strict";
/* GRAPHICS v14 — Overhaul visual
   - Presets de iluminação (AUTO / DIA LIMPO / NUBLADO / ENTARDECER / NOITE HORROR) com noite muito mais legível
   - Materiais PBR: normal map + roughness map gerados das texturas procedurais, sujeira/ferrugem/rachaduras, IBL (PMREM do céu)
   - Sombras de alta resolução que seguem o jogador (texel snapping = sem tremido)
   - Lanterna refinada (feixe volumétrico sutil), luz de disparo e de explosão em pool (sem recompilar shaders)
   - Fumaça/fogo/poeira em sprites, marcas de bala, queimaduras e detritos no chão
   - Resolução adaptativa automática e upgrade de materiais Lambert -> PBR nos modelos
   Carrega depois de immersion.js/vegetation.js e antes de game.js. */

const GFX={preset:'auto',skyKey:'',pmrem:null,envRT:null,dyn:1,fpsAvg:60,dynT:0,convT:0,boomL:null,boomT:0,muzzleL:null,
 beam:null,fx:[],fxi:0,matCache:new Map(),inited:false,col:null,emergSpr:[]};
const GQ=()=>(typeof curQ==='function'?curQ():1);
const GMOB=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
let gseed=777;function grnd(){gseed=(gseed*16807)%2147483647;return (gseed-1)/2147483646;}

/* ================= PRESETS DE ILUMINAÇÃO ================= */
/* hemiS/hemiG = céu/chão da HemisphereLight (independentes do céu visível, por isso a noite fica legível) */
const GPRE={
 day:{h:12,top:0x3f7fcc,mid:0x86b6e2,bot:0xd6e2ea,fog:0xb9cbd8,sun:0xfff0d4,si:2.5,hemiS:0xd4e6f7,hemiG:0x5e5640,hi:.95,fillC:0xa8c4e0,fi:.42,
  exp:1.0,env:.85,fogN:60,fogF:200,stars:0,clouds:.6,cloudC:[255,255,255],dir:[.45,.82,.35],glow:.75,emerg:0,shR:1},
 cloudy:{h:11,top:0x7d8a97,mid:0x9ea8b1,bot:0xb9bec2,fog:0xa6adb3,sun:0xe6ebf0,si:.95,hemiS:0xcdd5dd,hemiG:0x5a574c,hi:1.45,fillC:0xb8c4cc,fi:.5,
  exp:1.06,env:1.0,fogN:40,fogF:160,stars:0,clouds:1.6,cloudC:[205,210,216],dir:[.3,.9,.25],glow:.18,emerg:.15,shR:3},
 evening:{h:18.6,top:0x23345e,mid:0x7d6a86,bot:0xe0904c,fog:0x7a6064,sun:0xff9450,si:1.7,hemiS:0x7f94c4,hemiG:0x5a4232,hi:1.05,fillC:0x6a86c8,fi:.5,
  exp:1.02,env:.6,fogN:36,fogF:160,stars:.25,clouds:.8,cloudC:[255,170,120],dir:[.88,.24,.32],glow:.9,emerg:.6,shR:1.5},
 night:{h:23,top:0x070e1e,mid:0x0f1a2e,bot:0x222c40,fog:0x18202e,sun:0xa9c2ff,si:.75,hemiS:0x6377a6,hemiG:0x2c2a26,hi:.78,fillC:0x4e6694,fi:.34,
  exp:.96,env:.4,fogN:24,fogF:112,stars:1,clouds:.35,cloudC:[90,100,130],dir:[-.42,.72,-.38],glow:0,emerg:1,shR:2,night:1}
};
/* AUTO: ciclo contínuo misturando os presets pelo horário */
const GKEYS=[[0,'night'],[5,'night'],[6.6,'evening'],[8.8,'day'],[16.2,'day'],[18.6,'evening'],[20.4,'night'],[24,'night']];
function gLerpC(a,b,u){const r=((a>>16)&255)+((((b>>16)&255)-((a>>16)&255))*u),g=((a>>8)&255)+((((b>>8)&255)-((a>>8)&255))*u),bl=(a&255)+(((b&255)-(a&255))*u);return (r<<16)|(g<<8)|bl;}
function gMix(A,B,u){
 const o={};
 for(const k in A){const a=A[k],b=B[k];
  if(k==='dir'||k==='cloudC')o[k]=a.map((v,i)=>v+(b[i]-v)*u);
  else if(typeof a==='number'&&k!=='h'&&/^(top|mid|bot|fog|sun|hemiS|hemiG|fillC)$/.test(k))o[k]=gLerpC(a,b,u);
  else if(typeof a==='number')o[k]=a+((b===undefined?0:b)-a)*u;}
 o.night=(A.night||0)+((B.night||0)-(A.night||0))*u;
 return o;
}
function gPresetCol(h){
 if(GFX.preset!=='auto'&&GPRE[GFX.preset])return Object.assign({},GPRE[GFX.preset]);
 let a=GKEYS[0],b=GKEYS[1];
 for(let i=0;i<GKEYS.length-1;i++)if(h>=GKEYS[i][0]&&h<=GKEYS[i+1][0]){a=GKEYS[i];b=GKEYS[i+1];break;}
 const u=(h-a[0])/Math.max(.001,b[0]-a[0]),s=u*u*(3-2*u);
 return gMix(GPRE[a[1]],GPRE[b[1]],s);
}
/* substitui a função original (mesma assinatura e campos usados por immersion.js) */
envSkyColor=function(h){
 const c=gPresetCol(h);
 c.night=c.night>.5;
 c.exp=c.exp; c.fi=c.fi;
 return c;
};

/* ---------- céu ---------- */
function gCss(hex,a){return 'rgba('+((hex>>16)&255)+','+((hex>>8)&255)+','+(hex&255)+','+(a===undefined?1:a)+')';}
envUpdateSkyTexture=function(col){
 if(!window.__sky||!window.__sky.material.map)return;
 const tex=window.__sky.material.map,c=tex.image,g=c.getContext('2d'),W=c.width,H=c.height;
 const gr=g.createLinearGradient(0,0,0,H);
 gr.addColorStop(0,gCss(col.top));gr.addColorStop(.3,gCss(col.top));gr.addColorStop(.43,gCss(col.mid));gr.addColorStop(.5,gCss(col.fog));gr.addColorStop(1,gCss(col.fog));
 g.fillStyle=gr;g.fillRect(0,0,W,H);
 gseed=4242;
 if(col.stars>.02){for(let i=0;i<160;i++){const x=grnd()*W,y=grnd()*H*.46,r=grnd()<.12?1.3:.6;g.globalAlpha=(.25+grnd()*.6)*col.stars;g.fillStyle='#dfe8ff';g.beginPath();g.arc(x,y,r,0,6.28);g.fill();}g.globalAlpha=1;}
 const n=Math.round(30*col.clouds),cc=col.cloudC.map(v=>v|0).join(',');
 for(let i=0;i<n;i++){const x=grnd()*W,y=40+grnd()*72,r=14+grnd()*40;g.save();g.translate(x,y);g.scale(2,.5);
  const cg=g.createRadialGradient(0,0,0,0,0,r);cg.addColorStop(0,'rgba('+cc+','+(.14+.14*Math.min(1,col.clouds/1.6))+')');cg.addColorStop(1,'rgba('+cc+',0)');
  g.fillStyle=cg;g.beginPath();g.arc(0,0,r,0,6.28);g.fill();g.restore();}
 tex.needsUpdate=true;
 gUpdateEnvMap(c);
};
function gUpdateEnvMap(c){
 if(GQ()===0||!THREE.PMREMGenerator)return;
 try{
  if(!GFX.pmrem){GFX.pmrem=new THREE.PMREMGenerator(renderer);}
  const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.encoding=THREE.sRGBEncoding;
  const rt=GFX.pmrem.fromEquirectangular(t);t.dispose();
  if(GFX.envRT)GFX.envRT.dispose();GFX.envRT=rt;scene.environment=rt.texture;
 }catch(e){console.warn('PMREM off',e);GFX.pmrem=null;scene.environment=null;}
}

/* ---------- aplicação da luz (substitui a original) ---------- */
const _gDir=new THREE.Vector3();
envApplyLighting=function(col){
 GFX.col=col;
 const w=ENV.weather,wk=w==='storm'?.8:w==='rain'?.6:w==='fog'?.55:0;  // quanto o tempo nublado pesa
 const bri=save.bri||1;
 sun.color.setHex(col.sun);
 sun.intensity=col.si*(1-wk*.65);
 hemi.color.setHex(col.hemiS);hemi.groundColor.setHex(col.hemiG);
 hemi.intensity=col.hi*(1+wk*(col.night?.05:.25));
 fill.color.setHex(col.fillC);fill.intensity=col.fi*(1+wk*.3);
 renderer.toneMappingExposure=col.exp*bri*(ENV.nvOn?1.15:1)*(w==='storm'?.94:1);
 _gDir.set(col.dir[0],col.dir[1],col.dir[2]).normalize();
 /* sol / lua */
 if(window.__sunGlow){window.__sunGlow.visible=col.glow>.02&&!col.night;window.__sunGlow.material.opacity=col.glow*(1-wk*.8);window.__sunGlow.material.color.setHex(col.sun);}
 if(typeof envEnsureMoon==='function')envEnsureMoon();
 if(window.__moonGlow){window.__moonGlow.visible=!!col.night;window.__moonGlow.userData.dir.copy(_gDir);window.__moonGlow.material.opacity=.95*(1-wk*.6);}
 /* céu + IBL só quando muda de verdade */
 const key=[col.top,col.fog,col.mid,Math.round(col.stars*10),Math.round(col.clouds*10),w==='clear'?0:1].join('|');
 if(key!==GFX.skyKey){GFX.skyKey=key;const cc=Object.assign({},col);if(wk>0){cc.clouds=Math.max(cc.clouds,1.4);cc.stars*=.2;}envUpdateSkyTexture(cc);}
 /* IBL */
 for(const k in GMATS){const m=GMATS[k];if(m&&m.isMeshStandardMaterial)m.envMapIntensity=(m.userData.envK||1)*col.env;}
 GFX.envK=col.env;
 /* neblina: sempre mais longe que a versão antiga para manter leitura dos inimigos */
 const fn=w==='fog'?18:w==='storm'?24:w==='rain'?30:col.fogN, ff=w==='fog'?78:w==='storm'?96:w==='rain'?125:col.fogF;
 let fc=col.fog;if(wk>0)fc=gLerpC(fc,col.night?0x1e2530:0x8e979e,wk*.6);
 scene.fog.color.setHex(fc);scene.fog.near=fn;scene.fog.far=ff;scene.background.setHex(fc);
 /* emergência */
 GFX.emergK=col.emerg;
};
function gSetLightDirFollow(){
 const px=typeof P!=='undefined'?P.x:0,pz=typeof P!=='undefined'?P.z:0;
 const ms=sun.shadow.mapSize.x||1024,ext=sun.shadow.camera.right||40,texel=2*ext/ms;
 const sx=Math.round(px/texel)*texel,sz=Math.round(pz/texel)*texel;
 sun.target.position.set(sx,0,sz);sun.target.updateMatrixWorld();
 sun.position.set(sx+_gDir.x*90,_gDir.y*90,sz+_gDir.z*90);
}
function gSetPresetTime(){
 if(GFX.preset!=='auto'&&GPRE[GFX.preset]){ENV.time=GPRE[GFX.preset].h;}
}
function gfxSetPreset(p){
 GFX.preset=GPRE[p]?p:'auto';GFX.skyKey='';
 if(GFX.preset==='auto'&&!(ENV.time>=0))ENV.time=22;
 gSetPresetTime();
 envApplyLighting(envSkyColor(ENV.time));gSetLightDirFollow();
}
function gfxRefresh(){envApplyLighting(envSkyColor(ENV.time));}

/* ================= TEXTURAS: desgaste + mapas PBR ================= */
function gWeather(name,g,s){
 const k=s/256;gseed=name.length*977+13;
 const streaks=(n,col,a,len)=>{for(let i=0;i<n;i++){const x=grnd()*s,w=(2+grnd()*10)*k,y=grnd()*s*.3,gr=g.createLinearGradient(0,y,0,y+s*len);gr.addColorStop(0,'rgba('+col+','+a+')');gr.addColorStop(1,'rgba('+col+',0)');g.fillStyle=gr;g.fillRect(x,y,w,s*len);}};
 const blots=(n,col,a,r0,r1)=>{for(let i=0;i<n;i++){const x=grnd()*s,y=grnd()*s,r=(r0+grnd()*(r1-r0))*s,gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba('+col+','+a+')');gr.addColorStop(1,'rgba('+col+',0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}};
 const cracks=(n,col,lw)=>{g.strokeStyle=col;for(let i=0;i<n;i++){g.lineWidth=(lw*(.5+grnd()))*k;g.beginPath();let x=grnd()*s,y=grnd()*s;g.moveTo(x,y);for(let j=0;j<7;j++){x+=(grnd()-.5)*s*.12;y+=(grnd()-.5)*s*.12;g.lineTo(x,y);}g.stroke();}};
 const scratches=(n,col)=>{g.strokeStyle=col;g.lineWidth=.8*k;for(let i=0;i<n;i++){const x=grnd()*s,y=grnd()*s,a=grnd()*6.28,l=(6+grnd()*30)*k;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}};
 const holes=(n)=>{for(let i=0;i<n;i++){const x=grnd()*s,y=grnd()*s,r=(1.2+grnd()*1.6)*k;g.fillStyle='rgba(20,18,16,.85)';g.beginPath();g.arc(x,y,r,0,6.28);g.fill();g.strokeStyle='rgba(200,195,185,.35)';g.lineWidth=k;g.beginPath();g.arc(x,y,r*1.8,0,6.28);g.stroke();}};
 switch(name){
  case 'concrete':streaks(8,'35,32,28',.14,.55);blots(7,'60,58,50',.2,.06,.2);cracks(3,'rgba(50,48,44,.45)',.9);holes(2);break;
  case 'brick':streaks(7,'25,20,18',.35,.5);blots(5,'30,26,22',.3,.08,.2);blots(3,'90,110,70',.15,.05,.12);holes(5);break;
  case 'contBlue':case 'contRust':streaks(14,'110,55,25',.42,.45);blots(8,'120,60,25',.35,.03,.1);scratches(60,'rgba(210,205,195,.35)');holes(3);break;
  case 'asphalt':blots(7,'15,15,17',.4,.05,.14);blots(5,'95,92,85',.18,.08,.2);cracks(4,'rgba(22,22,24,.45)',.7);break;
  case 'grass':blots(16,'138,128,70',.32,.05,.14);blots(12,'48,72,30',.35,.05,.12);blots(6,'95,78,52',.35,.04,.1);break;
  case 'wood':for(let i=0;i<10;i++){const x=grnd()*s,y=grnd()*s,r=(3+grnd()*5)*k;g.strokeStyle='rgba(55,35,18,.55)';g.lineWidth=k;g.beginPath();g.ellipse(x,y,r*.6,r*1.6,0,0,6.28);g.stroke();}streaks(5,'40,28,15',.3,.5);break;
  case 'roof':blots(10,'70,85,50',.25,.04,.12);streaks(8,'20,16,14',.35,.5);break;
  case 'sand':blots(8,'70,58,32',.3,.06,.15);scratches(30,'rgba(60,45,22,.4)');break;
  case 'barrel':scratches(50,'rgba(230,220,200,.35)');blots(6,'90,40,18',.4,.04,.12);streaks(6,'60,25,10',.35,.4);break;
  case 'bark':blots(8,'60,80,40',.2,.05,.12);break;
 }
}
function gPbrMaps(tex,strength,rBase,rVar){
 const src=tex.image,w=src.width,h=src.height;
 const d=src.getContext('2d').getImageData(0,0,w,h).data;
 const L=new Float32Array(w*h);let sum=0;
 for(let i=0;i<w*h;i++){const v=(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11)/255;L[i]=v;sum+=v;}
 const mean=sum/(w*h);
 const nc=document.createElement('canvas');nc.width=w;nc.height=h;const ng=nc.getContext('2d'),nd=ng.createImageData(w,h);
 const rc=document.createElement('canvas');rc.width=w;rc.height=h;const rg=rc.getContext('2d'),rd=rg.createImageData(w,h);
 const sc=strength*(w/256);
 for(let y=0;y<h;y++){const ym=((y-1+h)%h)*w,yp=((y+1)%h)*w,y0=y*w;
  for(let x=0;x<w;x++){const xm=(x-1+w)%w,xp=(x+1)%w;
   const dx=(L[y0+xp]-L[y0+xm])*sc,dy=(L[yp+x]-L[ym+x])*sc;
   let nx=-dx,ny=dy,nz=1;const il=1/Math.sqrt(nx*nx+ny*ny+nz*nz);
   const o=(y0+x)*4;nd.data[o]=(nx*il*.5+.5)*255;nd.data[o+1]=(ny*il*.5+.5)*255;nd.data[o+2]=(nz*il*.5+.5)*255;nd.data[o+3]=255;
   const r=Math.max(0,Math.min(1,rBase-(L[y0+x]-mean)*rVar));const rv=r*255;rd.data[o]=rv;rd.data[o+1]=rv;rd.data[o+2]=rv;rd.data[o+3]=255;}}
 ng.putImageData(nd,0,0);rg.putImageData(rd,0,0);
 const mk=c=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=tex.anisotropy||1;return t;};
 return {n:mk(nc),r:mk(rc)};
}
/* definição física por material: ns = força do relevo, r/m = rugosidade/metal, rv = variação da rugosidade, env = reflexo */
const GMATS=mats;
const GMDEF={
 ground:{tex:'grass',ns:.7,r:.96,m:0,rv:.4,env:.5,s:5},road:{tex:'asphalt',ns:.55,r:.86,m:0,rv:.8,env:.7,s:4},
 conc:{tex:'concrete',ns:1.0,r:.9,m:0,rv:.6,env:.7,s:4},brick:{tex:'brick',ns:1.3,r:.88,m:0,rv:.5,env:.6,s:5},
 wood:{tex:'wood',ns:.9,r:.74,m:0,rv:.6,env:.6,s:4},cont:{tex:'contBlue',ns:.8,r:.48,m:.55,rv:1.1,env:1.2,s:3},
 cont2:{tex:'contRust',ns:.9,r:.66,m:.42,rv:1.0,env:1.0,s:3},sand:{tex:'sand',ns:1.1,r:.97,m:0,rv:.3,env:.4,s:5},
 leaf:{tex:'leaf',ns:.8,r:.8,m:0,rv:.5,env:.5,s:4},trunk:{tex:'bark',ns:1.6,r:.95,m:0,rv:.3,env:.4,s:5},
 roof:{tex:'roof',ns:.9,r:.78,m:.1,rv:.7,env:.8,s:4},barrel:{tex:'barrel',ns:.6,r:.42,m:.5,rv:1.2,env:1.2,s:3}
};
(function gUpgradeMaterials(){
 const q=GQ(),aniso=Math.min(QT.aniso[q],renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():1);
 const done={};
 for(const k in GMDEF){const D=GMDEF[k],m=mats[k],t=TEX[D.tex];if(!m||!t||!t.image||!t.image.getContext)continue;
  if(!done[D.tex]){gWeather(D.tex,t.image.getContext('2d'),t.image.width);t.anisotropy=aniso;t.needsUpdate=true;done[D.tex]=q>=1?gPbrMaps(t,D.s,D.r,D.rv):1;}
  if(m.isMeshStandardMaterial){
   const P2=done[D.tex];m.normalMap=P2.n;m.normalScale=new THREE.Vector2(D.ns,D.ns);m.roughnessMap=P2.r;m.roughness=1;m.metalness=D.m;
   m.userData.envK=D.env;m.needsUpdate=true;
  }
 }
 if(mats.dark&&mats.dark.isMeshStandardMaterial){mats.dark.metalness=.45;mats.dark.roughness=.5;}
 if(mats.glass&&mats.glass.isMeshStandardMaterial){mats.glass.roughness=.08;mats.glass.metalness=.6;mats.glass.userData.envK=2;mats.glass.color.setHex(0x3b5a70);}
 for(const k in TEX)if(TEX[k].anisotropy!==undefined){TEX[k].anisotropy=aniso;}
})();

/* ================= UPGRADE DE MODELOS (Lambert -> PBR) ================= */
function gConvertMat(m,isGun){
 if(!m||!m.isMeshLambertMaterial)return m;
 const key=m.uuid+(isGun?'g':'');
 if(GFX.matCache.has(key))return GFX.matCache.get(key);
 const c=m.color,lum=c.r*.3+c.g*.59+c.b*.11;
 const metal=isGun?(lum<.25?.7:.3):(lum<.06?.25:.04);
 const n=new THREE.MeshStandardMaterial({color:c.clone(),map:m.map,side:m.side,transparent:m.transparent,opacity:m.opacity,
  alphaTest:m.alphaTest||0,skinning:!!m.skinning,morphTargets:!!m.morphTargets,vertexColors:!!m.vertexColors,
  roughness:isGun?.42:(.78+lum*.1),metalness:metal});
 if(m.emissive)n.emissive.copy(m.emissive);if(m.emissiveMap)n.emissiveMap=m.emissiveMap;
 n.envMapIntensity=(isGun?1.3:.8);n.userData.gfxConv=1;
 GFX.matCache.set(key,n);return n;
}
function gUpgradeTree(root,isGun){
 if(GQ()===0||!root)return;
 root.traverse(o=>{
  if(!o.isMesh||o.userData.gfxDone)return;o.userData.gfxDone=1;
  if(o.isInstancedMesh)return;
  if(Array.isArray(o.material))o.material=o.material.map(x=>gConvertMat(x,isGun));
  else if(o.material&&o.material.isMeshLambertMaterial&&!o.material.map?.image?.tagName?.includes?.('VIDEO'))o.material=gConvertMat(o.material,isGun);
  if(o.material&&o.material.isMeshStandardMaterial&&!o.material.userData.gfxConv&&o.material.envMapIntensity===1&&!isGun){o.material.envMapIntensity=o.material.map?.4:.7;}
  if(root===world&&o.material&&o.material.isMeshStandardMaterial&&!o.material.userData.gfxConv&&!o.material.userData.envK&&!o.material.userData.gfxTree){
   const mm=o.material;mm.userData.gfxTree=1;mm.roughness=Math.max(mm.roughness,.82);mm.metalness=Math.min(mm.metalness,.05);mm.envMapIntensity=.35;
   if(mm.color){const c=mm.color,l=c.r*.3+c.g*.59+c.b*.11;if(l>.6)c.multiplyScalar(.6/l);}mm.needsUpdate=true;}
  if(!isGun&&o.material&&o.material.visible!==false&&!o.material.transparent)o.castShadow=true;
 });
}
/* variação de cor nos tufos de grama (instâncias) */
function gGrassColors(){
 world.traverse(o=>{
  if(!o.isInstancedMesh||o.userData.gfxCol||!o.setColorAt)return;o.userData.gfxCol=1;
  const c=new THREE.Color();gseed=99;
  for(let i=0;i<o.count;i++){const r=grnd();c.setHSL(.2+grnd()*.08,.38+grnd()*.2,.24+r*.16);if(r>.88)c.setHSL(.13,.4,.42);o.setColorAt(i,c);}
  if(o.instanceColor)o.instanceColor.needsUpdate=true;
  if(o.material&&o.material.color)o.material.color.setHex(0xffffff);
 });
}

/* ================= TEXTURAS AUXILIARES (sprites/decalques) ================= */
function gCanvasTex(sz,fn){const c=document.createElement('canvas');c.width=c.height=sz;fn(c.getContext('2d'),sz);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
const GTEX={
 smoke:gCanvasTex(128,(g,s)=>{gseed=5;for(let i=0;i<9;i++){const x=s*(.3+grnd()*.4),y=s*(.3+grnd()*.4),r=s*(.18+grnd()*.2),gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);}}),
 fire:gCanvasTex(128,(g,s)=>{const gr=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);gr.addColorStop(0,'rgba(255,250,220,1)');gr.addColorStop(.25,'rgba(255,190,90,.9)');gr.addColorStop(.6,'rgba(230,90,20,.35)');gr.addColorStop(1,'rgba(120,30,0,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);}),
 muzzle:gCanvasTex(128,(g,s)=>{g.translate(s/2,s/2);for(let i=0;i<6;i++){g.rotate(Math.PI/3);const gr=g.createLinearGradient(0,0,s*.48,0);gr.addColorStop(0,'rgba(255,240,200,1)');gr.addColorStop(1,'rgba(255,150,40,0)');g.fillStyle=gr;g.beginPath();g.moveTo(0,-s*.05);g.lineTo(s*.48,0);g.lineTo(0,s*.05);g.fill();}
  const gr=g.createRadialGradient(0,0,0,0,0,s*.25);gr.addColorStop(0,'rgba(255,255,235,1)');gr.addColorStop(1,'rgba(255,170,60,0)');g.fillStyle=gr;g.fillRect(-s/2,-s/2,s,s);}),
 hole:gCanvasTex(64,(g,s)=>{const h=s/2,gr=g.createRadialGradient(h,h,0,h,h,h);gr.addColorStop(0,'rgba(5,5,5,1)');gr.addColorStop(.22,'rgba(15,13,12,.95)');gr.addColorStop(.35,'rgba(70,64,58,.6)');gr.addColorStop(.6,'rgba(40,36,32,.25)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);
  g.strokeStyle='rgba(20,18,16,.6)';g.lineWidth=1;gseed=3;for(let i=0;i<6;i++){const a=grnd()*6.28;g.beginPath();g.moveTo(h,h);g.lineTo(h+Math.cos(a)*h*.8,h+Math.sin(a)*h*.8);g.stroke();}}),
 scorch:gCanvasTex(256,(g,s)=>{const h=s/2;gseed=11;for(let i=0;i<14;i++){const x=h+(grnd()-.5)*s*.4,y=h+(grnd()-.5)*s*.4,r=s*(.15+grnd()*.3),gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(8,7,6,.55)');gr.addColorStop(1,'rgba(8,7,6,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);}
  g.strokeStyle='rgba(10,9,8,.5)';for(let i=0;i<22;i++){const a=grnd()*6.28;g.lineWidth=1+grnd()*3;g.beginPath();g.moveTo(h,h);g.lineTo(h+Math.cos(a)*h*(.5+grnd()*.45),h+Math.sin(a)*h*(.5+grnd()*.45));g.stroke();}}),
 oil:gCanvasTex(128,(g,s)=>{const h=s/2;gseed=21;for(let i=0;i<6;i++){const x=h+(grnd()-.5)*s*.35,y=h+(grnd()-.5)*s*.35,r=s*(.12+grnd()*.2);g.fillStyle='rgba(12,12,14,.8)';g.beginPath();g.ellipse(x,y,r,r*.7,grnd()*3,0,6.28);g.fill();}}),
 rubble:gCanvasTex(128,(g,s)=>{gseed=31;for(let i=0;i<70;i++){const x=s/2+(grnd()-.5)*s*.85,y=s/2+(grnd()-.5)*s*.85,r=1+grnd()*5;const v=70+grnd()*80|0;g.fillStyle='rgba('+v+','+(v-4)+','+(v-10)+','+(.6+grnd()*.4)+')';g.beginPath();g.moveTo(x,y-r);g.lineTo(x+r,y);g.lineTo(x,y+r*.8);g.lineTo(x-r*.9,y);g.fill();}})
};

/* ================= EFEITOS (pool de sprites) ================= */
function gInitFx(){
 const n=[10,18,28,40][GQ()];
 for(let i=0;i<n;i++){
  const m=new THREE.SpriteMaterial({map:GTEX.smoke,transparent:true,depthWrite:false,opacity:0,fog:true});
  const s=new THREE.Sprite(m);s.visible=false;s.userData={life:0,max:1,v:new THREE.Vector3(),grow:1,a:1,kind:0};scene.add(s);GFX.fx.push(s);
 }
 /* luz de explosão e de disparo sempre na cena (intensidade 0 = desligada; evita recompilar shaders) */
 GFX.boomL=new THREE.PointLight(0xff9a4a,0,26,2);scene.add(GFX.boomL);
 GFX.muzzleL=new THREE.PointLight(0xffb366,0,10,2);GFX.muzzleL.position.set(.15,-.08,-.9);cam.add(GFX.muzzleL);
 /* sprite de clarão no cano */
 if(typeof flash!=='undefined'&&flash&&flash.parent){
  const sm=new THREE.SpriteMaterial({map:GTEX.muzzle,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,transparent:true,fog:false});
  const sp=new THREE.Sprite(sm);sp.scale.set(.32,.32,1);sp.renderOrder=999;flash.add(sp);
  flash.material.transparent=true;flash.material.opacity=.0;GFX.muzzleSpr=sp;
 }
 /* decalques de bala com textura real */
 if(typeof dm!=='undefined'&&dm&&dm.isMeshBasicMaterial){dm.map=GTEX.hole;dm.color.setHex(0xffffff);dm.opacity=.9;dm.depthWrite=false;dm.polygonOffset=true;dm.polygonOffsetFactor=-2;dm.needsUpdate=true;}
}
function gFx(pos,kind,size,life,vx,vy,vz,a){
 if(!GFX.fx.length)return;
 const s=GFX.fx[GFX.fxi++%GFX.fx.length],u=s.userData,m=s.material;
 const fire=kind===1;
 if(m.map!==(fire?GTEX.fire:GTEX.smoke)){m.map=fire?GTEX.fire:GTEX.smoke;m.needsUpdate=true;}
 m.blending=fire?THREE.AdditiveBlending:THREE.NormalBlending;
 m.color.setHex(fire?0xffffff:(kind===2?0xb8ab92:0x5a5550));m.rotation=Math.random()*6.28;
 s.position.copy(pos);s.scale.setScalar(size);u.v.set(vx,vy,vz);u.life=u.max=life;u.grow=fire?1.6:2.4;u.a=a;u.kind=kind;s.visible=true;
}
function gfxBoom(pos){
 if(GFX.boomL){GFX.boomL.position.copy(pos).setY(pos.y+1);GFX.boomL.intensity=7;GFX.boomT=.32;}
 const q=GQ(),nf=[3,5,7,9][q],ns=[3,5,8,11][q];
 for(let i=0;i<nf;i++)gFx(pos,1,1.2+Math.random()*1.4,.35+Math.random()*.3,(Math.random()-.5)*3,1+Math.random()*2,(Math.random()-.5)*3,1);
 for(let i=0;i<ns;i++)gFx(pos.clone().add(new THREE.Vector3((Math.random()-.5)*1.5,.3,(Math.random()-.5)*1.5)),0,1.4+Math.random()*1.4,2.2+Math.random()*1.6,(Math.random()-.5)*1.2,.9+Math.random()*.9,(Math.random()-.5)*1.2,.7);
 gScorch(pos.x,pos.z,3+Math.random()*1.5);
}
/* poeira e lascas em cada marca de bala */
if(typeof decal==='function'){
 const _decal=decal;
 decal=function(p,n){_decal(p,n);try{const q=GQ();if(q>=1)gFx(p.clone().addScaledVector(n,.08),2,.28,.55,n.x*.6,.35+n.y*.4,n.z*.6,.55);if(q>=2)gFx(p.clone().addScaledVector(n,.05),2,.18,.4,n.x*1.2,.6,n.z*1.2,.4);}catch(e){}};
}
function gTickFx(dt){
 for(const s of GFX.fx){if(!s.visible)continue;const u=s.userData;u.life-=dt;if(u.life<=0){s.visible=false;s.material.opacity=0;continue;}
  const t=1-u.life/u.max;s.position.addScaledVector(u.v,dt);u.v.multiplyScalar(Math.exp(-1.5*dt));
  s.scale.multiplyScalar(1+u.grow*dt*(1-t*.6));s.material.opacity=u.a*(u.kind===1?(1-t)*(1-t):Math.min(1,t*6)*(1-t));}
 if(GFX.boomT>0){GFX.boomT-=dt;GFX.boomL.intensity=Math.max(0,GFX.boomT/.32)*7;if(GFX.boomT<=0)GFX.boomL.intensity=0;}
 /* clarão de disparo */
 if(typeof flash!=='undefined'&&GFX.muzzleL){const on=flash.visible;GFX.muzzleL.intensity=on?2.2+Math.random()*1.2:0;if(GFX.muzzleSpr&&on){GFX.muzzleSpr.material.rotation=Math.random()*6.28;const k=.26+Math.random()*.14;GFX.muzzleSpr.scale.set(k,k,1);}}
}

/* ================= DETALHES DO AMBIENTE (decalques planos, sem colisão) ================= */
const GDEC=[];
function gGroundDecal(tex,x,z,s,op,rot,mat){
 const m=mat||new THREE.MeshStandardMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,roughness:.95,metalness:0,opacity:op});
 const p=new THREE.Mesh(new THREE.PlaneGeometry(s,s),m);p.rotation.set(-Math.PI/2,0,rot||0);p.position.set(x,.03+GDEC.length*.0004,z);p.receiveShadow=true;world.add(p);GDEC.push(p);return p;
}
let _gScorchMat=null,_gScorchN=0;const _gScorchPool=[];
function gScorch(x,z,s){
 if(!_gScorchMat)_gScorchMat=new THREE.MeshBasicMaterial({map:GTEX.scorch,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,opacity:.85});
 if(_gScorchPool.length<8)_gScorchPool.push(gGroundDecal(null,x,z,s,1,Math.random()*6,_gScorchMat));
 const p=_gScorchPool[_gScorchN++%_gScorchPool.length];p.position.set(x,.035,z);p.scale.setScalar(s/p.geometry.parameters.width);p.rotation.z=Math.random()*6;
}
function gDecorate(){
 if(typeof SZ==='undefined')return;
 const q=GQ(),n=[8,14,22,30][q];gseed=2024;
 const scorchM=new THREE.MeshBasicMaterial({map:GTEX.scorch,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,opacity:.75});
 const oilM=new THREE.MeshStandardMaterial({map:GTEX.oil,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,roughness:.08,metalness:.3,opacity:.85});
 oilM.userData.envK=1.6;GMATS.__oil=oilM;
 const rubM=new THREE.MeshStandardMaterial({map:GTEX.rubble,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,roughness:.95,alphaTest:.05});
 for(let i=0;i<n;i++){
  const x=(grnd()-.5)*(SZ*2-6),z=(grnd()-.5)*(SZ*2-6),r=grnd();
  if(r<.35)gGroundDecal(null,x,z,2.5+grnd()*3,1,grnd()*6,scorchM);
  else if(r<.55)gGroundDecal(null,x,z,1.2+grnd()*1.6,1,grnd()*6,oilM);
  else gGroundDecal(null,x,z,1.4+grnd()*2.2,1,grnd()*6,rubM);
 }
 /* cápsulas de bala (instanciadas, minúsculas, sem colisão) */
 if(q>=1){const cnt=[0,60,120,200][q];
  const im=new THREE.InstancedMesh(new THREE.CylinderGeometry(.012,.012,.05,5),new THREE.MeshStandardMaterial({color:0xc8a040,metalness:.9,roughness:.32}),cnt);
  const o=new THREE.Object3D();
  for(let i=0;i<cnt;i++){const cx=(grnd()-.5)*(SZ*2-8),cz=(grnd()-.5)*(SZ*2-8);for(let j=0;j<1;j++){o.position.set(cx,.012,cz);o.rotation.set(Math.PI/2,grnd()*6,grnd()*6);o.updateMatrix();im.setMatrixAt(i,o.matrix);}}
  im.instanceMatrix.needsUpdate=true;world.add(im);}
 /* luzes de emergência ganham fonte visível (lâmpada vermelha) */
 if(ENV.emergLights)ENV.emergLights.forEach(L=>{
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:typeof glowTex!=='undefined'?glowTex:GTEX.fire,color:0xff3322,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  s.scale.set(1.1,1.1,1);s.position.copy(L.position);scene.add(s);GFX.emergSpr.push(s);
 });
}

/* ================= LANTERNA ================= */
envFlashIntensity=function(){
 const c=GFX.col,dark=c?Math.min(1,Math.max(0,(c.night?1:0)*.6+(1.2-c.si)*.5)):1;
 let base=1.4+dark*3.0;
 if(ENV.batEnabled&&ENV.bat<20)base*=0.4+ENV.bat/50;
 if(ENV.flickerT>0)base*=0.35+Math.random()*0.7;
 return base;
};
function gTuneFlash(){
 const F=ENV.flash;if(!F)return;
 F.color.setHex(0xfff1dc);F.distance=38;F.angle=.5;F.penumbra=.5;F.decay=1.25;
 const q=GQ();F.shadow.mapSize.set(q>=3?1024:512,q>=3?1024:512);F.shadow.bias=-.0004;F.shadow.normalBias=.03;F.shadow.camera.far=30;
 if(F.shadow.map){F.shadow.map.dispose();F.shadow.map=null;}
 if(q>=2&&!GFX.beam){
  const len=16,rad=Math.tan(.5)*len;
  const g=new THREE.ConeGeometry(rad,len,24,1,true);g.translate(0,-len/2,0);g.rotateX(Math.PI/2);
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
   uniforms:{op:{value:0},col:{value:new THREE.Color(0xfff0d0)}},
   vertexShader:'varying float vT;varying vec3 vN;varying vec3 vV;void main(){vT=clamp(-position.z/16.0,0.0,1.0);vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
   fragmentShader:'uniform float op;uniform vec3 col;varying float vT;varying vec3 vN;varying vec3 vV;void main(){float edge=pow(abs(dot(vN,vV)),2.0);float a=smoothstep(0.0,0.12,vT)*pow(1.0-vT,2.2)*edge*op;gl_FragColor=vec4(col*a,a);}'});
  GFX.beam=new THREE.Mesh(g,m);GFX.beam.frustumCulled=false;GFX.beam.renderOrder=5;GFX.beam.position.copy(F.position);cam.add(GFX.beam);
 }
}

/* ================= QUALIDADE / SOMBRAS / RESOLUÇÃO ADAPTATIVA ================= */
const _gApplyQ=applyQuality;
applyQuality=function(){
 _gApplyQ();
 const q=GQ(),maxT=renderer.capabilities.maxTextureSize||4096;
 let ms=Math.min(QT.shadow[q],maxT);if(GMOB)ms=Math.min(ms,2048);
 if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
 const ext=[26,32,40,46][q];Object.assign(sun.shadow.camera,{left:-ext,right:ext,top:ext,bottom:-ext,near:1,far:220});sun.shadow.camera.updateProjectionMatrix();
 sun.shadow.bias=-.00025;sun.shadow.normalBias=[.05,.04,.03,.025][q];
 renderer.shadowMap.type=q===0?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;renderer.shadowMap.needsUpdate=true;
 const pr=Math.min(window.devicePixelRatio||1,QT.pr[q])*GFX.dyn;renderer.setPixelRatio(Math.max(.6,pr));
 renderer.setSize(innerWidth,innerHeight,false);
 document.body.classList.toggle('gfx-hq',q>=2);
 if(save.q===-1){ /* SUPER BAIXA */
  renderer.shadowMap.enabled=false;sun.castShadow=false;
  renderer.setPixelRatio(.5);renderer.setSize(innerWidth,innerHeight,false);
  if(GFX.beam)GFX.beam.visible=false;
 }
};
function gDynRes(dt){
 GFX.fpsAvg+=(1/Math.max(dt,.001)-GFX.fpsAvg)*.05;GFX.dynT+=dt;
 if(GFX.dynT<2.5)return;GFX.dynT=0;
 const old=GFX.dyn;
 if(GFX.fpsAvg<32&&GFX.dyn>.65)GFX.dyn=Math.max(.65,GFX.dyn-.1);
 else if(GFX.fpsAvg>56&&GFX.dyn<1)GFX.dyn=Math.min(1,GFX.dyn+.05);
 if(old!==GFX.dyn)applyQuality();
}

/* ================= GANCHOS ================= */
if(!sun.target.parent)scene.add(sun.target);
const _gEnvInit=envInit;
envInit=function(){
 _gEnvInit();
 gSetPresetTime();
 gTuneFlash();
 if(ENV.emergLights)ENV.emergLights.forEach(L=>{L.userData.flick=false;L.userData.base=Math.max(L.userData.base*4,.9);L.distance=18;L.decay=2;});
 GFX.skyKey='';envApplyLighting(envSkyColor(ENV.time));gSetLightDirFollow();
};
const _gEnvUpdate=envUpdate;
let _gT=0;
envUpdate=function(dt){
 gSetPresetTime();
 _gEnvUpdate(dt);
 _gT+=dt;
 gSetLightDirFollow();
 gTickFx(dt);
 if(typeof state!=='undefined'&&state==='play'&&save.q!==-1)gDynRes(dt);
 /* luzes de emergência: pulso lento e controlado + falha ocasional */
 const ek=GFX.emergK||0;
 if(ENV.emergLights)ENV.emergLights.forEach((L,i)=>{let p=.75+.25*Math.sin(_gT*2.2+i*1.7);if(Math.sin(_gT*.7+i*3.1)>.97)p*=.25;L.intensity=L.userData.base*ek*p;const s=GFX.emergSpr[i];if(s){s.visible=ek>.05;s.material.opacity=Math.min(1,ek*p);}});
 /* feixe da lanterna */
 if(GFX.beam){const on=ENV.flashOn&&!ENV.nvOn&&ENV.flash&&ENV.flash.intensity>0;GFX.beam.visible=on;
  if(on){const c=GFX.col,dk=c&&c.night?1:c?Math.max(0,1.3-c.si)*.6:1;GFX.beam.material.uniforms.op.value=.05*dk*(ENV.weather==='fog'?2.2:ENV.weather==='rain'?1.5:1);}}
 /* novos modelos (inimigos que nascem) recebem material PBR */
 GFX.convT-=dt;if(GFX.convT<=0){GFX.convT=1;gUpgradeTree(world,false);if(typeof enemies!=='undefined')for(const e of enemies){if(e&&e.mesh)gUpgradeTree(e.mesh,false);else if(e&&e.g)gUpgradeTree(e.g,false);}gUpgradeScene();}
};
function gUpgradeScene(){for(const c of scene.children){if(c===world||c.isLight||c.isSprite||c.isPoints)continue;if(c.isGroup||c.isMesh)gUpgradeTree(c,false);}}
function gfxPostStart(){
 try{
  GFX.preset=save.lp||'auto';
  gInitFx();gDecorate();gGrassColors();
  if(typeof gun!=='undefined')gUpgradeTree(gun,true);
  gUpgradeTree(world,false);gUpgradeScene();
  if(window.__sunGlow)window.__sunGlow.onBeforeRender=function(r,sc,cm){this.position.copy(cm.position).addScaledVector(_gDir,120);};
  /* menu já mostra a nova luz */
  ENV.time=GFX.preset==='auto'?21.5:GPRE[GFX.preset].h;
  GFX.skyKey='';envApplyLighting(envSkyColor(ENV.time));gSetLightDirFollow();
  applyQuality();GFX.inited=true;
  console.log('Graphics v14 ok — q='+GQ()+' preset='+GFX.preset);
 }catch(e){console.error('Graphics v14 init',e);}
}
window.__gfx=GFX;
