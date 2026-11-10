"use strict";
/* ENCHANTED WILDS — FLORESTA PERDIDA
   Novo mapa independente para o modo CONTRA MONSTROS (o mapa original continua disponível).
   - Modelos GLB do pacote Enchanted Wilds em models/forest/ (+ versões *-lod.glb simplificadas para distância)
   - InstancedMesh por modelo e por nível de detalhe (24 chamadas de desenho para toda a vegetação)
   - LOD + culling por frustum e distância, recalculados a cada 0,25 s
   - Colisão AABB no mesmo formato de world.js (árvores, pedras, troncos, tocos, cogumelos gigantes)
   - Mapa de densidade da vegetação usado pela IA (visão bloqueada / jogador escondido)
   - Regiões: clareira central, floresta densa, caminho abandonado, região dos cogumelos, pedras antigas
   - Iluminação por região, névoa, feixes de luz, partículas, vento na vegetação e áudio ambiente */

const FOREST={active:false,built:false,loaded:false,loading:null,g:null,types:{},cols:[],solids:[],spawns:[],dens:null,
 densN:0,densC:1.5,shafts:[],motes:null,spores:null,lights:[],uT:{value:0},lodT:0,regionK:{d:0,m:0,a:0,c:0},
 save:null,audio:null,stepI:0};
const FOREST_SZ=70,FK=FOREST_SZ/45;  /* mapa ampliado (o original tem 45) */
const FOREST_CFG={
 path:'models/forest/',
 start:{x:0,z:36,yaw:0},
 spawns:[[-34,-34],[0,-38],[34,-34],[-38,0],[38,-4],[-30,34],[33,33],[-18,-12],[22,-14],[14,24],[-24,10],[8,-27],[-6,-30],[30,6]],
 /* regiões (x,z,raio) */
 clearing:[0,0,12], dense:[-24,-23,17], mush:[27,21,12], ancient:[-26,26,13],
 paths:[
  [[0,44],[0,26],[2,12]],
  [[8,-8],[16,-18],[26,-28],[35,-38]],
  [[-9,5],[-20,12],[-30,20],[-40,27]],
  [[9,4],[18,12],[27,19]],
  [[-6,-10],[-12,-22],[-15,-38]],
  [[-2,-12],[1,-28],[3,-43]],
  [[12,-1],[27,-3],[43,1]],
  [[-12,-2],[-27,-7],[-43,-5]],
  [[-30,-30],[-12,-31],[8,-30],[30,-31]],
  [[-31,40],[-10,33],[10,36],[33,40]],
  [[33,-30],[36,-6],[38,26]]
 ],
 /* lodNear: distância do modelo completo · draw: distância máxima por qualidade [baixa,média,alta,ultra] */
 lodNear:[9,13,19,26], drawFar:[52,62,74,86], drawSmall:[22,28,36,44], veg:[.4,.62,.85,1]
};
(function(){const C=FOREST_CFG,sc=a=>{a[0]*=FK;a[1]*=FK;};
 C.start.z*=FK;C.spawns.forEach(sc);['clearing','dense','mush','ancient'].forEach(k=>{sc(C[k]);C[k][2]*=FK;});C.paths.forEach(p=>p.forEach(sc));
 C.drawFar=C.drawFar.map(v=>v*1.1);})();
const FPW=2.2; /* trilhas mais largas: margem extra livre */
/* Definição dos 12 modelos: altura alvo (m), colisão e balanço do vento */
const FOREST_TYPES={
 elder:{file:'elder-canopy-tree',h:[13,17],col:'trunk',trunk:.05,shadow:true,sway:.035,big:true},
 young:{file:'young-canopy-tree',h:[8,11.5],col:'trunk',trunk:.05,shadow:true,sway:.05,big:true},
 stump:{file:'mossy-stump',h:[.9,1.4],col:'box',wf:.62,shadow:true},
 log:{file:'fallen-log',h:[.8,1.15],col:'log',shadow:true,lenAxis:true},
 boulder:{file:'moss-crowned-boulder',h:[1.6,3.8],col:'box',wf:.7,shadow:true,big:true},
 stones:{file:'mossy-stone-cluster',h:[.7,1.4],col:'box',wf:.55,shadow:true},
 step:{file:'mossy-stepping-stone',h:[.18,.3],col:null,small:true},
 shrub:{file:'woodland-shrub',h:[1.1,1.9],col:null,small:true,sway:.08,dens:[1.3,.85]},
 fern:{file:'emerald-fern-cluster',h:[.7,1.2],col:null,small:true,sway:.1,dens:[1,.55]},
 grass:{file:'verdant-grass-crown',h:[.45,.8],col:null,small:true,sway:.14,dens:[.7,.22]},
 scarlet:{file:'scarlet-toadstools',h:[.4,.75],col:null,small:true},
 amethyst:{file:'amethyst-toadstool',h:[.5,.9],col:null,small:true,glow:true},
 /* variantes gigantes (mesma malha, outra escala) */
 gscarlet:{file:'scarlet-toadstools',h:[3.2,4.8],col:'stem',stem:.13,shadow:true,big:true,glow:false},
 gamethyst:{file:'amethyst-toadstool',h:[4,6.5],col:'stem',stem:.11,shadow:true,big:true,glow:true}
};

/* RNG determinístico: o mapa é sempre o mesmo */
let _fseed=90210;function frnd(){_fseed=(_fseed*16807)%2147483647;return (_fseed-1)/2147483646;}
function fdistSeg(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,L=dx*dx+dz*dz||1;let t=((px-ax)*dx+(pz-az)*dz)/L;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(ax+dx*t),pz-(az+dz*t));}
function forestPathDist(x,z){let m=1e9;for(const p of FOREST_CFG.paths)for(let i=0;i<p.length-1;i++)m=Math.min(m,fdistSeg(x,z,p[i][0],p[i][1],p[i+1][0],p[i+1][1]));return m;}
function fIn(r,x,z,k){return Math.hypot(x-r[0],z-r[1])<r[2]*(k||1);}
function forestRegion(x,z){const C=FOREST_CFG;
 if(fIn(C.clearing,x,z))return 'clareira';if(fIn(C.mush,x,z))return 'cogumelos';if(fIn(C.ancient,x,z))return 'pedras';if(fIn(C.dense,x,z))return 'densa';
 if(forestPathDist(x,z)<5)return 'caminho';return 'floresta';}

