"use strict";
/* WORLD v2: mapa com texturas, colisão, partículas, marcas de bala e itens */
const colliders=[],solids=[],barrels=[],world=new THREE.Group();
scene.add(world);
let SZ=45;  /* let: o mapa Enchanted Wilds amplia a área enquanto está ativo */

/* UV em escala de mundo: a textura não estica em paredes grandes */
function scaleBoxUV(g,w,h,d,t){
 const uv=g.attributes.uv;
 for(let f=0;f<6;f++){
  let su,sv;
  if(f<2){su=d;sv=h;}else if(f<4){su=w;sv=d;}else{su=w;sv=h;}
  for(let i=0;i<4;i++){const k=f*4+i;uv.setXY(k,uv.getX(k)*su/t,uv.getY(k)*sv/t);}
 }
 uv.needsUpdate=true;
}
function scalePlaneUV(g,w,h,t){
 const uv=g.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/t,uv.getY(i)*h/t);
 uv.needsUpdate=true;
}

function box(x,z,w,d,h,mat,y0){
 y0=y0||0;
 const g=new THREE.BoxGeometry(w,h,d);
 scaleBoxUV(g,w,h,d,(mat.userData&&mat.userData.tile)||3);
 const m=new THREE.Mesh(g,mat);
 m.position.set(x,y0+h/2,z);m.castShadow=m.receiveShadow=true;
 world.add(m);m.updateMatrixWorld(true);solids.push(m);
 colliders.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,top:y0+h,bot:y0,mesh:m});
 return m;
}
function decor(m,x,y,z){m.position.set(x,y,z);m.castShadow=true;world.add(m);return m;}
function barrel(x,z){
 const m=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,1.1,12),mats.barrel);
 m.position.set(x,.55,z);m.castShadow=true;world.add(m);m.updateMatrixWorld(true);solids.push(m);
 const b={x0:x-.45,x1:x+.45,z0:z-.45,z1:z+.45,top:1.1,bot:0,mesh:m};
 colliders.push(b);m.userData.barrel={hp:30,b};barrels.push(m);
}

/* JANELAS (só visual, sem colisão) */
const winG=new THREE.BoxGeometry(1.6,1.2,.06),frG=new THREE.BoxGeometry(1.8,1.4,.04);
function win(x,y,z,ry){
 const gp=new THREE.Group();
 const gl=new THREE.Mesh(winG,mats.glass);
 const fr=new THREE.Mesh(frG,mats.dark);fr.position.z=-.04;
 gp.add(fr,gl);gp.position.set(x,y,z);gp.rotation.y=ry;world.add(gp);
}

