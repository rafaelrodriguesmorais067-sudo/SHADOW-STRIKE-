"use strict";
/* ENGINE v2: renderer, céu, luzes, texturas procedurais e materiais */
/* PERFIS DE QUALIDADE (índices 0 Baixa, 1 Média, 2 Alta, 3 Ultra).
   Uma única tabela controla pixel ratio, sombras, texturas, anisotropia e vegetação. */
const QT={pr:[1,1.25,1.5,2],shadow:[512,1024,2048,4096],aniso:[2,4,8,16],tex:[192,320,512,768],tufts:[0,160,380,600]};
/* v24 celular: texturas e vegetação um pouco menores no Ultra para caber na memória do aparelho */
const MOBP=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.platform));
if(MOBP){QT.tex[3]=512;QT.tufts[3]=380;QT.tufts[2]=260;}
const curQ=()=>Math.max(0,Math.min(3,save.q|0));
const QI=curQ();
const SUPERLOW=save.q===-1; /* SUPER BAIXA: perfil BAIXA + resolução mínima, sem sombras e texturas pequenas (testes em celular fraco) */           /* perfil com que o jogo foi iniciado (texturas e materiais são criados uma vez) */
const canvas=$('c');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:QI>=2&&!SUPERLOW,powerPreference:'high-performance',alpha:false,stencil:false});}
catch(e){fail('Falha no renderer: '+e.message);throw e;}
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
const FOGC=0xbcd0dc;
const scene=new THREE.Scene();
scene.background=new THREE.Color(FOGC);
scene.fog=new THREE.Fog(0xa9bac1,48,155);
const cam=new THREE.PerspectiveCamera(75,1,.05,260);
scene.add(cam);

/* LUZES */
const hemi=new THREE.HemisphereLight(0xd7e7f5,0x494334,1.05);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe8c6,2.0);
sun.position.set(40,60,20);
Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:160});
sun.shadow.mapSize.set(QT.shadow[QI]||1024,QT.shadow[QI]||1024);
sun.shadow.normalBias=.035;
sun.shadow.bias=-.0006;
scene.add(sun);
const fill=new THREE.DirectionalLight(0x9bbbd8,.38);fill.position.set(-30,20,-20);scene.add(fill);
const ray=new THREE.Raycaster();

function applyQuality(){
 const q=curQ();
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,QT.pr[q]));
 const sh=QT.shadow[q]>0;
 renderer.shadowMap.enabled=sh;
 sun.castShadow=sh;
 renderer.setSize(innerWidth,innerHeight,false);
 cam.aspect=innerWidth/innerHeight;
 cam.updateProjectionMatrix();
}