/* ---------- LAYOUT ---------- */
function forestLayout(){
 _fseed=90210;
 const C=FOREST_CFG,T=FOREST_TYPES,q=typeof curQ==='function'?curQ():1,vk=(typeof SUPERLOW!=='undefined'&&SUPERLOW)?.3:C.veg[q];
 const place={};for(const k in T)place[k]=[];
 const big=[];/* ocupação de objetos sólidos (x,z,r) */
 const free=(x,z,r)=>{if(Math.abs(x)>SZ-1.2||Math.abs(z)>SZ-1.2)return false;for(const b of big)if(Math.hypot(b.x-x,b.z-z)<b.r+r)return false;return true;};
 const add=(k,x,z,o)=>{const t=T[k];o=o||{};const h=o.h||(t.h[0]+frnd()*(t.h[1]-t.h[0]));
  const p={x,z,h,ry:o.ry!=null?o.ry:frnd()*6.283,tilt:o.tilt||0};place[k].push(p);
  if(t.col){const r=t.col==='trunk'?Math.max(.38,Math.min(.95,h*t.trunk)):t.col==='stem'?h*t.stem:t.col==='log'?1.6:h*.55;big.push({x,z,r:r+.25});}
  return p;};
 const scatter=(k,n,sample,opt)=>{opt=opt||{};let made=0;for(let t=0;t<n*14&&made<n;t++){const s=sample();if(!s)continue;const [x,z]=s;
   if(opt.noPath&&forestPathDist(x,z)<opt.noPath+FPW)continue;if(opt.noClear&&fIn(C.clearing,x,z,opt.noClear))continue;
   const r=opt.r||0;if(r&&!free(x,z,r))continue;if(opt.space&&place[k].some(p=>Math.hypot(p.x-x,p.z-z)<opt.space))continue;
   add(k,x,z,opt.o&&opt.o());made++;}};
 const inR=(r,k)=>()=>{const a=frnd()*6.283,d=Math.sqrt(frnd())*r[2]*(k||1);return [r[0]+Math.cos(a)*d,r[1]+Math.sin(a)*d];};
 const anywhere=()=>[(frnd()-.5)*(SZ*2-4),(frnd()-.5)*(SZ*2-4)];
 const nearPath=(w)=>()=>{const p=C.paths[(frnd()*C.paths.length)|0],i=(frnd()*(p.length-1))|0,t=frnd();
   const x=p[i][0]+(p[i+1][0]-p[i][0])*t,z=p[i][1]+(p[i+1][1]-p[i][1])*t,a=frnd()*6.283,d=w[0]+frnd()*(w[1]-w[0]);return [x+Math.cos(a)*d,z+Math.sin(a)*d];};

 /* 1. Pedras e árvores antigas (sudoeste): grandes rochas musgosas e anciãs gigantes */
 [[-30,22,3.6],[-21,30,3.2],[-33,31,3.8],[-24,19,2.6],[-17,25,2.4],[-29,37,3]].forEach(([x,z,h])=>{x*=FK;z*=FK;if(free(x,z,h*.6))add('boulder',x,z,{h});});
 [[-36,24],[-26,33],[-18,18],[-33,15]].forEach(([x,z])=>{x*=FK;z*=FK;if(free(x,z,1))add('elder',x,z,{h:17+frnd()*3});});
 scatter('stones',8,inR(C.ancient,1.1),{r:.9,noPath:2});
 scatter('boulder',4,inR(C.ancient,1.25),{r:1.8,noPath:2.6,o:()=>({h:1.6+frnd()*1.2})});
 /* 2. Região dos cogumelos (leste): cogumelos gigantes que brilham */
 [[24,16],[31,24],[22,27],[33,15],[27,30]].forEach(([x,z],i)=>{x*=FK;z*=FK;if(free(x,z,.9))add(i%2?'gscarlet':'gamethyst',x,z);});
 [[19,22],[35,27],[29,11]].forEach(([x,z])=>{x*=FK;z*=FK;if(free(x,z,.8))add('gamethyst',x,z,{h:3.4+frnd()*1.5});});
 scatter('amethyst',Math.round(40*vk)+8,inR(C.mush,1.15),{space:.8});
 scatter('scarlet',Math.round(34*vk)+6,inR(C.mush,1.25),{space:.8});
 /* 3. Caminho abandonado: troncos caídos, pedras e tocos nas margens; pedras de passo sobre a trilha */
 for(const p of C.paths)for(let i=0;i<p.length-1;i++){const L=Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]);
  for(let d=1.5;d<L;d+=2.4+frnd()*2.5){const t=d/L,x=p[i][0]+(p[i+1][0]-p[i][0])*t+(frnd()-.5)*1.2,z=p[i][1]+(p[i+1][1]-p[i][1])*t+(frnd()-.5)*1.2;
   if(frnd()<.55*vk+.25)add('step',x,z);}}
 scatter('log',14,nearPath([3.4,6]),{r:1.8,noClear:.9,o:()=>({h:.8+frnd()*.35})});
 scatter('stump',16,nearPath([2.8,7]),{r:.8});
 scatter('stones',14,nearPath([2.8,6]),{r:.8});
 /* 4. Floresta densa (noroeste): árvores próximas, arbustos e samambaias — local de emboscada */
 scatter('young',14,inR(C.dense,1),{r:1.6,noPath:2.2});
 scatter('elder',5,inR(C.dense,1),{r:1.6,noPath:2.4});
 scatter('shrub',Math.round(60*vk)+10,inR(C.dense,1.05),{noPath:1.4,space:1.3});
 scatter('fern',Math.round(70*vk)+10,inR(C.dense,1.05),{noPath:1.1,space:1});
 scatter('log',5,inR(C.dense,.9),{r:1.8,noPath:2.4});
 scatter('stump',6,inR(C.dense,.9),{r:.8,noPath:2});
 /* 5. Clareira central: aberta para combate, vegetação nas bordas */
 for(let i=0;i<20;i++){const a=i/20*6.283+frnd()*.2,d=C.clearing[2]+1+frnd()*3,x=Math.cos(a)*d,z=Math.sin(a)*d;
  if(forestPathDist(x,z)<2.4)continue;const r=frnd();
  if(r<.35){if(free(x,z,1.3))add(frnd()<.5?'young':'elder',x,z);}else if(r<.75)add('shrub',x,z);else add('fern',x,z);}
 [[5,-4],[-4,3],[-1,-6]].forEach(([x,z])=>{x*=FK;z*=FK;if(free(x,z,.6))add('stones',x,z,{h:.8});});
 add('stump',-6*FK,-3*FK,{h:1.1});
 scatter('grass',Math.round(46*vk)+8,inR(C.clearing,.95),{space:1.4});
 /* 6. Anel externo: parede natural de árvores (limite do mapa) */
 for(let i=0;i<150;i++){const a=i/150*6.283+frnd()*.03,r=(41+frnd()*3.5)*FK;let x=Math.cos(a)*r*1.08,z=Math.sin(a)*r*1.08;
  x=Math.max(-SZ+1.6,Math.min(SZ-1.6,x));z=Math.max(-SZ+1.6,Math.min(SZ-1.6,z));
  if(free(x,z,1.1))add(frnd()<.45?'elder':'young',x,z);}
 /* 7. Floresta mista no restante */
 scatter('young',30,anywhere,{r:1.6,noPath:2.6,noClear:1.25});
 scatter('elder',12,anywhere,{r:2,noPath:2.8,noClear:1.3});
 scatter('boulder',12,anywhere,{r:1.6,noPath:2.6,noClear:1.1,o:()=>({h:1.4+frnd()*1.4})});
 scatter('stones',16,anywhere,{r:.8,noPath:2,noClear:1});
 scatter('stump',8,anywhere,{r:.8,noPath:2,noClear:1});
 scatter('log',10,anywhere,{r:1.8,noPath:2.6,noClear:1.1});
 scatter('shrub',Math.round(80*vk)+12,anywhere,{noPath:1.4,noClear:.95,space:1.6});
 scatter('fern',Math.round(90*vk)+12,anywhere,{noPath:1.1,noClear:.9,space:1.2});
 scatter('grass',Math.round(190*vk)+20,anywhere,{noPath:.9,space:1.1});
 scatter('scarlet',Math.round(24*vk)+4,anywhere,{noPath:1});
 scatter('amethyst',Math.round(10*vk)+2,anywhere,{noPath:1});
 return place;
}