function buildMap(){
 /* chão de grama com manchas de terra */
 const gg=new THREE.PlaneGeometry(SZ*2+20,SZ*2+20);scalePlaneUV(gg,SZ*2+20,SZ*2+20,6);
 const g=new THREE.Mesh(gg,mats.ground);g.rotation.x=-Math.PI/2;g.receiveShadow=true;world.add(g);
 const dm=new THREE.MeshBasicMaterial({map:dirtTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 for(let i=0;i<14;i++){
  const x=(rnd()-.5)*(SZ*2-10),z=(rnd()-.5)*(SZ*2-10);
  if(Math.abs(x)<9||Math.abs(z+20)<9)continue;
  const s=6+rnd()*9,p=new THREE.Mesh(new THREE.PlaneGeometry(s,s),dm);p.rotation.x=-Math.PI/2;p.position.set(x,.012,z);world.add(p);
 }
 /* estradas com faixas */
 const r1g=new THREE.PlaneGeometry(10,SZ*2);scalePlaneUV(r1g,10,SZ*2,10);
 const r1=new THREE.Mesh(r1g,mats.road);r1.rotation.x=-Math.PI/2;r1.position.y=.02;r1.receiveShadow=true;world.add(r1);
 const r2g=new THREE.PlaneGeometry(10,SZ*2);scalePlaneUV(r2g,10,SZ*2,10);
 const r2=new THREE.Mesh(r2g,mats.road);r2.rotation.set(-Math.PI/2,0,Math.PI/2);r2.position.set(0,.03,-20);r2.receiveShadow=true;world.add(r2);

 /* limites do mapa */
 box(0,-SZ,SZ*2+2,2,5,mats.conc);box(0,SZ,SZ*2+2,2,5,mats.conc);box(-SZ,0,2,SZ*2,5,mats.conc);box(SZ,0,2,SZ*2,5,mats.conc);

 /* prédio central de tijolos com portas, vergas e janelas */
 box(-9,0,10,1,4,mats.brick);box(9,0,10,1,4,mats.brick);box(-9,-14,10,1,4,mats.brick);box(9,-14,10,1,4,mats.brick);
 box(-14,-7,1,14,4,mats.brick);box(14,-7,1,14,4,mats.brick);box(0,-14,8,1,1.2,mats.conc);box(0,-7,1,6,4,mats.brick);box(0,0,8,1,1.4,mats.conc);
 box(0,0,8.2,1.1,.6,mats.conc,3.4);box(0,-14,8.2,1.1,.6,mats.conc,3.4);
 box(0,-7,30,15,.6,mats.roof,4);
 [-11,-7,7,11].forEach(x=>{win(x,2.3,.53,0);win(x,2.3,-14.53,Math.PI);});
 [-3,-7,-11].forEach(z=>{win(14.53,2.3,z,Math.PI/2);win(-14.53,2.3,z,-Math.PI/2);});

 /* contêineres */
 [[-30,-30,0],[-30,-24,1],[28,-28,1],[24,-34,0],[-28,22,0],[30,18,1],[20,28,0]].forEach(([x,z,k])=>box(x,z,k?12:6,k?3:12,3,k?mats.cont:mats.cont2));
 /* caixas */
 [[-8,12],[-5,13],[8,14],[12,10],[-16,28],[16,-10],[-20,-10],[20,6],[-22,8],[0,24],[34,-10],[-36,0]].forEach(([x,z],i)=>{box(x,z,2.4,2.4,2.4,mats.wood);if(i%3==0)box(x,z,1.6,1.6,1.6,mats.wood,2.4);});
 /* sacos de areia e barreiras */
 [[-4,18,6],[6,20,5],[-14,-20,6],[14,-24,5],[0,34,8],[-12,4,4]].forEach(([x,z,w])=>box(x,z,w,1,1.2,mats.sand));
 [[10,-4],[-10,6],[26,0],[-26,-8],[36,28],[-36,-26]].forEach(([x,z])=>box(x,z,4,.8,1.1,mats.conc));

 /* veículos destruídos com rodas */
 const wheelG=new THREE.CylinderGeometry(.38,.38,.3,10);
 [[-24,-4,0],[25,10,1]].forEach(([x,z,r])=>{
  box(x,z,r?2.4:5,r?5:2.4,1.4,mats.dark);box(x,z,r?2:3,r?2.4:2,.9,mats.cont2,1.4);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>{
   const w=new THREE.Mesh(wheelG,mats.dark);
   if(r){w.rotation.z=Math.PI/2;w.position.set(x+a*1.25,.38,z+b*1.6);}else{w.rotation.x=Math.PI/2;w.position.set(x+a*1.6,.38,z+b*1.25);}
   world.add(w);});
 });

 /* torres com escada */
 [[-38,38],[38,-38],[38,38]].forEach(([x,z])=>{
  box(x,z,5,5,.5,mats.wood,6);[[-2,-2],[2,-2],[-2,2],[2,2]].forEach(([a,b])=>box(x+a,z+b,.5,.5,6,mats.wood));
  box(x,z,5,.4,1,mats.wood,6.5);for(let i=0;i<5;i++)box(x-3.5-i*1.5,z,1.5,1.5,1+i*1.1,mats.wood);
 });
 /* abrigo */
 box(-30,10,8,.6,3,mats.conc);box(-30,16,8,.6,3,mats.conc);box(-34,13,.6,6,3,mats.conc);box(-30,13,9,7,.5,mats.roof,3);
 /* barris explosivos */
 [[-2,24],[3,-30],[-18,16],[20,-18],[-7,-18],[32,-2],[-33,-12],[10,30]].forEach(([x,z])=>barrel(x,z));

 /* postes de luz com brilho */
 const lampM=new THREE.MeshBasicMaterial({color:0xfff0b0});
 const poleG=new THREE.CylinderGeometry(.1,.12,6,6),lampG=new THREE.SphereGeometry(.35,8,6);
 const lampSpr=new THREE.SpriteMaterial({map:glowTex,color:0xffe9a0,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true});
 for(let i=-4;i<=4;i+=2){
  decor(new THREE.Mesh(poleG,mats.dark),7,3,i*9);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(1.2,.1,.1),mats.dark);decor(arm,6.5,6,i*9);
  decor(new THREE.Mesh(lampG,lampM),6,6,i*9);
  const sp=new THREE.Sprite(lampSpr);sp.scale.set(3.2,3.2,1);sp.position.set(6,6,i*9);world.add(sp);
 }
 /* árvores: modelos individuais Quaternius posicionados nos pontos originais */
 const treeSpots=[];
 for(let i=0;i<26;i++){
  const a=i*2.399,rr=18+(i%7)*3.2,x=Math.cos(a)*rr*1.4,z=Math.sin(a)*rr*1.4;
  if(Math.abs(x)>SZ-4||Math.abs(z)>SZ-4||Math.abs(x)<7||Math.abs(z+20)<6||(Math.abs(x)<17&&z<2&&z>-16))continue;
  colliders.push({x0:x-.5,x1:x+.5,z0:z-.5,z1:z+.5,top:3,bot:0});
  treeSpots.push({x,z,s:.8+rnd()*.45,ry:rnd()*6.28});
 }
 if(THREE.GLTFLoader){
  const treeLoader=new THREE.GLTFLoader();
  treeLoader.load('models/Quaternius_Trees.glb',gltf=>{
   const root=gltf.scene.children[0];
   const variants=(root&&root.children&&root.children.length?root.children:gltf.scene.children);
   const prepared=variants.map(node=>{
    const model=node.clone(true);
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);
    const center=bounds.getCenter(new THREE.Vector3());
    const height=Math.max(.001,bounds.max.y-bounds.min.y);
    model.position.x-=center.x;
    model.position.y-=bounds.min.y;
    model.position.z-=center.z;
    const holder=new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(8/height);
    holder.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    return holder;
   });
   treeSpots.forEach((spot,i)=>{
    const tree=prepared[i%prepared.length].clone(true);
    tree.scale.multiplyScalar(spot.s);
    tree.rotation.y=spot.ry;
    tree.position.set(spot.x,0,spot.z);
    world.add(tree);
    if(typeof vegRegisterTree==='function')vegRegisterTree(tree);
   });
  },undefined,err=>console.error('Falha ao carregar modelos de árvores:',err));
 }else console.error('GLTFLoader não foi carregado; modelos de árvores indisponíveis.');

 /* pedras pequenas (só decoração) */
 const rockG=new THREE.DodecahedronGeometry(1,0);
 for(let i=0;i<16;i++){
  const x=(rnd()-.5)*(SZ*2-8),z=(rnd()-.5)*(SZ*2-8);
  if(Math.abs(x)<6||Math.abs(z+20)<5||hitsBox(x,z,0,1,1))continue;
  const s=.25+rnd()*.35,r=new THREE.Mesh(rockG,mats.conc);r.scale.set(s*1.3,s*.7,s);r.rotation.y=rnd()*6;r.position.set(x,s*.3,z);r.castShadow=true;world.add(r);
 }

 /* tufos de grama (instanciados, quantidade depende da qualidade) */
 const nT=QT.tufts[QI];
 if(nT>0){
  const tuft=new THREE.InstancedMesh(new THREE.ConeGeometry(.07,.55,3),new THREE.MeshLambertMaterial({color:0x6f9440}),nT);
  const o=new THREE.Object3D();let n=0,tries=0;
  while(n<nT&&tries++<nT*6){
   const x=(rnd()-.5)*(SZ*2-6),z=(rnd()-.5)*(SZ*2-6);
   if(Math.abs(x)<5.5||Math.abs(z+20)<5.5||hitsBox(x,z,0,.3,.5))continue;
   const s=.6+rnd()*.9;o.position.set(x,.25*s,z);o.scale.set(s,s,s);o.rotation.set((rnd()-.5)*.4,rnd()*6,(rnd()-.5)*.4);o.updateMatrix();tuft.setMatrixAt(n++,o.matrix);
  }
  tuft.count=n;tuft.instanceMatrix.needsUpdate=true;world.add(tuft);
  if(typeof vegRegisterGrass==='function')vegRegisterGrass(tuft,n);
 }
}