/* TEXTURAS PROCEDURAIS (tamanho depende da qualidade; mudar a qualidade só vale após recarregar a página) */
const TS=SUPERLOW?96:QT.tex[QI];
const maxAniso=renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():1;
let seed=12345;
function rnd(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
function makeTex(draw,size){
 size=size||TS;
 const c=document.createElement('canvas');c.width=c.height=size;
 const g=c.getContext('2d');draw(g,size,size/256);
 /* v14: micro-detalhe por pixel nas resoluções altas (barato, sem milhares de fillRect) */
 if(size>=512){const id=g.getImageData(0,0,size,size),d=id.data;for(let i=0;i<d.length;i+=4){const n=(rnd()-.5)*14;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}g.putImageData(id,0,0);}
 const t=new THREE.CanvasTexture(c);
 if('encoding' in t)t.encoding=THREE.sRGBEncoding;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 if('encoding' in t)t.encoding=THREE.sRGBEncoding;
 t.anisotropy=Math.min(QT.aniso[QI],maxAniso);
 return t;
}
function speckle(g,s,cols,n,a,b,al){
 if(s>384)n=n*(384/s)*(384/s); /* v14: densidade limitada; o detalhe fino vem do ruído por pixel */
 for(let i=0;i<n;i++){g.globalAlpha=al*(.4+rnd()*.6);g.fillStyle=cols[(rnd()*cols.length)|0];
  const w=a+rnd()*(b-a);g.fillRect(rnd()*s,rnd()*s,w,w*(.5+rnd()));}
 g.globalAlpha=1;
}
function containerTex(base,rust){
 return makeTex((g,s,k)=>{
  g.fillStyle=base;g.fillRect(0,0,s,s);
  const n=24,rw=s/n;
  for(let i=0;i<n;i++){g.fillStyle='rgba(0,0,0,.28)';g.fillRect(i*rw,0,rw/2,s);g.fillStyle='rgba(255,255,255,.1)';g.fillRect(i*rw+rw/2,0,rw/2,s);}
  g.fillStyle='rgba(0,0,0,.35)';g.fillRect(0,0,s,s*.05);g.fillRect(0,s*.95,s,s*.05);
  g.fillStyle='rgba(0,0,0,.4)';g.fillRect(0,0,2*k,s);
  speckle(g,s,[rust,'#5a3018'],s*s/30,k,3*k,.5);
  speckle(g,s,['#d8d8d8','#111'],s*s/40,k,2*k,.2);
 });
}
const TEX={
 grain:makeTex((g,s,k)=>{g.fillStyle='#e8e8e8';g.fillRect(0,0,s,s);speckle(g,s,['#d0d0d0','#f6f6f6','#bcbcbc'],s*s/3,k,2*k,.6);}),
 grass:makeTex((g,s,k)=>{
  g.fillStyle='#587536';g.fillRect(0,0,s,s);
  for(let i=0;i<14;i++){const x=rnd()*s,y=rnd()*s,r=s*(.08+rnd()*.15),gr=g.createRadialGradient(x,y,0,x,y,r),c=rnd()<.5?'110,138,62':'122,106,64';
   gr.addColorStop(0,'rgba('+c+',.45)');gr.addColorStop(1,'rgba('+c+',0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}
  speckle(g,s,['#4a6a2c','#6d8f3c','#85a34a','#3f5a26'],s*s/5,k,3*k,.6);
 }),
 asphalt:makeTex((g,s,k)=>{
  g.fillStyle='#3a3c3f';g.fillRect(0,0,s,s);
  speckle(g,s,['#2b2d30','#4a4c50','#55575b','#2f3134'],s*s/4,k,2*k,.7);
  g.strokeStyle='#1e1f21';g.lineWidth=1.2*k;
  for(let i=0;i<5;i++){g.beginPath();let x=rnd()*s,y=rnd()*s;g.moveTo(x,y);for(let j=0;j<6;j++){x+=(rnd()-.5)*s*.2;y+=(rnd()-.2)*s*.15;g.lineTo(x,y);}g.stroke();}
  g.fillStyle='rgba(200,200,190,.8)';g.fillRect(s*.05,0,s*.025,s);g.fillRect(s*.925,0,s*.025,s);
  g.fillStyle='rgba(216,194,74,.9)';g.fillRect(s*.488,s*.08,s*.025,s*.35);g.fillRect(s*.488,s*.58,s*.025,s*.35);
  speckle(g,s,['#3a3c3f','#2b2d30','#55575b'],s*s/10,k,2*k,.35);
 }),
 concrete:makeTex((g,s,k)=>{
  g.fillStyle='#8e8e88';g.fillRect(0,0,s,s);
  speckle(g,s,['#7a7a75','#9d9d97','#6f6f6a','#a8a8a2'],s*s/4,k,2*k,.6);
  for(let i=0;i<6;i++){const x=rnd()*s,w=s*(.03+rnd()*.06),gr=g.createLinearGradient(0,0,0,s);gr.addColorStop(0,'rgba(40,40,35,.35)');gr.addColorStop(1,'rgba(40,40,35,0)');g.fillStyle=gr;g.fillRect(x,0,w,s*(.4+rnd()*.5));}
  g.strokeStyle='#5f5f5a';g.lineWidth=2*k;g.strokeRect(0,0,s,s);
  g.beginPath();g.moveTo(0,s/2);g.lineTo(s,s/2);g.moveTo(s/2,0);g.lineTo(s/2,s);g.stroke();
  g.fillStyle='#55554f';[[.06,.06],[.94,.06],[.06,.94],[.94,.94],[.5,.06],[.5,.94]].forEach(p=>{g.beginPath();g.arc(p[0]*s,p[1]*s,2*k,0,6.28);g.fill();});
 }),
 brick:makeTex((g,s,k)=>{
  g.fillStyle='#6f695e';g.fillRect(0,0,s,s);
  const rows=8,bh=s/rows,bw=s/4,cols=['#8a4a38','#7d4232','#935240','#6e3a2c','#a05a44'];
  for(let r=0;r<rows;r++)for(let c=-1;c<4;c++){const x=c*bw+(r%2?bw/2:0);g.fillStyle=cols[(rnd()*cols.length)|0];g.fillRect(x+k,r*bh+k,bw-2*k,bh-2*k);}
  speckle(g,s,['#5a2e22','#b0705a','#4a2a20'],s*s/8,k,2*k,.35);
 }),
 wood:makeTex((g,s,k)=>{
  const n=4,pw=s/n,tones=['#8a6a3c','#7c5f35','#94743f','#85663a'];
  for(let i=0;i<n;i++){g.fillStyle=tones[i%4];g.fillRect(i*pw,0,pw,s);g.strokeStyle='rgba(60,40,20,.35)';g.lineWidth=k;
   for(let j=0;j<7;j++){const x=i*pw+rnd()*pw;g.beginPath();g.moveTo(x,0);g.lineTo(x+(rnd()-.5)*4*k,s);g.stroke();}
   g.fillStyle='#2e2012';g.fillRect(i*pw,0,1.5*k,s);}
  g.strokeStyle='#5a4122';g.lineWidth=s*.07;g.strokeRect(s*.035,s*.035,s*.93,s*.93);
  g.beginPath();g.moveTo(s*.05,s*.05);g.lineTo(s*.95,s*.95);g.stroke();
  g.fillStyle='#bbb';[[.035,.035],[.965,.035],[.035,.965],[.965,.965]].forEach(p=>{g.beginPath();g.arc(p[0]*s,p[1]*s,2*k,0,6.28);g.fill();});
  speckle(g,s,['#4a3a22','#a8844c'],s*s/12,k,2*k,.3);
 }),
 contBlue:containerTex('#3d5a73','#6a3a22'),
 contRust:containerTex('#8a4a30','#5a2a14'),
 sand:makeTex((g,s,k)=>{
  g.fillStyle='#8f7c4a';g.fillRect(0,0,s,s);
  const rows=4,bh=s/rows,bw=s/2;
  for(let r=0;r<rows;r++)for(let c=-1;c<3;c++){const x=c*bw+(r%2?bw/2:0);g.fillStyle=['#b59f6a','#a8935c','#c0aa72'][(rnd()*3)|0];
   g.beginPath();g.ellipse(x+bw/2,r*bh+bh/2,bw/2-k,bh/2-k,0,0,6.28);g.fill();g.strokeStyle='rgba(60,45,20,.5)';g.lineWidth=2*k;g.stroke();}
  speckle(g,s,['#7a6a3c','#d0bd88'],s*s/6,k,2*k,.4);
 }),
 bark:makeTex((g,s,k)=>{
  g.fillStyle='#4a3724';g.fillRect(0,0,s,s);
  for(let i=0;i<60;i++){g.strokeStyle=['#3a2a1a','#5c4630','#2e2014'][i%3];g.lineWidth=(1+rnd()*3)*k;const x=rnd()*s;g.beginPath();g.moveTo(x,0);g.lineTo(x+(rnd()-.5)*10*k,s);g.stroke();}
 }),
 leaf:makeTex((g,s,k)=>{
  g.fillStyle='#2f5a2c';g.fillRect(0,0,s,s);
  speckle(g,s,['#244a22','#3f7a36','#4b8a3e','#1f3f1d'],s*s/3,2*k,5*k,.7);
 }),
 roof:makeTex((g,s,k)=>{
  g.fillStyle='#5a4a44';g.fillRect(0,0,s,s);
  speckle(g,s,['#4a3c37','#6a5a52','#3e322e'],s*s/5,k,2*k,.5);
  g.strokeStyle='rgba(20,15,12,.5)';g.lineWidth=2*k;for(let i=0;i<8;i++){g.beginPath();g.moveTo(0,i*s/8);g.lineTo(s,i*s/8);g.stroke();}
 }),
 barrel:makeTex((g,s,k)=>{
  g.fillStyle='#b33a2a';g.fillRect(0,0,s,s);
  speckle(g,s,['#8a2a1c','#c44a38','#6a2015'],s*s/6,k,2*k,.4);
  g.fillStyle='rgba(60,15,8,.8)';[.08,.5,.9].forEach(y=>g.fillRect(0,s*y-s*.025,s,s*.05));
  g.fillStyle='#d8b020';g.fillRect(0,s*.28,s,s*.12);
  g.fillStyle='#222';for(let i=0;i<8;i++){g.beginPath();g.moveTo(i*s/8,s*.28);g.lineTo(i*s/8+s/16,s*.28);g.lineTo(i*s/8+s/16-s*.03,s*.4);g.lineTo(i*s/8-s*.03,s*.4);g.fill();}
  speckle(g,s,['#5a2a18','#9a5030'],s*s/25,k,3*k,.5);
 })
};
function radialTex(stops,size){
 const c=document.createElement('canvas');c.width=c.height=size||128;const g=c.getContext('2d'),h=c.width/2;
 const gr=g.createRadialGradient(h,h,0,h,h,h);stops.forEach(s=>gr.addColorStop(s[0],s[1]));g.fillStyle=gr;g.fillRect(0,0,c.width,c.height);
 return new THREE.CanvasTexture(c);
}
const glowTex=radialTex([[0,'rgba(255,245,200,1)'],[.25,'rgba(255,230,160,.5)'],[1,'rgba(255,220,140,0)']]);
const dirtTex=radialTex([[0,'rgba(110,90,60,.6)'],[.6,'rgba(110,90,60,.3)'],[1,'rgba(110,90,60,0)']],128);

/* MATERIAIS */
/* MATERIAIS: PBR (MeshStandardMaterial) a partir da qualidade Média; Baixa usa Lambert (mais leve para celulares fracos).
   r = roughness (rugosidade), m = metalness (metalicidade). */
function mkMat(o){
 if(QI===0)return new THREE.MeshLambertMaterial({color:o.color!==undefined?o.color:0xffffff,map:o.map});
 return new THREE.MeshStandardMaterial({color:o.color!==undefined?o.color:0xffffff,map:o.map,roughness:o.r!==undefined?o.r:.85,metalness:o.m||0});
}
function tm(map,tile,r,m){const x=mkMat({map,r,m});x.userData.tile=tile;return x;}
const M=(n,r,m)=>mkMat({color:n,map:TEX.grain,r:r!==undefined?r:.7,m:m||.05});
const mats={
 ground:tm(TEX.grass,6,.95),road:tm(TEX.asphalt,10,.8),conc:tm(TEX.concrete,4,.88),brick:tm(TEX.brick,3,.9),
 wood:tm(TEX.wood,2.4,.7),cont:tm(TEX.contBlue,3,.5,.25),cont2:tm(TEX.contRust,3,.7,.15),sand:tm(TEX.sand,2,.97),
 dark:M(0x2a2a2a,.6,.1),leaf:tm(TEX.leaf,2,.85),trunk:tm(TEX.bark,2,.95),roof:tm(TEX.roof,3,.8),barrel:tm(TEX.barrel,1,.45,.2),
 glass:new THREE.MeshStandardMaterial({color:0x4a6f88,roughness:.24,metalness:.28,transparent:true,opacity:.78}),
 line:new THREE.MeshBasicMaterial({color:0xd8d060})
};

/* CÉU (domo com gradiente e nuvens) + brilho do sol; ambos seguem a câmera */
(function buildSky(){
 const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
 const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#4f86c6');gr.addColorStop(.35,'#8db4d8');gr.addColorStop(.5,'#bcd0dc');gr.addColorStop(1,'#bcd0dc');
 g.fillStyle=gr;g.fillRect(0,0,512,256);
 for(let i=0;i<46;i++){const x=rnd()*512,y=50+rnd()*80,r=18+rnd()*45;g.save();g.translate(x,y);g.scale(1.8,.5);
  const cg=g.createRadialGradient(0,0,0,0,0,r);cg.addColorStop(0,'rgba(255,255,255,.42)');cg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=cg;g.beginPath();g.arc(0,0,r,0,6.28);g.fill();g.restore();}
 const sky=new THREE.Mesh(new THREE.SphereGeometry(140,24,12),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.BackSide,fog:false,depthWrite:false}));
 sky.frustumCulled=false;sky.renderOrder=-2;
 sky.onBeforeRender=function(r,s,cm){this.position.copy(cm.position);};
 scene.add(sky);window.__sky=sky;
 const dirv=sun.position.clone().normalize();
 const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xfff2c0,blending:THREE.AdditiveBlending,fog:false,depthWrite:false,transparent:true}));
 glow.scale.set(70,70,1);glow.renderOrder=-1;glow.frustumCulled=false;
 glow.onBeforeRender=function(r,s,cm){this.position.copy(cm.position).addScaledVector(dirv,120);};
 scene.add(glow);window.__sunGlow=glow;
})();

/* RESIZE ROBUSTO + perfil gráfico persistente */
window.addEventListener('resize',()=>{if(!renderer||!cam)return;renderer.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/Math.max(1,innerHeight);cam.updateProjectionMatrix();});