/* ---------- COLISÃO + PROXIES DE RAYCAST + DENSIDADE ---------- */
const _fProxyMat=new THREE.MeshBasicMaterial({visible:false});
function forestColliders(){
 FOREST.cols.length=0;FOREST.solids.length=0;
 const g=FOREST.g;
 if(FOREST.proxy){g.remove(FOREST.proxy);}
 const pg=new THREE.Group();FOREST.proxy=pg;g.add(pg);
 const addCol=(x,z,hw,hd,top,kind)=>{const c={x0:x-hw,x1:x+hw,z0:z-hd,z1:z+hd,top,bot:0,forest:kind};FOREST.cols.push(c);return c;};
 const proxy=(geo,x,y,z,ry)=>{const m=new THREE.Mesh(geo,_fProxyMat);m.position.set(x,y,z);if(ry)m.rotation.y=ry;pg.add(m);m.updateMatrixWorld(true);FOREST.solids.push(m);return m;};
 for(const k in FOREST_TYPES){const T=FOREST_TYPES[k],I=FOREST.types[k];if(!T.col||!I)continue;
  for(const p of I.place){
   const w=(I.footW||1.25)*p.h,len=(I.footL||5)*p.h;
   if(T.col==='trunk'){const r=Math.max(.32,Math.min(1,(I.trunkF||T.trunk)*p.h));p.r=r;addCol(p.x,p.z,r*.85,r*.85,p.h*.6,'tree');
    proxy(new THREE.CylinderGeometry(r,r*1.15,Math.min(7,p.h*.5),6),p.x,Math.min(7,p.h*.5)/2,p.z);}
   else if(T.col==='stem'){const r=(I.stemF||T.stem)*p.h;p.r=r;addCol(p.x,p.z,r,r,p.h*.75,'mush');
    proxy(new THREE.CylinderGeometry(r,r,p.h*.75,6),p.x,p.h*.375,p.z);}
   else if(T.col==='box'){const hw=w*T.wf*.5;p.r=hw;addCol(p.x,p.z,hw,hw,p.h*.92,k==='boulder'?'rock':'low');
    proxy(new THREE.BoxGeometry(hw*2,p.h*.92,hw*2),p.x,p.h*.46,p.z);}
   else if(T.col==='log'){
    /* tronco caído: várias caixas pequenas ao longo do comprimento (o AABB inteiro bloquearia demais) */
    const ax=Math.cos(p.ry),az=-Math.sin(p.ry),L=len*.9,n=Math.max(2,Math.ceil(L/1.1));p.r=L/2;
    for(let i=0;i<n;i++){const t=(i+.5)/n-.5,cx=p.x+ax*L*t,cz=p.z+az*L*t;addCol(cx,cz,.42,.42,p.h*.85,'log');}
    const bx=new THREE.BoxGeometry(L,p.h*.85,w*.7);proxy(bx,p.x,p.h*.42,p.z,p.ry);}
  }}
 /* limites invisíveis atrás do anel de árvores */
 addCol(0,-SZ,SZ+1,1,6,'edge');addCol(0,SZ,SZ+1,1,6,'edge');addCol(-SZ,0,1,SZ+1,6,'edge');addCol(SZ,0,1,SZ+1,6,'edge');
}
function forestDensity(){
 const C=FOREST.densC,N=Math.ceil(SZ*2/C);FOREST.densN=N;const D=new Float32Array(N*N);FOREST.dens=D;
 const stamp=(x,z,r,v)=>{const i0=Math.max(0,Math.floor((x-r+SZ)/C)),i1=Math.min(N-1,Math.floor((x+r+SZ)/C)),j0=Math.max(0,Math.floor((z-r+SZ)/C)),j1=Math.min(N-1,Math.floor((z+r+SZ)/C));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const cx=-SZ+(i+.5)*C,cz=-SZ+(j+.5)*C,d=Math.hypot(cx-x,cz-z);if(d<r)D[j*N+i]+=v*(1-d/r*.5);}};
 for(const k in FOREST_TYPES){const T=FOREST_TYPES[k],I=FOREST.types[k];if(!I)continue;
  if(T.dens)for(const p of I.place)stamp(p.x,p.z,T.dens[0]*(p.h/T.h[1]+.4),T.dens[1]);
  else if(T.col==='trunk')for(const p of I.place)stamp(p.x,p.z,2.2,.22);}
 const R=FOREST_CFG.dense;stamp(R[0],R[1],R[2],.35);
 for(let i=0;i<D.length;i++)D[i]=Math.min(1.6,D[i]);
}
/* densidade da vegetação (0 = aberto, >1 = mata fechada) */
function forestDensAt(x,z){if(!FOREST.active||!FOREST.dens)return 0;const C=FOREST.densC,N=FOREST.densN,i=Math.floor((x+SZ)/C),j=Math.floor((z+SZ)/C);if(i<0||j<0||i>=N||j>=N)return 0;return FOREST.dens[j*N+i];}
/* quanta vegetação há entre dois pontos (opacidade acumulada) */
function forestFoliageBetween(ax,az,bx,bz){
 if(!FOREST.active||!FOREST.dens)return 0;const L=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(L/1.2));let s=0;
 for(let i=1;i<n;i++){const t=i/n;s+=forestDensAt(ax+(bx-ax)*t,az+(bz-az)*t)*(L/n);}return s;}

