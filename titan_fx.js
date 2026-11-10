"use strict";
/* TITAN — EFEITOS VISUAIS (tudo em pools: nada é criado por quadro)
   destroços instanciados (1 draw call), poeira, faíscas de energia, anéis de choque,
   avisos no chão, crateras, rachaduras, clarões, tremor de câmera e números de dano. */
const TTFX={ok:false,deb:null,debN:140,debD:[],debI:0,dust:[],dustI:0,spark:[],sparkI:0,rings:[],ringI:0,walls:[],
 warns:[],warnI:0,craters:[],craterI:0,cracks:[],crackI:0,flashL:null,flashT:0,flashK:0,shake:0,shakeT:0,nums:[],numI:0,
 tex:{},stoneMat:null,_m:new THREE.Matrix4(),_q:new THREE.Quaternion(),_e:new THREE.Euler(),_s:new THREE.Vector3(),_v:new THREE.Vector3(),root:null};

function ttCanvasTex(sz,draw){const c=document.createElement('canvas');c.width=c.height=sz;draw(c.getContext('2d'),sz);const t=new THREE.CanvasTexture(c);return t;}
function ttfxTextures(){
 const T=TTFX.tex;
 T.dust=ttCanvasTex(128,(g,s)=>{for(let i=0;i<9;i++){const x=s/2+(Math.random()-.5)*s*.3,y=s/2+(Math.random()-.5)*s*.3,r=s*(.22+Math.random()*.2);
  const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);}});
 T.glow=ttCanvasTex(64,(g,s)=>{const gr=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.3,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);});
 T.ring=ttCanvasTex(256,(g,s)=>{const gr=g.createRadialGradient(s/2,s/2,s*.30,s/2,s/2,s/2);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.7,'rgba(255,255,255,.9)');gr.addColorStop(.85,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);});
 T.warn=ttCanvasTex(256,(g,s)=>{const c=s/2;g.strokeStyle='rgba(255,255,255,1)';g.lineWidth=s*.035;g.beginPath();g.arc(c,c,c*.92,0,6.283);g.stroke();
  g.lineWidth=s*.012;g.beginPath();g.arc(c,c,c*.62,0,6.283);g.stroke();g.beginPath();g.arc(c,c,c*.3,0,6.283);g.stroke();
  const gr=g.createRadialGradient(c,c,0,c,c,c);gr.addColorStop(0,'rgba(255,255,255,.35)');gr.addColorStop(.9,'rgba(255,255,255,.12)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(c,c,c*.92,0,6.283);g.fill();
  for(let i=0;i<12;i++){const a=i/12*6.283;g.fillRect(c+Math.cos(a)*c*.72-3,c+Math.sin(a)*c*.72-3,6,6);}});
 T.crater=ttCanvasTex(256,(g,s)=>{const c=s/2,gr=g.createRadialGradient(c,c,0,c,c,c);gr.addColorStop(0,'rgba(8,6,5,.95)');gr.addColorStop(.45,'rgba(25,20,16,.85)');gr.addColorStop(.7,'rgba(60,52,44,.5)');gr.addColorStop(1,'rgba(60,52,44,0)');
  g.fillStyle=gr;g.fillRect(0,0,s,s);g.strokeStyle='rgba(10,8,6,.8)';for(let i=0;i<14;i++){g.lineWidth=1+Math.random()*3;g.beginPath();let x=c,y=c,a=Math.random()*6.283;g.moveTo(x,y);for(let j=0;j<6;j++){a+=(Math.random()-.5)*.9;x+=Math.cos(a)*s*.07;y+=Math.sin(a)*s*.07;g.lineTo(x,y);}g.stroke();}});
 T.crack=ttCanvasTex(256,(g,s)=>{const c=s/2;g.lineCap='round';
  for(let i=0;i<9;i++){let x=c,y=c,a=i/9*6.283+Math.random()*.5;g.beginPath();g.moveTo(x,y);const L=6+Math.random()*5;
   for(let j=0;j<L;j++){a+=(Math.random()-.5)*.8;x+=Math.cos(a)*s*.055;y+=Math.sin(a)*s*.055;g.lineTo(x,y);}
   g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=3.2;g.stroke();}});
 T.beam=ttCanvasTex(128,(g,s)=>{const gr=g.createLinearGradient(0,0,s,0);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.35,'rgba(255,255,255,.7)');gr.addColorStop(.5,'rgba(255,255,255,1)');gr.addColorStop(.65,'rgba(255,255,255,.7)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,s,s);for(let i=0;i<40;i++){g.fillStyle='rgba(255,255,255,'+(Math.random()*.4)+')';g.fillRect(s*.3+Math.random()*s*.4,Math.random()*s,2,6+Math.random()*16);}});
 T.beam.wrapT=THREE.RepeatWrapping;
 for(const k in T)if('encoding' in T[k])T[k].encoding=THREE.sRGBEncoding;
}
function ttGroundDecal(tex,blend,color,op){
 const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:tex,color,transparent:true,opacity:op,depthWrite:false,blending:blend,polygonOffset:true,polygonOffsetFactor:-3,fog:true}));
 m.rotation.x=-Math.PI/2;m.visible=false;m.renderOrder=2;TTFX.root.add(m);return m;
}
function ttfxInit(stoneMat){
 if(TTFX.ok){if(stoneMat&&TTFX.deb)TTFX.deb.material=stoneMat;return;}
 TTFX.ok=true;ttfxTextures();
 TTFX.root=new THREE.Group();TTFX.root.name='titanFX';
 const T=TTFX.tex,ADD=THREE.AdditiveBlending,NORM=THREE.NormalBlending;
 /* destroços: um InstancedMesh com física simples por instância */
 const dg=new THREE.DodecahedronGeometry(1,0);
 const pos=dg.attributes.position;for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i)*(.8+Math.random()*.4),pos.getY(i)*(.7+Math.random()*.4),pos.getZ(i)*(.8+Math.random()*.4));dg.computeVertexNormals();
 TTFX.stoneMat=stoneMat||new THREE.MeshStandardMaterial({color:0x8d8a80,roughness:.95});
 TTFX.deb=new THREE.InstancedMesh(dg,TTFX.stoneMat,TTFX.debN);TTFX.deb.castShadow=true;TTFX.deb.frustumCulled=false;
 TTFX.deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 for(let i=0;i<TTFX.debN;i++){TTFX.debD.push({on:false,p:new THREE.Vector3(),v:new THREE.Vector3(),r:new THREE.Vector3(),w:new THREE.Vector3(),s:1,life:0,max:1});TTFX._m.makeScale(0,0,0);TTFX.deb.setMatrixAt(i,TTFX._m);}
 TTFX.root.add(TTFX.deb);
 for(let i=0;i<44;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:T.dust,color:0x8a7f6c,transparent:true,depthWrite:false,opacity:0,blending:NORM}));s.visible=false;s.userData={life:0,max:1,v:new THREE.Vector3(),g0:1,g1:3,a:.7};TTFX.root.add(s);TTFX.dust.push(s);}
 for(let i=0;i<70;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:T.glow,color:0x66ffee,transparent:true,depthWrite:false,blending:ADD,opacity:1,fog:false}));s.visible=false;s.userData={life:0,max:1,v:new THREE.Vector3(),g:0,size:.3,tgt:null};TTFX.root.add(s);TTFX.spark.push(s);}
 for(let i=0;i<8;i++){const m=ttGroundDecal(T.ring,ADD,0xffb070,.9);TTFX.rings.push({m,t:0,life:1,r0:1,r1:5});}
 /* parede da onda de choque: cilindro aberto com gradiente */
 const wg=new THREE.CylinderGeometry(1,1,1,48,1,true);wg.translate(0,.5,0);
 for(let i=0;i<3;i++){const m=new THREE.Mesh(wg,new THREE.MeshBasicMaterial({map:T.beam,color:0xffc890,transparent:true,opacity:.0,depthWrite:false,blending:ADD,side:THREE.DoubleSide,fog:false}));
  m.material.map=ttCanvasTex(64,(g,s)=>{const gr=g.createLinearGradient(0,s,0,0);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);});
  m.visible=false;TTFX.root.add(m);TTFX.walls.push(m);}
 for(let i=0;i<24;i++){const m=ttGroundDecal(T.warn,ADD,0xff3020,.8);TTFX.warns.push({m,t:0,life:1,on:false,col:0xff3020});}
 for(let i=0;i<26;i++){const m=ttGroundDecal(T.crater,NORM,0xffffff,.9);m.renderOrder=1;TTFX.craters.push(m);}
 for(let i=0;i<10;i++){const m=ttGroundDecal(T.crack,ADD,0x55ffe6,.0);TTFX.cracks.push({m,t:0,life:1,op:1});}
 TTFX.flashL=new THREE.PointLight(0xffc080,0,40,2);TTFX.root.add(TTFX.flashL);
 /* números de dano (DOM, pool fixo) */
 const host=document.createElement('div');host.id='ttnums';document.body.appendChild(host);
 for(let i=0;i<26;i++){const d=document.createElement('div');d.className='ttn';host.appendChild(d);TTFX.nums.push({el:d,on:false,p:new THREE.Vector3(),t:0,life:1,vy:0});}
}
function ttfxAttach(on){if(!TTFX.root)return;if(on&&!TTFX.root.parent)scene.add(TTFX.root);if(!on&&TTFX.root.parent)scene.remove(TTFX.root);}

