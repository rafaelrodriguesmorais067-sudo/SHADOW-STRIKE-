"use strict";
/* TITAN — ARENA EXCLUSIVA: ruínas ancestrais
   Arena circular (raio ~38 m) com pilares, monólitos, muros baixos, plataformas, rochas,
   braseiros, neblina e iluminação própria. Construída UMA vez e reaproveitada a cada luta.
   Colisão: caixas AABB no mesmo formato do mapa original (colliders/solids de world.js).
   Destruição: pilares desabam (viram cobertura baixa), muros e rochas quebram, monólitos e a
   muralha são "obstáculos fortes" que atordoam o golem na investida. */
const TTAR={built:false,g:null,props:[],cols:[],solids:[],lights:[],fires:[],falling:[],mats:{},ground:null,rune:null,t:0};

function ttArenaTex(){
 const Tx={};
 Tx.floor=makeTex((g,s,k)=>{
  g.fillStyle='#3d3f3d';g.fillRect(0,0,s,s);
  const n=4,c=s/n;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const o=(j%2)*c*.5,x=i*c+o,y=j*c;const v=50+rnd()*28|0,col='rgb('+v+','+(v+2)+','+(v-2)+')';
   for(const dx of [0,-s]){g.fillStyle=col;g.fillRect(x+dx+2*k,y+2*k,c-4*k,c-4*k);}
   g.fillStyle='rgba(255,255,255,.04)';g.fillRect(x+3*k,y+3*k,c-6*k,4*k);}
  speckle(g,s,['#2a2c2a','#575a55','#4a4d48','#333'],s*s/5,k,2*k,.55);
  for(let i=0;i<10;i++){const x=rnd()*s,y=rnd()*s,r=s*(.05+rnd()*.12),gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(70,92,40,.55)');gr.addColorStop(1,'rgba(70,92,40,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}
  g.strokeStyle='rgba(15,15,14,.7)';g.lineWidth=1.2*k;
  for(let i=0;i<7;i++){g.beginPath();let x=rnd()*s,y=rnd()*s;g.moveTo(x,y);for(let j=0;j<5;j++){x+=(rnd()-.5)*s*.15;y+=(rnd()-.5)*s*.15;g.lineTo(x,y);}g.stroke();}
 });
 Tx.wall=makeTex((g,s,k)=>{
  g.fillStyle='#4a4842';g.fillRect(0,0,s,s);const rows=6,bh=s/rows;
  for(let r=0;r<rows;r++){let x=-(r%2)*s*.15;while(x<s){const w=s*(.22+rnd()*.18),v=62+rnd()*30|0;g.fillStyle='rgb('+v+','+(v-3)+','+(v-9)+')';g.fillRect(x+2*k,r*bh+2*k,w-4*k,bh-4*k);x+=w;}}
  speckle(g,s,['#2e2c28','#6d6a60','#3a3832'],s*s/6,k,2*k,.5);
  for(let i=0;i<8;i++){const x=rnd()*s,w=s*(.04+rnd()*.06),gr=g.createLinearGradient(0,0,0,s);gr.addColorStop(0,'rgba(60,80,35,.0)');gr.addColorStop(1,'rgba(60,80,35,.55)');g.fillStyle=gr;g.fillRect(x,s*.4,w,s*.6);}
 });
 Tx.pillar=makeTex((g,s,k)=>{
  g.fillStyle='#6d6a62';g.fillRect(0,0,s,s);
  for(let i=0;i<12;i++){const x=i*s/12;const gr=g.createLinearGradient(x,0,x+s/12,0);gr.addColorStop(0,'rgba(0,0,0,.35)');gr.addColorStop(.5,'rgba(255,255,255,.08)');gr.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=gr;g.fillRect(x,0,s/12,s);}
  speckle(g,s,['#4d4a44','#86827a','#3c3a35'],s*s/6,k,2*k,.5);
  g.strokeStyle='rgba(20,20,18,.7)';g.lineWidth=2*k;for(let i=0;i<4;i++){g.beginPath();g.moveTo(0,i*s/4+rnd()*6);g.lineTo(s,i*s/4+rnd()*6);g.stroke();}
 });
 Tx.rock=makeTex((g,s,k)=>{g.fillStyle='#55534d';g.fillRect(0,0,s,s);speckle(g,s,['#3d3b36','#6b685f','#47453f','#7b776c'],s*s/3,k,3*k,.6);
  for(let i=0;i<6;i++){const x=rnd()*s,y=rnd()*s,r=s*(.08+rnd()*.12),gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(76,98,44,.6)');gr.addColorStop(1,'rgba(76,98,44,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}});
 Tx.rune=ttCanvasTex(1024,(g,s)=>{const c=s/2;g.clearRect(0,0,s,s);g.strokeStyle='rgba(255,255,255,1)';g.lineWidth=6;
  g.beginPath();g.arc(c,c,c*.95,0,6.283);g.stroke();g.lineWidth=3;g.beginPath();g.arc(c,c,c*.80,0,6.283);g.stroke();g.beginPath();g.arc(c,c,c*.42,0,6.283);g.stroke();
  g.font='bold '+(s*.05|0)+'px serif';g.fillStyle='rgba(255,255,255,.95)';g.textAlign='center';g.textBaseline='middle';const R='ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for(let i=0;i<24;i++){const a=i/24*6.283;g.save();g.translate(c+Math.cos(a)*c*.875,c+Math.sin(a)*c*.875);g.rotate(a+Math.PI/2);g.fillText(R[i],0,0);g.restore();}
  for(let i=0;i<8;i++){const a=i/8*6.283;g.beginPath();g.moveTo(c+Math.cos(a)*c*.42,c+Math.sin(a)*c*.42);g.lineTo(c+Math.cos(a)*c*.80,c+Math.sin(a)*c*.80);g.stroke();}
  g.beginPath();for(let i=0;i<=6;i++){const a=i/6*6.283-Math.PI/2;const x=c+Math.cos(a)*c*.36,y=c+Math.sin(a)*c*.36;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();});
 Tx.fire=ttCanvasTex(128,(g,s)=>{const gr=g.createRadialGradient(s/2,s*.62,0,s/2,s*.62,s*.5);gr.addColorStop(0,'rgba(255,240,190,1)');gr.addColorStop(.3,'rgba(255,150,40,.8)');gr.addColorStop(.7,'rgba(200,50,10,.25)');gr.addColorStop(1,'rgba(120,20,0,0)');g.fillStyle=gr;g.fillRect(0,0,s,s);});
 return Tx;
}
function ttStd(map,col,r,tile){
 if(map&&tile){map=map.clone();map.needsUpdate=true;map.repeat.set(tile[0],tile[1]);}
 if(typeof QI!=='undefined'&&QI===0)return new THREE.MeshLambertMaterial({color:col||0xffffff,map});
 return new THREE.MeshStandardMaterial({color:col||0xffffff,map,roughness:r||.92,metalness:0});
}
/* colisor AABB na mesma estrutura do world.js */
function ttCol(x,z,w,d,h,y0,mesh){return {x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,top:(y0||0)+h,bot:y0||0,mesh};}
function ttAddProp(p){p.alive=true;p.hp=p.max;p.init={x:p.g.position.x,y:p.g.position.y,z:p.g.position.z,rx:p.g.rotation.x,ry:p.g.rotation.y,rz:p.g.rotation.z};
 p.cols.forEach(c=>c.prop=p);
 p.g.traverse(o=>{if(o.isMesh){o.userData.ttProp=p;o.castShadow=true;o.receiveShadow=true;}});TTAR.props.push(p);TTAR.g.add(p.g);return p;}

function ttArenaBuild(){
 if(TTAR.built)return TTAR.g;
 TTAR.built=true;const Tx=ttArenaTex();TTAR.tex=Tx;
 const g=TTAR.g=new THREE.Group();g.name='titanArena';
 const M=TTAR.mats;
 M.floor=ttStd(Tx.floor,0xb8b6ae,.95,[22,22]);M.wall=ttStd(Tx.wall,0x9a978e,.95,[2,1]);M.pillar=ttStd(Tx.pillar,0xc8c2b4,.9,[1,2]);
 M.rock=ttStd(Tx.rock,0xa09d94,.97,[1,1]);Tx.rockMap=Tx.rock;M.dark=ttStd(Tx.rock,0x5e5b55,.97,[1,1]);M.slab=ttStd(Tx.wall,0x8a877e,.95,[1,1]);
 /* chão */
 const fl=new THREE.Mesh(new THREE.CircleGeometry(60,72),M.floor);fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;g.add(fl);TTAR.ground=fl;
 /* círculo rúnico central (brilho do mesmo ciano do golem) */
 const rune=new THREE.Mesh(new THREE.PlaneGeometry(22,22),new THREE.MeshBasicMaterial({map:Tx.rune,color:0x3fe0d0,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2}));
 rune.rotation.x=-Math.PI/2;rune.position.set(0,.03,-6);g.add(rune);TTAR.rune=rune;
 /* muralha circular: blocos visuais + colisores AABB que se sobrepõem */
 const N=32,R=41.5;
 for(let i=0;i<N;i++){const a=i/N*Math.PI*2,x=Math.cos(a)*R,z=Math.sin(a)*R;
  TTAR.cols.push(Object.assign(ttCol(x,z,9,9,14),{strong:true,wall:true}));
  const h=7+((i*7)%5)*1.6+(i%3?0:4),seg=new THREE.Mesh(new THREE.BoxGeometry(9.5,h,4.5),M.wall);
  seg.position.set(Math.cos(a)*(R-1.2),h/2-.2,Math.sin(a)*(R-1.2));seg.rotation.y=-a+Math.PI/2;seg.castShadow=seg.receiveShadow=true;g.add(seg);TTAR.solids.push(seg);
  if(i%2===0){const r2=new THREE.Mesh(new THREE.DodecahedronGeometry(3.2+((i*3)%4),0),M.rock);r2.position.set(Math.cos(a+.08)*(R+3),2+((i*5)%3),Math.sin(a+.08)*(R+3));r2.scale.y=1.6;r2.rotation.set(i,i*2,0);g.add(r2);}
  if(i%4===1){const top=new THREE.Mesh(new THREE.BoxGeometry(3,1.2,5),M.wall);top.position.set(seg.position.x,h+.2,seg.position.z);top.rotation.y=seg.rotation.y+.3;top.rotation.z=.25;g.add(top);}
 }
 /* silhuetas distantes (arcos em ruína) */
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2+.2,r=54+(i%3)*4;const arch=new THREE.Group();
  const l=new THREE.Mesh(new THREE.BoxGeometry(3,18+(i%4)*3,3),M.dark);l.position.set(-5,l.geometry.parameters.height/2,0);
  const rr=new THREE.Mesh(new THREE.BoxGeometry(3,14+(i%3)*4,3),M.dark);rr.position.set(5,rr.geometry.parameters.height/2,0);
  const top=new THREE.Mesh(new THREE.BoxGeometry(14,2.5,3.2),M.dark);top.position.set(i%2?-1:1,Math.min(l.geometry.parameters.height,rr.geometry.parameters.height)+1,0);top.rotation.z=(i%2?.12:-.1);
  arch.add(l,rr);if(i%3)arch.add(top);arch.position.set(Math.cos(a)*r,0,Math.sin(a)*r);arch.rotation.y=-a+Math.PI/2;g.add(arch);}
 /* PILARES grandes (fortes: atordoam o golem na investida; desabam) */
 const PIL=[[0,1],[45,1],[90,1],[135,1],[180,1],[225,1],[270,1],[315,1]];
 PIL.forEach(([deg],i)=>{const a=(deg+22.5)*Math.PI/180,r=i%2?22:17,x=Math.cos(a)*r,z=Math.sin(a)*r-3;
  const pg=new THREE.Group();const h=10.5+(i%3);
  const base=new THREE.Mesh(new THREE.BoxGeometry(3.2,1,3.2),M.slab);base.position.y=.5;
  const sh=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.3,h,14),M.pillar);sh.position.y=h/2+1;
  const cap=new THREE.Mesh(new THREE.BoxGeometry(3,1,3),M.slab);cap.position.y=h+1.5;
  const piv=new THREE.Group();piv.add(base,sh,cap);pg.add(piv);pg.position.set(x,0,z);
  const col=Object.assign(ttCol(x,z,2.6,2.6,h+2),{strong:true});
  ttAddProp({kind:'pillar',g:pg,piv,col,cols:[col],solids:[base,sh,cap],max:2400,strong:true,breakable:true,h:h+2,x,z,w:2.6,d:2.6});
 });
 /* MONÓLITOS (indestrutíveis) */
 [[45],[135],[225],[315]].forEach(([deg])=>{const a=deg*Math.PI/180,x=Math.cos(a)*30,z=Math.sin(a)*30;const mg=new THREE.Group();
  const m=new THREE.Mesh(new THREE.BoxGeometry(3.2,11,3.2),M.dark);m.position.y=5.5;m.rotation.y=.05;
  const glyph=new THREE.Mesh(new THREE.PlaneGeometry(2.2,7),new THREE.MeshBasicMaterial({map:TTAR.tex.rune,color:0x3fe0d0,transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false}));
  glyph.position.set(0,5.8,0);const gl2=glyph.clone();glyph.position.z=1.62;gl2.position.z=-1.62;gl2.rotation.y=Math.PI;
  const g3=glyph.clone();g3.position.set(1.62,5.8,0);g3.rotation.y=Math.PI/2;const g4=glyph.clone();g4.position.set(-1.62,5.8,0);g4.rotation.y=-Math.PI/2;
  mg.add(m,glyph,gl2,g3,g4);mg.position.set(x,0,z);mg.rotation.y=0;
  const col=Object.assign(ttCol(x,z,3.2,3.2,11),{strong:true});
  ttAddProp({kind:'monolith',g:mg,col,cols:[col],solids:[m],max:1e9,strong:true,breakable:false,h:11,x,z,w:3.2,d:3.2});});
 /* MUROS baixos (cobertura, quebráveis) */
 [[-9,14,5,1.2],[9,16,1.2,5],[-24,-6,1.2,5],[24,-10,5,1.2],[-15,-24,5,1.2],[16,-26,1.2,4.5],[-7,21,6,1.2],[-30,14,4,1.2],[30,16,1.2,4]].forEach(([x,z,w,d],i)=>{
  const h=2.1+(i%2)*.4,wg=new THREE.Group();const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M.wall);m.position.y=h/2;
  const br=new THREE.Mesh(new THREE.BoxGeometry(Math.max(w,d)*.35,.6,Math.max(w,d)*.35),M.wall);br.position.set(w>d?w*.3:0,h+.15,d>w?d*.3:0);br.rotation.y=.4;
  wg.add(m,br);wg.position.set(x,0,z);const col=ttCol(x,z,w,d,h);
  ttAddProp({kind:'wall',g:wg,col,cols:[col],solids:[m],max:700,strong:false,breakable:true,h,x,z,w,d});});
 /* PLATAFORMAS elevadas (1 m: pule para subir e escapar da onda de choque) */
 [[27,6],[-27,6],[17,-29],[-17,-29]].forEach(([x,z])=>{const pg=new THREE.Group();
  const m=new THREE.Mesh(new THREE.BoxGeometry(6.5,1,6.5),M.slab);m.position.y=.5;const lip=new THREE.Mesh(new THREE.BoxGeometry(6.9,.2,6.9),M.wall);lip.position.y=1.05;
  const step=new THREE.Mesh(new THREE.BoxGeometry(2.4,.5,1.4),M.slab);step.position.set(0,.25,x>0?0:0);step.position.z=z>0?-3.9:3.9;
  pg.add(m,lip,step);pg.position.set(x,0,z);const col=ttCol(x,z,6.5,6.5,1.1);const sc=ttCol(x,z+(z>0?-3.9:3.9),2.4,1.4,.5);
  ttAddProp({kind:'platform',g:pg,col,cols:[col,sc],solids:[m,lip,step],max:1e9,strong:false,breakable:false,h:1.1,x,z,w:6.5,d:6.5});});
 /* ROCHAS (quebráveis por tiros e ataques) */
 [[-6,8],[7,4],[-18,6],[19,2],[-4,-22],[12,-18],[-27,-18],[28,-2],[4,30],[-12,28],[22,24],[-22,24]].forEach(([x,z],i)=>{
  const s=.9+((i*7)%5)*.18,rg=new THREE.Group();const m=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),M.rock);m.scale.set(s*1.3,s*.9,s*1.1);m.position.y=s*.7;m.rotation.set(i,i*1.3,0);
  const m2=new THREE.Mesh(new THREE.DodecahedronGeometry(.6,0),M.rock);m2.position.set(s*.9,.4,s*.3);rg.add(m,m2);rg.position.set(x,0,z);
  const col=ttCol(x,z,s*2.2,s*2,s*1.5);
  ttAddProp({kind:'rock',g:rg,col,cols:[col],solids:[m],max:160,strong:false,breakable:true,h:s*1.5,x,z,w:s*2.2,d:s*2});});
 /* BRASEIROS (luz quente) */
 [[10,4],[-10,4],[10,-16],[-10,-16]].forEach(([x,z],i)=>{const bg=new THREE.Group();
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.18,.35,1.6,8),M.dark);leg.position.y=.8;
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.9,.45,.5,12),M.dark);bowl.position.y=1.8;
  const fs=new THREE.Sprite(new THREE.SpriteMaterial({map:Tx.fire,color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));fs.scale.set(2.2,3,1);fs.position.y=2.9;
  const fs2=fs.clone();fs2.material=fs.material.clone();fs2.scale.set(1.4,2.2,1);fs2.position.y=2.6;
  bg.add(leg,bowl,fs,fs2);bg.position.set(x,0,z);g.add(bg);TTAR.fires.push({a:fs,b:fs2,ph:i*1.7});
  const L=new THREE.PointLight(0xff8a3a,1.6,22,2);L.position.set(x,3.2,z);g.add(L);TTAR.lights.push(L);
  TTAR.cols.push(ttCol(x,z,1,1,2.2));TTAR.solids.push(bowl,leg);});
 /* detalhes do chão: pedriscos instanciados */
 const nP=[60,140,240,320][Math.max(0,Math.min(3,typeof QI!=='undefined'?QI:1))];
 const peb=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.18,0),M.rock,nP);const o=new THREE.Object3D();
 for(let i=0;i<nP;i++){const a=rnd()*6.283,r=4+rnd()*33;o.position.set(Math.cos(a)*r,.05,Math.sin(a)*r);o.rotation.set(rnd()*3,rnd()*3,rnd()*3);const s=.5+rnd()*1.6;o.scale.set(s,s*.6,s);o.updateMatrix();peb.setMatrixAt(i,o.matrix);}
 peb.receiveShadow=true;g.add(peb);
 /* pedaços de pilar caídos (decoração) */
 for(let i=0;i<5;i++){const a=i*1.3+.6,r=12+i*4.5;const c=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2+i%2,12),M.pillar);c.rotation.z=Math.PI/2;c.rotation.y=a;c.position.set(Math.cos(a)*r,1.05,Math.sin(a)*r-2);c.castShadow=c.receiveShadow=true;
  if(Math.hypot(c.position.x,c.position.z-30)<6)continue;g.add(c);}
 /* luz de lua dedicada para o recorte do golem */
 const rim=new THREE.DirectionalLight(0x7fa8ff,.55);rim.position.set(-20,25,-40);g.add(rim);TTAR.rim=rim;
 return g;
}