/* ---------- TEXTURAS DO CHÃO, TRILHA E LUZ ---------- */
function forestCanvasTex(size,draw,rep){const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');draw(g,size);
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep,rep);t.encoding=THREE.sRGBEncoding;
 t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy?renderer.capabilities.getMaxAnisotropy():1);return t;}
function forestGroundTex(){
 const sz=(typeof curQ==='function'&&curQ()>=2)?512:256;
 return forestCanvasTex(sz,(g,s)=>{
  g.fillStyle='#3a3420';g.fillRect(0,0,s,s);
  const blob=(n,cols,r0,r1,a)=>{for(let i=0;i<n;i++){const x=frnd()*s,y=frnd()*s,r=(r0+frnd()*(r1-r0))*s/256;g.globalAlpha=a*(.5+frnd()*.5);g.fillStyle=cols[(frnd()*cols.length)|0];
   g.beginPath();g.ellipse(x,y,r,r*(.5+frnd()*.6),frnd()*3,0,6.283);g.fill();
   for(const [ox,oy] of [[s,0],[-s,0],[0,s],[0,-s]]){g.beginPath();g.ellipse(x+ox,y+oy,r,r*.7,0,0,6.283);g.fill();}}};
  blob(60,['#4a5a26','#3e5222','#55652c'],10,34,.5);   /* musgo */
  blob(90,['#5a4428','#6b4f2c','#4a3a22','#7a5a30'],2,6,.8); /* folhas secas */
  blob(140,['#2a2414','#30291a'],1,3,.6);             /* terra */
  blob(50,['#6e7a34','#808a3a'],1,3,.5);              /* brotos */
  g.globalAlpha=1;
 },22);
}
function forestPathTex(){return forestCanvasTex(128,(g,s)=>{const gr=g.createLinearGradient(0,0,s,0);gr.addColorStop(0,'rgba(92,72,46,0)');gr.addColorStop(.22,'rgba(92,72,46,.85)');
 gr.addColorStop(.5,'rgba(104,84,54,.95)');gr.addColorStop(.78,'rgba(92,72,46,.85)');gr.addColorStop(1,'rgba(92,72,46,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);
 for(let i=0;i<220;i++){g.fillStyle=frnd()<.5?'rgba(60,46,30,.6)':'rgba(130,110,80,.5)';const x=s*.2+frnd()*s*.6;g.fillRect(x,frnd()*s,1+frnd()*2,1+frnd()*2);}});}
function forestShaftTex(){const c=document.createElement('canvas');c.width=8;c.height=128;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,128);
 gr.addColorStop(0,'rgba(255,240,200,0)');gr.addColorStop(.15,'rgba(255,236,190,.9)');gr.addColorStop(.7,'rgba(255,226,170,.35)');gr.addColorStop(1,'rgba(255,220,160,0)');g.fillStyle=gr;g.fillRect(0,0,8,128);return new THREE.CanvasTexture(c);}

/* ---------- CONSTRUÇÃO ---------- */
function forestWithSZ(fn){const o=SZ;SZ=FOREST_SZ;try{return fn();}finally{if(!FOREST.active)SZ=o;}}
function forestBuild(){
 if(FOREST.built)return;FOREST.built=true;const _oSZ=SZ;SZ=FOREST_SZ;try{forestBuildInner();}finally{if(!FOREST.active)SZ=_oSZ;}}