/* COLISÃO */
function hitsBox(x,z,y,r,h){for(const b of colliders)if(y+h>b.bot+.05&&y<b.top-.25&&x>b.x0-r&&x<b.x1+r&&z>b.z0-r&&z<b.z1+r)return b;return null;}
function groundAt(x,z,r,y){let g=0;for(const b of colliders)if(x>b.x0-r*.5&&x<b.x1+r*.5&&z>b.z0-r*.5&&z<b.z1+r*.5&&b.top<=y+.5&&b.top>g)g=b.top;return g;}
function moveCollide(p,dx,dz,r,h){
 const nx=p.x+dx;if(!hitsBox(nx,p.z,p.y,r,h)&&Math.abs(nx)<SZ-1.5)p.x=nx;
 const nz=p.z+dz;if(!hitsBox(p.x,nz,p.y,r,h)&&Math.abs(nz)<SZ-1.5)p.z=nz;
}
function rescue(p,r,h){for(let n=0;n<8;n++){const b=hitsBox(p.x,p.z,p.y,r,h);if(!b)return;
 const l=p.x-b.x0,rr=b.x1-p.x,t=p.z-b.z0,bo=b.z1-p.z,m=Math.min(l,rr,t,bo);
 if(m===l)p.x=b.x0-r-.02;else if(m===rr)p.x=b.x1+r+.02;else if(m===t)p.z=b.z0-r-.02;else p.z=b.z1+r+.02;}}