/* ativa/desativa a arena: troca o mapa original pelos colisores da arena */
const TTAR_SAVE={cols:null,solids:null,worldVis:true};
function ttArenaEnter(){
 ttArenaBuild();
 if(!TTAR_SAVE.cols){TTAR_SAVE.cols=colliders.slice();TTAR_SAVE.solids=solids.slice();TTAR_SAVE.worldVis=world.visible;}
 colliders.length=0;solids.length=0;
 for(const c of TTAR.cols)colliders.push(c);for(const s of TTAR.solids)solids.push(s);
 for(const p of TTAR.props)if(p.alive){p.cols.forEach(c=>colliders.push(c));p.solids.forEach(s=>solids.push(s));}
 world.visible=false;if(!TTAR.g.parent)scene.add(TTAR.g);
}
function ttArenaExit(){
 if(TTAR.g&&TTAR.g.parent)scene.remove(TTAR.g);
 if(TTAR_SAVE.cols){colliders.length=0;solids.length=0;for(const c of TTAR_SAVE.cols)colliders.push(c);for(const s of TTAR_SAVE.solids)solids.push(s);world.visible=TTAR_SAVE.worldVis;}
 TTAR_SAVE.cols=null;TTAR_SAVE.solids=null;
}
function ttArenaReset(){
 TTAR.falling.length=0;
 for(const p of TTAR.props){
  p.cols.forEach(c=>{const i=colliders.indexOf(c);if(i>=0)colliders.splice(i,1);});
  if(p.fallen){const i=colliders.indexOf(p.fallen);if(i>=0)colliders.splice(i,1);p.fallen=null;}
  p.solids.forEach(s=>{const i=solids.indexOf(s);if(i>=0)solids.splice(i,1);});
  p.alive=true;p.hp=p.max;p.g.visible=true;p.g.position.set(p.init.x,p.init.y,p.init.z);p.g.rotation.set(p.init.rx,p.init.ry,p.init.rz);
  if(p.piv){p.piv.rotation.set(0,0,0);p.piv.position.set(0,0,0);}
  p.cols.forEach(c=>colliders.push(c));p.solids.forEach(s=>solids.push(s));
 }
}
/* props cujo colisor toca um círculo (golem) */
function ttPropsInCircle(x,z,r,yTop){const out=[];for(const p of TTAR.props){if(!p.alive)continue;const c=p.col;
 const cx=Math.max(c.x0,Math.min(x,c.x1)),cz=Math.max(c.z0,Math.min(z,c.z1));if(Math.hypot(cx-x,cz-z)<r&&(yTop===undefined||c.bot<yTop))out.push(p);}return out;}