function forestBuildInner(){
 const g=new THREE.Group();g.name='enchanted-wilds';FOREST.g=g;
 const place=forestLayout();
 for(const k in FOREST_TYPES)FOREST.types[k]={place:place[k],ims:[],ready:false};
 /* chão com textura de folhas/musgo/terra */
 const gg=new THREE.PlaneGeometry(SZ*2+40,SZ*2+40);
 const gm=new THREE.MeshStandardMaterial({map:forestGroundTex(),roughness:1,metalness:0,color:0xd8d2c0});
 const ground=new THREE.Mesh(gg,gm);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;g.add(ground);
 /* trilhas de terra */
 const pm=new THREE.MeshStandardMaterial({map:forestPathTex(),transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-2});
 for(const p of FOREST_CFG.paths)for(let i=0;i<p.length-1;i++){const [ax,az]=p[i],[bx,bz]=p[i+1],L=Math.hypot(bx-ax,bz-az)+2.2;
  const geo=new THREE.PlaneGeometry(6.5,L);const uv=geo.attributes.uv;for(let v=0;v<uv.count;v++)uv.setY(v,uv.getY(v)*L/7);
  const m=new THREE.Mesh(geo,pm);m.rotation.x=-Math.PI/2;m.rotation.z=-Math.atan2(bx-ax,bz-az)+Math.PI;m.position.set((ax+bx)/2,.015+i*.001,(az+bz)/2);m.receiveShadow=true;g.add(m);}
 /* clareira com terra mais clara no centro */
 const cm=new THREE.MeshBasicMaterial({map:dirtTex,transparent:true,depthWrite:false,opacity:.55,polygonOffset:true,polygonOffsetFactor:-1});
 const cl=new THREE.Mesh(new THREE.PlaneGeometry(20,20),cm);cl.rotation.x=-Math.PI/2;cl.position.y=.012;g.add(cl);
 /* feixes de luz atravessando as copas */
 const q=curQ(),stex=forestShaftTex();
 const shaftSpots=[[0,0,1.4],[-6,4,1],[5,-5,1.1],[-22,-20,.8],[-28,-28,.7],[27,20,.9],[-26,26,1],[14,14,.8],[2,24,.8],[18,-20,.8],[-14,10,.7]];
 shaftSpots.slice(0,q<=0?4:q===1?7:11).forEach(([x,z,s],i)=>{x*=FK;z*=FK;
  const mat=new THREE.MeshBasicMaterial({map:stex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,opacity:.12,color:i===5?0xa070ff:0x9ab8ff,fog:false});
  const m=new THREE.Mesh(new THREE.CylinderGeometry(.9*s,3.2*s,24,10,1,true),mat);
  m.position.set(x-3.5,11,z-2);m.rotation.set(.18,0,.22);g.add(m);FOREST.shafts.push({m,ph:frnd()*6,base:.07+frnd()*.06});});
 /* luzes dos cogumelos (só a partir da qualidade Média) */
 if(q>=1&&!(typeof SUPERLOW!=='undefined'&&SUPERLOW)){
  const l1=new THREE.PointLight(0xb070ff,1.6,22,1.6);l1.position.set(26*FK,3,22*FK);g.add(l1);
  const l2=new THREE.PointLight(0x40e0c0,1.0,16,1.6);l2.position.set(31*FK,2.5,15*FK);g.add(l2);FOREST.lights.push(l1,l2);}
 /* partículas ambientais: poeira dourada perto do jogador + esporos nos cogumelos */
 const mk=(n,col,size,op)=>{const geo=new THREE.BufferGeometry(),a=new Float32Array(n*3);geo.setAttribute('position',new THREE.BufferAttribute(a,3));
  const m=new THREE.Points(geo,new THREE.PointsMaterial({map:glowTex,color:col,size,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));m.frustumCulled=false;return m;};
 const nm=[40,80,140,200][q];FOREST.motes=mk(nm,0xb8ff70,.14,.85);g.add(FOREST.motes);
 {const a=FOREST.motes.geometry.attributes.position.array;for(let i=0;i<nm;i++){a[i*3]=(frnd()-.5)*30;a[i*3+1]=.3+frnd()*6;a[i*3+2]=(frnd()-.5)*30;}}
 const ns=[30,50,80,110][q];FOREST.spores=mk(ns,0xc890ff,.22,.9);g.add(FOREST.spores);
 {const a=FOREST.spores.geometry.attributes.position.array;const M=FOREST_CFG.mush;for(let i=0;i<ns;i++){const an=frnd()*6.283,d=Math.sqrt(frnd())*M[2];a[i*3]=M[0]+Math.cos(an)*d;a[i*3+1]=.2+frnd()*4;a[i*3+2]=M[1]+Math.sin(an)*d;}}
 forestColliders();forestDensity();
 FOREST.spawns=FOREST_CFG.spawns.filter(([x,z])=>!hitsBoxList(FOREST.cols,x,z,1));
}
function hitsBoxList(list,x,z,r){for(const b of list)if(x>b.x0-r&&x<b.x1+r&&z>b.z0-r&&z<b.z1+r)return b;return null;}

/* vento na vegetação: deslocamento no vertex shader, proporcional à altura */
function forestSway(mat,amp,hLocal){
 mat.onBeforeCompile=sh=>{sh.uniforms.uFT=FOREST.uT;sh.uniforms.uFA={value:amp};sh.uniforms.uFH={value:hLocal};
  sh.vertexShader='uniform float uFT;uniform float uFA;uniform float uFH;\n'+sh.vertexShader.replace('#include <begin_vertex>',
  `#include <begin_vertex>
  float fk=clamp(position.y/uFH,0.,1.);fk*=fk;
  #ifdef USE_INSTANCING
  float fph=instanceMatrix[3][0]*.35+instanceMatrix[3][2]*.27;
  #else
  float fph=0.;
  #endif
  transformed.x+=sin(uFT*1.6+fph)*fk*uFA*uFH+sin(uFT*3.7+fph*2.)*fk*uFA*uFH*.3;
  transformed.z+=cos(uFT*1.3+fph)*fk*uFA*uFH*.6;`);};
 mat.customProgramCacheKey=()=>'fsway';
}

/* carrega os 12 modelos (+ LOD) e cria as InstancedMesh */
function forestLoad(){
 if(FOREST.loading)return FOREST.loading;
 const loader=new THREE.GLTFLoader(),files={};
 for(const k in FOREST_TYPES)files[FOREST_TYPES[k].file]=1;
 const get=url=>new Promise(res=>loader.load(url,gl=>res(gl),undefined,err=>{console.warn('Floresta: falha ao carregar',url,err);res(null);}));
 const meshOf=gl=>{let m=null;gl.scene.updateMatrixWorld(true);gl.scene.traverse(o=>{if(o.isMesh&&!m)m=o;});return m;};
 const jobs=Object.keys(files).map(f=>Promise.all([get(FOREST_CFG.path+f+'.glb'),get(FOREST_CFG.path+f+'-lod.glb')]).then(([a,b])=>{files[f]=a&&{a:meshOf(a),b:b&&meshOf(b)};}));
 FOREST.loading=Promise.all(jobs).then(()=>{
  const q=curQ();
  let changed=false;
  for(const k in FOREST_TYPES){const T=FOREST_TYPES[k],I=FOREST.types[k],src=files[T.file];if(!src||!src.a||!I)continue;
   const g0=src.a.geometry.clone().applyMatrix4(src.a.matrixWorld);g0.computeBoundingBox();const bb=g0.boundingBox,H=Math.max(.001,bb.max.y-bb.min.y);
   const sh=new THREE.Matrix4().makeTranslation(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2);
   const sc=new THREE.Matrix4().makeScale(1/H,1/H,1/H);const norm=sc.multiply(sh);g0.applyMatrix4(norm);
   let g1=null;if(src.b){g1=src.b.geometry.clone().applyMatrix4(src.b.matrixWorld).applyMatrix4(norm);}
   /* mede a pegada real do modelo (largura/comprimento, raio do tronco) para colisão */
   g0.computeBoundingBox();const b2=g0.boundingBox;I.footW=Math.min(b2.max.x-b2.min.x,b2.max.z-b2.min.z);I.footL=Math.max(b2.max.x-b2.min.x,b2.max.z-b2.min.z);
   if(T.col==='trunk'||T.col==='stem'){const pos=g0.attributes.position;let r=0,n=0;const lim=T.col==='trunk'?.06:.18;
    for(let i=0;i<pos.count;i++){const y=pos.getY(i);if(y>.01&&y<lim){r+=Math.hypot(pos.getX(i),pos.getZ(i));n++;}}
    if(n>8){const f=Math.max(.02,Math.min(.12,r/n*.8));if(T.col==='trunk')I.trunkF=f;else I.stemF=Math.min(.2,f);changed=true;}}
   if(T.col==='log'){/* o comprimento do tronco caído fica no eixo X (comprimento real medido) */I.footL=b2.max.x-b2.min.x;I.footW=b2.max.z-b2.min.z;changed=true;}
   if(T.col==='box')changed=true;
   g0.computeBoundingSphere();I.rad=g0.boundingSphere.radius;
   const mat=src.a.material.clone();
   if(T.glow){mat.emissive=new THREE.Color(0xa060ff);mat.emissiveMap=mat.map;mat.emissiveIntensity=k==='gamethyst'?.85:.5;}
   if(T.sway&&q>=1)forestSway(mat,T.sway,1);
   const n=I.place.length;if(!n)continue;
   const mkIM=(geo,cast)=>{const im=new THREE.InstancedMesh(geo,mat,n);im.count=0;im.frustumCulled=false;im.castShadow=cast;im.receiveShadow=true;FOREST.g.add(im);return im;};
   I.near=mkIM(g0,!!T.shadow);I.far=g1?mkIM(g1,!!T.shadow&&q>=2&&T.big):null;
   I.mats=I.place.map(p=>{const m=new THREE.Matrix4(),qq=new THREE.Quaternion().setFromEuler(new THREE.Euler(p.tilt||0,p.ry,0));m.compose(new THREE.Vector3(p.x,0,p.z),qq,new THREE.Vector3(p.h,p.h,p.h));return m;});
   I.ready=true;
  }
  if(changed){const was=FOREST.active;if(was)forestSwapOut();forestWithSZ(()=>{forestColliders();forestDensity();});if(was){forestSwapIn();if(typeof NAV!=='undefined')NAV.blk=null;}}
  FOREST.loaded=true;FOREST.lodT=0;
 });
 return FOREST.loading;
}

/* LOD + culling por instância (frustum + distância) */
const _fFr=new THREE.Frustum(),_fPM=new THREE.Matrix4(),_fSp=new THREE.Sphere();
function forestLOD(){
 if(!FOREST.loaded)return;
 cam.updateMatrixWorld();_fPM.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);_fFr.setFromProjectionMatrix(_fPM);
 const q=curQ(),cx=cam.position.x,cz=cam.position.z,near=FOREST_CFG.lodNear[q],far=FOREST_CFG.drawFar[q],small=FOREST_CFG.drawSmall[q];
 for(const k in FOREST.types){const I=FOREST.types[k],T=FOREST_TYPES[k];if(!I.ready)continue;
  let a=0,b=0;const A=I.near.instanceMatrix.array,B=I.far?I.far.instanceMatrix.array:null;const lim=T.small?small:far,nr=T.small?Math.min(near,10):near;
  for(let i=0;i<I.place.length;i++){const p=I.place[i],d=Math.hypot(p.x-cx,p.z-cz);if(d>lim)continue;
   _fSp.center.set(p.x,p.h*.5,p.z);_fSp.radius=I.rad*p.h+2;
   if(d>14&&!_fFr.intersectsSphere(_fSp))continue;   /* sombras próximas continuam visíveis */
   if(d<nr||!B){A.set(I.mats[i].elements,a*16);a++;}else{B.set(I.mats[i].elements,b*16);b++;}}
  I.near.count=a;I.near.instanceMatrix.needsUpdate=true;if(I.far){I.far.count=b;I.far.instanceMatrix.needsUpdate=true;}}
}