/* ---------- emissores ---------- */
function ttfxDebris(pos,n,spd,size,up){
 const q=typeof curQ==='function'?curQ():1;n=Math.ceil(n*[.5,.75,1,1][q]);
 for(let i=0;i<n;i++){const d=TTFX.debD[TTFX.debI++%TTFX.debN];d.on=true;d.p.copy(pos);d.p.x+=(Math.random()-.5)*.6;d.p.z+=(Math.random()-.5)*.6;
  const a=Math.random()*6.283,h=(spd||8)*(.35+Math.random()*.65);d.v.set(Math.cos(a)*h,(up||1)*(spd||8)*(.45+Math.random()*.8),Math.sin(a)*h);
  d.r.set(Math.random()*6,Math.random()*6,Math.random()*6);d.w.set((Math.random()-.5)*12,(Math.random()-.5)*12,(Math.random()-.5)*12);
  d.s=(size||.35)*(.5+Math.random()*.9);d.life=d.max=2.2+Math.random()*1.8;}
}
function ttfxDust(pos,n,size,life,spread,col){
 for(let i=0;i<n;i++){const s=TTFX.dust[TTFX.dustI++%TTFX.dust.length],u=s.userData;s.position.copy(pos);s.position.x+=(Math.random()-.5)*(spread||2);s.position.z+=(Math.random()-.5)*(spread||2);s.position.y+=Math.random()*.6;
  const a=Math.random()*6.283,sp=(spread||2)*.6;u.v.set(Math.cos(a)*sp,.4+Math.random()*.8,Math.sin(a)*sp);u.life=u.max=(life||2.4)*(.7+Math.random()*.6);u.g0=(size||3)*.5;u.g1=(size||3)*(1.4+Math.random()*.6);u.a=.3+Math.random()*.18;
  s.material.color.setHex(col||0x5e574b);s.material.rotation=Math.random()*6.283;s.visible=true;}
}
function ttfxSpark(pos,n,col,spd,life,size,grav){
 for(let i=0;i<n;i++){const s=TTFX.spark[TTFX.sparkI++%TTFX.spark.length],u=s.userData;s.position.copy(pos);
  u.v.set(Math.random()-.5,Math.random()-.3,Math.random()-.5).normalize().multiplyScalar((spd||4)*(.4+Math.random()*.6));u.life=u.max=(life||.6)*(.6+Math.random()*.6);u.size=(size||.3)*(.6+Math.random()*.7);u.g=grav===undefined?3:grav;u.tgt=null;
  s.material.color.setHex(col||0x66ffee);s.visible=true;s.scale.setScalar(u.size);}
}
/* partículas que convergem para um alvo (carga do raio) */
function ttfxPull(tgt,n,r,col){
 for(let i=0;i<n;i++){const s=TTFX.spark[TTFX.sparkI++%TTFX.spark.length],u=s.userData;
  TTFX._v.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(r*(.6+Math.random()*.5));s.position.copy(tgt).add(TTFX._v);
  u.tgt=tgt;u.life=u.max=.55+Math.random()*.35;u.size=.25+Math.random()*.35;u.g=0;u.v.set(0,0,0);s.material.color.setHex(col||0x7ffff0);s.visible=true;}
}
function ttfxRing(pos,r0,r1,life,col,op){const R=TTFX.rings[TTFX.ringI++%TTFX.rings.length];R.m.position.set(pos.x,.06,pos.z);R.t=0;R.life=life;R.r0=r0;R.r1=r1;R.op=op||.9;R.m.material.color.setHex(col||0xffb070);R.m.visible=true;return R;}
function ttfxWall(i,pos,r,h,op,col){const m=TTFX.walls[i%TTFX.walls.length];if(op<=0.01){m.visible=false;return;}m.visible=true;m.position.set(pos.x,0,pos.z);m.scale.set(r,h,r);m.material.opacity=op;if(col)m.material.color.setHex(col);}
function ttfxWarn(pos,r,life,col){const W=TTFX.warns[TTFX.warnI++%TTFX.warns.length];W.m.position.set(pos.x,.05,pos.z);W.m.scale.set(r*2,r*2,1);W.t=0;W.life=life;W.on=true;W.m.material.color.setHex(col||0xff3020);W.m.visible=true;return W;}
function ttfxWarnOff(W){if(W){W.on=false;W.m.visible=false;}}
function ttfxCrater(pos,s){const m=TTFX.craters[TTFX.craterI++%TTFX.craters.length];m.position.set(pos.x,.035+(TTFX.craterI%7)*.002,pos.z);m.scale.set(s*2,s*2,1);m.rotation.z=Math.random()*6.28;m.visible=true;}
function ttfxCrack(pos,s,life,col){const C=TTFX.cracks[TTFX.crackI++%TTFX.cracks.length];C.m.position.set(pos.x,.045,pos.z);C.m.scale.set(s*2,s*2,1);C.m.rotation.z=Math.random()*6.28;C.t=0;C.life=life||3;C.m.material.color.setHex(col||0x55ffe6);C.m.visible=true;return C;}
function ttfxFlash(pos,col,k,dur){TTFX.flashL.position.copy(pos);TTFX.flashL.color.setHex(col||0xffc080);TTFX.flashK=k||6;TTFX.flashT=TTFX.flashMax=dur||.35;TTFX.flashL.intensity=TTFX.flashK;}
function ttfxShake(a,d){TTFX.shake=Math.max(TTFX.shake*(TTFX.shakeT>0?1:0),a);TTFX.shakeT=Math.max(TTFX.shakeT,d||.5);TTFX.shakeMax=Math.max(TTFX.shakeT,.01);}
function ttfxNum(p,text,cls){const N=TTFX.nums[TTFX.numI++%TTFX.nums.length];N.on=true;N.p.copy(p);N.p.x+=(Math.random()-.5)*.8;N.t=0;N.life=cls&&cls.indexOf('big')>=0?1.3:.9;N.el.textContent=text;N.el.className='ttn '+(cls||'');N.el.style.opacity='1';}