function ttPropDamage(p,dmg,from){
 if(!p||!p.alive||!p.breakable)return false;p.hp-=dmg;
 if(p.hp<=0){ttPropBreak(p,from);return true;}
 if(Math.random()<.3){TTFX._v.set(p.x,Math.min(p.h,2)*.6,p.z);ttfxDust(TTFX._v,1,2,1.2,1.5,0x777168);}
 return false;
}
function ttPropBreak(p,from){
 if(!p.alive)return;p.alive=false;
 p.cols.forEach(c=>{const i=colliders.indexOf(c);if(i>=0)colliders.splice(i,1);});
 p.solids.forEach(s=>{const i=solids.indexOf(s);if(i>=0)solids.splice(i,1);});
 const c=new THREE.Vector3(p.x,Math.min(p.h*.5,3),p.z);
 if(p.kind==='pillar'){
  /* desaba na direção oposta ao golpe, alinhado a um eixo (cobertura AABB justa) */
  let dx=p.x-(from?from.x:0),dz=p.z-(from?from.z:0);if(Math.abs(dx)>Math.abs(dz)){dx=Math.sign(dx)||1;dz=0;}else{dz=Math.sign(dz)||1;dx=0;}
  TTAR.falling.push({p,dx,dz,t:0});TTS.rockBreak(c,1.3);ttfxDebris(c.setY(1.5),14,7,.45,1);ttfxDust(c,6,4,3,3);
 }else{
  p.g.visible=false;TTS.rockBreak(c,p.kind==='rock'?.8:1.1);
  ttfxDebris(c,p.kind==='rock'?12:18,7,p.kind==='rock'?.35:.45,1);ttfxDust(c,p.kind==='rock'?3:5,3.5,2.6,2.5);
  if(Math.random()<.35&&typeof dropPick==='function')dropPick(p.x,p.z);
 }
}
function ttArenaUpdate(dt){
 TTAR.t+=dt;
 for(const f of TTAR.fires){const k=1+Math.sin(TTAR.t*9+f.ph)*.08+Math.sin(TTAR.t*23+f.ph)*.05;f.a.scale.set(2.2*k,3*k,1);f.b.scale.set(1.4/k,2.3*k,1);f.a.material.rotation=Math.sin(TTAR.t*3+f.ph)*.1;}
 TTAR.lights.forEach((L,i)=>{L.intensity=(TTAR.lightK||1)*(1.5+Math.sin(TTAR.t*11+i)*.15+Math.sin(TTAR.t*27+i*2)*.1);});
 if(TTAR.rune)TTAR.rune.material.opacity=(TTAR.runeK||.35)*(.8+Math.sin(TTAR.t*1.3)*.2);
 for(let i=TTAR.falling.length-1;i>=0;i--){const F=TTAR.falling[i],p=F.p;F.t+=dt;const k=Math.min(1,F.t/1.25),ang=k*k*Math.PI/2*.98;
  /* rotaciona o pilar em torno da base: eixo perpendicular à queda */
  p.piv.rotation.set(F.dz*ang,0,-F.dx*ang);
  if(k>=1){TTAR.falling.splice(i,1);
   const L=p.h,cx=p.x+F.dx*L*.5,cz=p.z+F.dz*L*.5,w=F.dx?L:2.4,d=F.dz?L:2.4;
   p.fallen=Object.assign(ttCol(cx,cz,w,d,2.3),{mesh:null,fallenOf:p});colliders.push(p.fallen);p.solids.forEach(s=>solids.push(s));
   const pos=new THREE.Vector3(cx,.5,cz);TTS.impact(pos,1);ttfxShake(.9,.7);ttfxDust(pos,8,5,3.2,L*.5);ttfxDebris(pos,16,8,.4,1);
   /* esmaga quem estiver embaixo */
   const px=Math.max(p.fallen.x0,Math.min(P.x,p.fallen.x1)),pz=Math.max(p.fallen.z0,Math.min(P.z,p.fallen.z1));
   if(Math.hypot(px-P.x,pz-P.z)<.6&&P.y<2.3){hurt(35*ttDmgK(),pos);rescue(P,PR,1.6);if(typeof msg==='function')msg('ESMAGADO PELO PILAR!',1.4);}
   if(typeof ttOnPillarLand==='function')ttOnPillarLand(p,pos);
  }}
}