/* ---------- ENTRAR / SAIR DO MAPA ---------- */
function forestSwapIn(){for(const c of FOREST.cols)colliders.push(c);for(const s of FOREST.solids)solids.push(s);}
function forestSwapOut(){for(const c of FOREST.cols){const i=colliders.indexOf(c);if(i>=0)colliders.splice(i,1);}for(const s of FOREST.solids){const i=solids.indexOf(s);if(i>=0)solids.splice(i,1);}}
function forestEnter(){
 forestBuild();
 if(!FOREST.active){
  FOREST.oSZ=SZ;SZ=FOREST_SZ;
  FOREST.save={cols:colliders.slice(),solids:solids.slice(),wv:world.visible,spawns:SPAWNS.map(s=>s.slice()),sky:window.__sky?window.__sky.visible:true,far:cam.far};
  colliders.length=0;solids.length=0;forestSwapIn();
  SPAWNS.length=0;FOREST.spawns.forEach(s=>SPAWNS.push(s.slice()));
  world.visible=false;if(!FOREST.g.parent)scene.add(FOREST.g);
  barrels.forEach(b=>{b.userData._fh=b.visible;});
  FOREST.active=true;
 }
 if(window.__sky)window.__sky.visible=false;
 P.x=FOREST_CFG.start.x;P.z=FOREST_CFG.start.z;P.yaw=FOREST_CFG.start.yaw;P.y=0;P.vy=0;
 if(typeof NAV!=='undefined')NAV.blk=null;
 FOREST.lodT=0;
 if(typeof GFX!=='undefined')GFX.skyKey='';envApplyLighting(envSkyColor(ENV.time));
 forestLoad().then(()=>{if(FOREST.active)forestLOD();});
 forestAudioStart();
 if(!FOREST.moon||!FOREST.moon.parent)scene.add(forestMoon());forestHorrorFx(true);
}
function forestExit(){
 if(!FOREST.active)return;
 FOREST.active=false;SZ=FOREST.oSZ||45;
 if(FOREST.g&&FOREST.g.parent)scene.remove(FOREST.g);
 const S=FOREST.save;
 if(S){colliders.length=0;solids.length=0;S.cols.forEach(c=>colliders.push(c));S.solids.forEach(s=>solids.push(s));world.visible=S.wv;
  SPAWNS.length=0;S.spawns.forEach(s=>SPAWNS.push(s));if(window.__sky)window.__sky.visible=S.sky!==false;}
 FOREST.save=null;
 if(typeof NAV!=='undefined')NAV.blk=null;
 forestAudioStop();if(FOREST.moon)scene.remove(FOREST.moon);forestHorrorFx(false);
 if(typeof GFX!=='undefined')GFX.skyKey='';envApplyLighting(envSkyColor(ENV.time));if(typeof gSetLightDirFollow==='function')gSetLightDirFollow();
}