/* PARTÍCULAS (pool) */
const pool=[],pg=new THREE.SphereGeometry(.08,4,3);
for(let i=0;i<70;i++){const m=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({color:0xffd080,transparent:true}));m.visible=false;m.userData={life:0,max:1,v:new THREE.Vector3(),g:9};scene.add(m);pool.push(m);}
let pi=0;
function burst(pos,n,col,life,spd,grav,size){
 for(let i=0;i<n;i++){const m=pool[pi++%pool.length];m.material.color.set(col||0xffd080);m.position.copy(pos);
  m.userData.v.set(Math.random()-.5,Math.random()*.8,Math.random()-.5).multiplyScalar(spd||4);
  m.userData.life=m.userData.max=life||.4;m.userData.g=grav===undefined?9:grav;m.scale.setScalar(size||1);m.visible=true;}
}
function tickParticles(dt){for(const m of pool){if(!m.visible)continue;const u=m.userData;u.life-=dt;if(u.life<=0){m.visible=false;continue;}u.v.y-=u.g*dt;m.position.addScaledVector(u.v,dt);m.material.opacity=Math.min(1,u.life/u.max*1.5);}}

/* MARCAS DE BALA */
const decals=[],dg=new THREE.PlaneGeometry(.18,.18),dm=new THREE.MeshBasicMaterial({color:0x111111,transparent:true,opacity:.75});
for(let i=0;i<24;i++){const m=new THREE.Mesh(dg,dm);m.visible=false;scene.add(m);decals.push(m);}
let di=0;
function decal(p,n){const m=decals[di++%decals.length];m.position.copy(p).addScaledVector(n,.02);m.lookAt(p.clone().add(n));m.visible=true;}

/* ITENS (vida verde, munição amarela) */
const picks=[],pkG=new THREE.BoxGeometry(.4,.3,.4);
function dropPick(x,z){const hp=Math.random()<.45,m=new THREE.Mesh(pkG,new THREE.MeshBasicMaterial({color:hp?0x55dd55:0xe8c040}));m.position.set(x,.5,z);scene.add(m);picks.push({m,hp});}