/* ---------- atualização ---------- */
function ttfxUpdate(dt){
 if(!TTFX.ok)return;
 const M=TTFX._m,Q=TTFX._q,E=TTFX._e,S=TTFX._s;let any=false;
 for(let i=0;i<TTFX.debN;i++){const d=TTFX.debD[i];if(!d.on)continue;any=true;
  d.life-=dt;if(d.life<=0){d.on=false;M.makeScale(0,0,0);TTFX.deb.setMatrixAt(i,M);continue;}
  d.v.y-=22*dt;d.p.addScaledVector(d.v,dt);
  if(d.p.y<d.s*.5){d.p.y=d.s*.5;if(d.v.y<-1.5){d.v.y*=-.32;d.v.x*=.55;d.v.z*=.55;d.w.multiplyScalar(.6);}else{d.v.y=0;d.v.x*=Math.exp(-6*dt);d.v.z*=Math.exp(-6*dt);d.w.multiplyScalar(Math.exp(-5*dt));}}
  d.r.addScaledVector(d.w,dt);E.set(d.r.x,d.r.y,d.r.z);Q.setFromEuler(E);const k=Math.min(1,d.life/.6)*d.s;S.set(k,k*.8,k);M.compose(d.p,Q,S);TTFX.deb.setMatrixAt(i,M);}
 if(any||TTFX._debWas)TTFX.deb.instanceMatrix.needsUpdate=true;TTFX._debWas=any;
 for(const s of TTFX.dust){if(!s.visible)continue;const u=s.userData;u.life-=dt;if(u.life<=0){s.visible=false;continue;}const k=1-u.life/u.max;
  s.position.addScaledVector(u.v,dt);u.v.multiplyScalar(Math.exp(-1.6*dt));s.scale.setScalar(u.g0+(u.g1-u.g0)*Math.sqrt(k));s.material.opacity=u.a*Math.min(1,k*6)*(1-k);}
 for(const s of TTFX.spark){if(!s.visible)continue;const u=s.userData;u.life-=dt;if(u.life<=0){s.visible=false;continue;}
  if(u.tgt){s.position.lerp(u.tgt,Math.min(1,dt*6));}else{u.v.y-=u.g*dt;s.position.addScaledVector(u.v,dt);}
  s.material.opacity=Math.min(1,u.life/u.max*1.6);s.scale.setScalar(u.size*(u.tgt?.5+u.life/u.max:1));}
 for(const R of TTFX.rings){if(!R.m.visible)continue;R.t+=dt;const k=Math.min(1,R.t/R.life);const r=R.r0+(R.r1-R.r0)*(1-(1-k)*(1-k));R.m.scale.set(r*2,r*2,1);R.m.material.opacity=R.op*(1-k);if(k>=1)R.m.visible=false;}
 for(const W of TTFX.warns){if(!W.on)continue;W.t+=dt;const k=W.t/W.life;if(k>=1){ttfxWarnOff(W);continue;}
  W.m.material.opacity=.35+.55*Math.abs(Math.sin(W.t*(6+k*14)));W.m.rotation.z+=dt*(.5+k*2);}
 for(const C of TTFX.cracks){if(!C.m.visible)continue;C.t+=dt;const k=C.t/C.life;C.m.material.opacity=Math.min(1,C.t*4)*(1-k)*.9;if(k>=1)C.m.visible=false;}
 if(TTFX.flashT>0){TTFX.flashT-=dt;TTFX.flashL.intensity=Math.max(0,TTFX.flashK*TTFX.flashT/TTFX.flashMax);}
 if(TTFX.shakeT>0){TTFX.shakeT-=dt;if(TTFX.shakeT<=0)TTFX.shake=0;}
 /* números */
 const w=innerWidth,h=innerHeight;
 for(const N of TTFX.nums){if(!N.on)continue;N.t+=dt;if(N.t>=N.life){N.on=false;N.el.style.opacity='0';continue;}
  N.p.y+=dt*1.6;TTFX._v.copy(N.p).project(cam);
  if(TTFX._v.z>1){N.el.style.opacity='0';continue;}
  const x=(TTFX._v.x*.5+.5)*w,y=(-TTFX._v.y*.5+.5)*h,k=N.t/N.life;
  N.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-50%) scale('+(1+Math.max(0,.25-N.t)*2).toFixed(2)+')';N.el.style.opacity=String(1-k*k);}
}
/* aplica o tremor na câmera (depois de updatePlayer) */
function ttfxApplyShake(){
 if(TTFX.shakeT<=0||TTFX.shake<=0)return;const k=TTFX.shake*Math.min(1,TTFX.shakeT/(TTFX.shakeMax*.5)),t=performance.now()*.001;
 cam.position.x+=(Math.sin(t*47)+Math.sin(t*31)*.5)*k*.08;cam.position.y+=(Math.sin(t*53)+Math.sin(t*23)*.5)*k*.08;
 cam.rotation.z+=Math.sin(t*41)*k*.012;
}
function ttfxReset(){
 if(!TTFX.ok)return;
 for(let i=0;i<TTFX.debN;i++){TTFX.debD[i].on=false;TTFX._m.makeScale(0,0,0);TTFX.deb.setMatrixAt(i,TTFX._m);}TTFX.deb.instanceMatrix.needsUpdate=true;
 TTFX.dust.forEach(s=>s.visible=false);TTFX.spark.forEach(s=>s.visible=false);TTFX.rings.forEach(r=>r.m.visible=false);TTFX.walls.forEach(m=>m.visible=false);
 TTFX.warns.forEach(ttfxWarnOff);TTFX.craters.forEach(m=>m.visible=false);TTFX.cracks.forEach(c=>c.m.visible=false);
 TTFX.flashT=0;TTFX.flashL.intensity=0;TTFX.shake=0;TTFX.shakeT=0;TTFX.nums.forEach(n=>{n.on=false;n.el.style.opacity='0';});
}