/* ---------- ILUMINAÇÃO POR REGIÃO ---------- */
const _fc1=new THREE.Color(),_fc2=new THREE.Color();
function forestLighting(){
 if(!FOREST.active)return;
 const R=FOREST.regionK,wet=ENV.weather==='rain'||ENV.weather==='storm',bri=save.bri||1;
 /* NOITE NO BOSQUE ASSOMBRADO: névoa azul-petróleo, luar frio; mata densa quase negra; cogumelos violeta; pedras antigas esverdeadas */
 _fc1.setHex(wet?0x141a20:0x16202a);
 _fc1.lerp(_fc2.setHex(0x0a100c),R.d*.75).lerp(_fc2.setHex(0x2a1838),R.m*.8).lerp(_fc2.setHex(0x142420),R.a*.6);
 scene.fog.color.copy(_fc1);scene.background.copy(_fc1);
 const q=curQ();scene.fog.near=(wet?3:5)-R.d*2;scene.fog.far=(wet?40:[46,52,60,66][q])-R.d*12;
 hemi.color.setHex(0x6a7ea0);hemi.groundColor.setHex(0x1a1612);hemi.intensity=(wet?.42:.5)+R.c*.06;
 sun.color.setHex(0xa8c0ff);sun.intensity=(wet?.45:.75)*(1-R.d*.35);
 if(typeof fill!=='undefined'){fill.color.setHex(R.m>.3?0x9a50ff:0x3a5070);fill.intensity=.18+R.m*.3;}
 renderer.toneMappingExposure=(wet?.95:1.02)*bri*(ENV.nvOn?1.3:1);
 if(typeof _gDir!=='undefined')_gDir.set(-.4,.55,-.8).normalize();
 if(window.__sunGlow)window.__sunGlow.visible=false;if(window.__moonGlow)window.__moonGlow.visible=false;
 if(typeof GFX!=='undefined')GFX.emergK=0;
}
/* LUA cheia: disco com crateras + halo, sempre no horizonte na direção da luz */
function forestMoon(){
 if(FOREST.moon)return FOREST.moon;
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 const halo=g.createRadialGradient(128,128,30,128,128,128);halo.addColorStop(0,'rgba(200,215,255,.55)');halo.addColorStop(.45,'rgba(150,170,230,.18)');halo.addColorStop(1,'rgba(120,140,200,0)');g.fillStyle=halo;g.fillRect(0,0,256,256);
 const disc=g.createRadialGradient(118,118,4,128,128,44);disc.addColorStop(0,'#f6f4ea');disc.addColorStop(1,'#cfd4dc');g.fillStyle=disc;g.beginPath();g.arc(128,128,44,0,6.283);g.fill();
 g.fillStyle='rgba(120,128,140,.35)';[[112,116,9],[140,130,7],[124,146,6],[146,110,5],[106,138,4]].forEach(([x,y,r])=>{g.beginPath();g.arc(x,y,r,0,6.283);g.fill();});
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
 const m=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,fog:false,color:0xffffff}));m.scale.set(80,80,1);m.renderOrder=-1;
 FOREST.moon=m;return m;
}
/* "shader" de horror: vinheta escura, tom frio e granulação (sobreposição leve, sem custo de GPU extra) */
function forestHorrorFx(on){
 let v=document.getElementById('hauntFx');
 if(!v){v=document.createElement('div');v.id='hauntFx';document.body.appendChild(v);
  const st=document.createElement('style');st.textContent=
  '#hauntFx{position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity 1.2s;'+
  'background:radial-gradient(ellipse at center,rgba(0,0,0,0) 38%,rgba(4,8,14,.55) 72%,rgba(0,0,0,.92) 100%),linear-gradient(rgba(20,40,60,.12),rgba(30,0,20,.12));mix-blend-mode:multiply}'+
  '#hauntFx:after{content:"";position:absolute;inset:-50%;opacity:.07;background-image:url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27><filter id=%27n%27><feTurbulence baseFrequency=%27.9%27 numOctaves=%272%27/></filter><rect width=%27160%27 height=%27160%27 filter=%27url(%23n)%27/></svg>");animation:hauntGrain .4s steps(3) infinite}'+
  '@keyframes hauntGrain{0%{transform:translate(0,0)}33%{transform:translate(-4%,3%)}66%{transform:translate(3%,-4%)}100%{transform:translate(0,0)}}'+
  '#hauntFx.pulse{animation:hauntPulse 1.6s ease-out}@keyframes hauntPulse{0%{background-color:rgba(120,0,0,.25)}100%{background-color:rgba(0,0,0,0)}}';
  document.head.appendChild(st);}
 v.style.opacity=on?1:0;
}
{const _l=envApplyLighting;envApplyLighting=function(col){_l(col);if(FOREST.active)forestLighting();};}

/* ---------- ÁUDIO AMBIENTE (vento, chuva, pássaros, passos em folhas/solo molhado) ----------
   O pacote recebido traz apenas modelos (sem .ogg/.wav); os sons são sintetizados em tempo real
   e respeitam o volume das configurações (save.vol). */
function forestNoiseBuf(){if(FOREST._nb)return FOREST._nb;const n=AC.sampleRate*2,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);let last=0;
 for(let i=0;i<n;i++){const w=Math.random()*2-1;last=(last+.02*w)/1.02;d[i]=w*.6+last*3;}FOREST._nb=b;return b;}
function forestAudioStart(){
 if(!AC||FOREST.audio)return;
 try{
  const mk=(type,f,qv)=>{const s=AC.createBufferSource();s.buffer=forestNoiseBuf();s.loop=true;const fl=AC.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=qv||.7;const g=AC.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(AC.destination);s.start(0,Math.random()*1.5);return {s,fl,g};};
  FOREST.audio={wind:mk('lowpass',420,.6),leaves:mk('bandpass',2600,.9),rain:mk('highpass',1400,.5),bird:0,t:0};
 }catch(e){console.warn('Floresta: áudio indisponível',e);}
}
function forestAudioStop(){const A=FOREST.audio;if(!A)return;for(const k of ['wind','leaves','rain']){try{A[k].g.gain.setTargetAtTime(0,AC.currentTime,.3);const s=A[k].s;setTimeout(()=>{try{s.stop();}catch(e){}},1500);}catch(e){}}FOREST.audio=null;}
function forestAudioUpdate(dt){
 if(!AC)return;if(!FOREST.audio)forestAudioStart();const A=FOREST.audio;if(!A)return;
 A.t+=dt;const v=save.vol||0,now=AC.currentTime,wet=ENV.weather==='rain'||ENV.weather==='storm';
 const gust=.55+.45*Math.sin(A.t*.23)*Math.sin(A.t*.61+1);
 A.wind.g.gain.setTargetAtTime(v*.11*gust,now,.8);A.wind.fl.frequency.setTargetAtTime(300+gust*260,now,.8);
 A.leaves.g.gain.setTargetAtTime(v*.028*gust*gust,now,.6);
 A.rain.g.gain.setTargetAtTime(wet?v*(ENV.weather==='storm'?.16:.1):0,now,1.5);
 /* pássaros e insetos ocasionais (silenciam quando há monstros perto) */
 A.bird-=dt;if(A.bird<=0){A.bird=3+Math.random()*7;
  const calm=!enemies.some(e=>e.monster&&e.state!=='dead'&&Math.hypot(e.pos.x-P.x,e.pos.z-P.z)<18);
  if(calm&&!wet){if(Math.random()<.6){const f=380+Math.random()*60;snd(f,.35,'sine',.05,f*.85);setTimeout(()=>snd(f*.95,.5,'sine',.045,f*.8),450);}else{snd(520,1.6,'sine',.03,300);}}
  else if(!calm&&Math.random()<.5)snd(90+Math.random()*30,.6,'triangle',.03,60);}
}
/* passos: folhas secas ou solo molhado; vegetação densa faz farfalhar */
function forestStep(){
 if(!AC||save.vol<=0)return false;
 try{const wet=ENV.weather==='rain'||ENV.weather==='storm',d=forestDensAt(P.x,P.z);
  const s=AC.createBufferSource();s.buffer=forestNoiseBuf();const f=AC.createBiquadFilter();f.type='bandpass';
  f.frequency.value=wet?520+Math.random()*200:1700+Math.random()*1300;f.Q.value=wet?1.4:.8;const g=AC.createGain(),t=AC.currentTime,L=wet?.16:.11;
  const vol=(P.crouch?.12:.26)*save.vol;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+L);
  s.connect(f);f.connect(g);g.connect(AC.destination);s.start(t,Math.random()*1.5,L+.05);
  if(d>.45){const s2=AC.createBufferSource();s2.buffer=FOREST._nb;const f2=AC.createBiquadFilter();f2.type='highpass';f2.frequency.value=2800;const g2=AC.createGain();
   g2.gain.setValueAtTime(0,t);g2.gain.linearRampToValueAtTime(Math.min(.2,d*.12)*save.vol,t+.05);g2.gain.exponentialRampToValueAtTime(.001,t+.35);s2.connect(f2);f2.connect(g2);g2.connect(AC.destination);s2.start(t,Math.random(),.4);}
  return true;}catch(e){return false;}
}
{const _f=SFX.foot;SFX.foot=function(){if(FOREST.active&&forestStep())return;_f();};}

/* ---------- ATUALIZAÇÃO POR QUADRO ---------- */
function forestUpdate(dt){
 if(!FOREST.active)return;
 FOREST.uT.value+=dt;
 FOREST.lodT-=dt;if(FOREST.lodT<=0){FOREST.lodT=.25;forestLOD();}
 /* mistura de iluminação por região (transição suave) */
 const C=FOREST_CFG,R=FOREST.regionK,k=Math.min(1,dt*1.2);
 const w=(r,x)=>Math.max(0,Math.min(1,(r[2]*1.15-Math.hypot(P.x-r[0],P.z-r[1]))/(r[2]*.5)));
 R.d+=(w(C.dense)-R.d)*k;R.m+=(w(C.mush)-R.m)*k;R.a+=(w(C.ancient)-R.a)*k;R.c+=(w(C.clearing)-R.c)*k;
 FOREST._lt=(FOREST._lt||0)-dt;if(FOREST._lt<=0){FOREST._lt=.2;forestLighting();}
 for(const s of FOREST.shafts)s.m.material.opacity=s.base*(.75+.25*Math.sin(FOREST.uT.value*.4+s.ph))*(ENV.weather==='storm'?.3:1);
 for(const l of FOREST.lights)l.intensity=(l.color.r>.5?1.6:1)*(.85+.15*Math.sin(FOREST.uT.value*1.3+l.position.x));
 /* poeira dourada acompanha o jogador (envolve as bordas) */
 if(FOREST.motes){const a=FOREST.motes.geometry.attributes.position.array,t=FOREST.uT.value;
  for(let i=0;i<a.length;i+=3){a[i]+=Math.sin(t*.5+i)*dt*.25;a[i+1]+=Math.cos(t*.3+i*.7)*dt*.12;a[i+2]+=Math.cos(t*.4+i)*dt*.25;
   if(a[i]-P.x>15)a[i]-=30;else if(a[i]-P.x<-15)a[i]+=30;if(a[i+2]-P.z>15)a[i+2]-=30;else if(a[i+2]-P.z<-15)a[i+2]+=30;if(a[i+1]>6.5)a[i+1]=.3;else if(a[i+1]<.2)a[i+1]=6;}
  FOREST.motes.geometry.attributes.position.needsUpdate=true;}
 if(FOREST.spores){const a=FOREST.spores.geometry.attributes.position.array;for(let i=1;i<a.length;i+=3){a[i]+=dt*.35;if(a[i]>4.5)a[i]=.2;}FOREST.spores.geometry.attributes.position.needsUpdate=true;
  FOREST.spores.material.opacity=.6+.3*Math.sin(FOREST.uT.value*2);}
 if(FOREST.moon){FOREST.moon.position.set(cam.position.x-70,cam.position.y+95,cam.position.z-140);}
 forestAudioUpdate(dt);
}

/* ---------- SELEÇÃO DE MAPA (tela CONTRA MONSTROS) ---------- */
let MON_MAP='forest';
try{const m=localStorage.getItem('ss_monmap');if(m==='forest'||m==='original')MON_MAP=m;}catch(e){}
function forestMapUI(){
 const scr=$('monwave');if(!scr||$('mapsel'))return;
 const box=document.createElement('div');box.id='mapsel';
 box.innerHTML='<div class="mstitle">MAPA</div><div class="msrow"><button class="b" data-map="forest">🌲 ENCHANTED WILDS<small>Floresta Perdida</small></button><button class="b" data-map="original">🏚 ORIGINAL<small>Base militar</small></button></div>';
 const first=$('mwgrad');scr.insertBefore(box,first);
 const upd=()=>box.querySelectorAll('[data-map]').forEach(b=>b.classList.toggle('sel',b.dataset.map===MON_MAP));
 box.querySelectorAll('[data-map]').forEach(b=>b.addEventListener('click',()=>{SFX.ui();MON_MAP=b.dataset.map;try{localStorage.setItem('ss_monmap',MON_MAP);}catch(e){}upd();}));
 upd();
 const st=document.createElement('style');st.textContent=
 '#mapsel{margin:4px 0 10px;text-align:center}#mapsel .mstitle{font-size:12px;letter-spacing:3px;opacity:.75;margin-bottom:6px}'+
 '#mapsel .msrow{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}#mapsel .b{display:flex;flex-direction:column;align-items:center;padding:8px 14px;font-size:13px;opacity:.6;border-width:2px}'+
 '#mapsel .b small{font-size:10px;letter-spacing:1px;opacity:.8;margin-top:2px}#mapsel .b.sel{opacity:1;border-color:#9bc35a;box-shadow:0 0 14px rgba(155,195,90,.45)}';
 document.head.appendChild(st);
}

/* ---------- INTEGRAÇÃO ---------- */
{const _gs=gmStart;gmStart=function(m){_gs(m);if(m==='monsters'&&MON_MAP==='forest')forestEnter();};}
{const _gc=gmClear;gmClear=function(){forestExit();_gc();};}
{const _gu=gmUpdate;gmUpdate=function(dt){_gu(dt);forestUpdate(dt);};}
forestMapUI();
/* pré-carrega a floresta em segundo plano (depois dos monstros) */
setTimeout(()=>{try{if(MON_MAP==='forest'){forestBuild();forestLoad();}}catch(e){console.warn(e);}},4500);
