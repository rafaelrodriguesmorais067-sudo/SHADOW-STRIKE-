"use strict";
/* MONSTER AI EVOLUTION — camada tática sobre a IA existente (monsters.js + monpowers 1/2/3)
   Não substitui nada: envolve monAI / monSpawn / monWaveList / monStartWave / gmUpdate / gmOnKill / gmClear / gmHudText.
   - Percepção: visão (FOV + alcance por criatura + linha de visão contra colisores e vegetação), audição (tiros,
     explosões, passos — correr faz mais barulho que andar agachado), memória da última posição e
     compartilhamento entre criaturas próximas.
   - Estados: patrulha → investigar → engajar → buscar (padrão de busca ao redor da última posição) e recuo.
   - Papéis de grupo: frente, cerco, flanco, isca, guarda, emboscada, atirador, aéreo.
   - Ataques à distância com aviso prévio (orbes de energia, bolas de fogo, chuva de fogo), invocação de
     ajudantes, janelas de vulnerabilidade após poderes, reação a explosões e à morte de aliados.
   - Ondas com composições próprias e um CHEFE na onda 10 com 3 fases.
   - Efeitos tecnológicos/sobrenaturais: olhos brilhantes, anel de energia, arcos elétricos, carga de ataque. */

/* ---------- PERSONALIDADES ----------
   fov: campo de visão (graus) · sight: alcance de visão (m) · hear: multiplicador de audição
   role: papel tático · retreat: recua com pouca vida · eye: cor dos olhos · tech: aparência (bio | tech | arcano) */
const MAI_PERS={
 skeleton:{fov:110,sight:30,hear:1,role:'swarm',eye:0x8fa0ff,tech:'arcano',react:.8},
 ninja:{fov:150,sight:38,hear:1.4,role:'ambush',retreat:.3,eye:0xff2a4a,tech:'tech',dodge:true,react:1.4},
 cactoro:{fov:100,sight:26,hear:.8,role:'front',eye:0xffd84a,tech:'bio',react:.7},
 alien:{fov:200,sight:40,hear:1.3,role:'erratic',retreat:.22,eye:0x7dff6a,tech:'tech',react:1.3},
 ghost:{fov:240,sight:34,hear:1.1,role:'flank',retreat:.25,eye:0x7ff8ff,tech:'arcano',react:1.1},
 orc:{fov:110,sight:30,hear:.9,role:'front',eye:0xff6a1a,tech:'bio',react:.9},
 demon:{fov:120,sight:34,hear:1,role:'front',eye:0xff3010,tech:'arcano',react:1},
 dino:{fov:100,sight:32,hear:1.1,role:'charger',eye:0xffa020,tech:'bio',react:.9},
 yeti:{fov:110,sight:28,hear:1.2,role:'front',eye:0x9ae8ff,tech:'bio',react:.8},
 bluedemon:{fov:140,sight:44,hear:1.2,role:'caster',retreat:.25,eye:0x40b0ff,tech:'tech',react:1.2},
 mushking:{fov:120,sight:28,hear:1,role:'flank',eye:0xff8a20,tech:'bio',react:.8},
 dragon:{fov:170,sight:52,hear:1.2,role:'aerial',retreat:.2,eye:0xffb030,tech:'arcano',react:1.1},
 forestboss:{fov:360,sight:90,hear:2,role:'boss',eye:0xff5020,tech:'arcano',react:1}
};
const MAI_CFG={
 shareR:26,           /* raio de compartilhamento de informações */
 forgetT:14,          /* segundos procurando antes de desistir */
 noiseSprint:17,noiseWalk:8,noiseCrouch:2.5,
 orb:{charge:.9,speed:15,dmg:14,r:.75,cd:4.2},
 fire:{charge:.8,speed:17,dmg:16,r:.85,cd:3.6,aoe:2.6},
 rain:{warn:1.25,dmg:20,r:2.6,cd:9},
 summon:{cd:13,n:2},
 vuln:{t:1.6,mul:.5}
};
/* chefe: Rei Ancestral (Rei Cogumelo corrompido, gigante) */
MON_TYPES.forestboss={name:'Rei Ancestral da Floresta',file:'Mushroom King.glb',cls:'chefe',hp:3000,dmg:30,reach:3.4,detect:400,chase:500,speed:3.1,cd:1.35,hit:.5,h:5.4,pts:5000,from:99};

const MAI={proj:[],warn:[],fx:[],t:0,noise:null,lkp:null,lkpT:-99,lastSeenAny:-99,stallT:0,pp:{x:0,z:0},speed:0,boss:null,dom:{},packN:0};

/* ---------- GEOMETRIAS/MATERIAIS COMPARTILHADOS (pool) ---------- */
const _maiEyeMat={};function maiEyeMat(c){return _maiEyeMat[c]||(_maiEyeMat[c]=new THREE.SpriteMaterial({map:glowTex,color:c,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));}
const _maiRingG=new THREE.RingGeometry(.85,1,32);
const _maiDiscG=new THREE.CircleGeometry(1,28);
const _maiOrbG=new THREE.SphereGeometry(.28,10,8);

/* ---------- AVISOS NA TELA (HUD) ---------- */
function maiDom(){
 if(MAI.dom.ok)return;MAI.dom.ok=true;
 const st=document.createElement('style');st.textContent=
 '#maiBanner{position:absolute;left:0;right:0;top:24%;text-align:center;pointer-events:none;opacity:0;transition:opacity .35s;z-index:30;font-family:"Barlow Condensed",sans-serif}'+
 '#maiBanner .t{font-size:clamp(26px,6vw,44px);font-weight:700;letter-spacing:.18em;color:#f4f8e6;text-shadow:0 3px 14px #000,0 0 26px rgba(255,140,60,.55)}'+
 '#maiBanner .s{font-size:15px;letter-spacing:.25em;color:#ffcf8a;text-shadow:0 2px 8px #000;margin-top:2px}#maiBanner .a{font-size:12px;letter-spacing:.12em;color:#cfe0ff;margin-top:6px;text-shadow:0 1px 6px #000}'+
 '#maiWarn{position:absolute;left:0;right:0;top:40%;text-align:center;pointer-events:none;z-index:30;font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:19px;letter-spacing:.16em;color:#ff6a4a;text-shadow:0 2px 8px #000,0 0 12px rgba(255,60,40,.6);opacity:0;transition:opacity .2s}'+
 '#maiBoss{position:absolute;left:50%;top:max(58px,9vh);transform:translateX(-50%);width:min(480px,46vw);pointer-events:none;z-index:29;display:none;font-family:"Barlow Condensed",sans-serif;text-align:center}'+
 '#maiBoss .n{font-size:15px;letter-spacing:.22em;color:#ffd6a0;text-shadow:0 2px 6px #000}#maiBoss .bar{height:12px;background:rgba(0,0,0,.6);border:1px solid rgba(255,190,120,.6);margin-top:3px;position:relative;overflow:hidden}'+
 '#maiBoss .f{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#b8261a,#ff7a2a);transition:width .15s}#maiBoss .p{position:absolute;top:0;bottom:0;width:2px;background:rgba(255,255,255,.7)}'+
 '#maiBoss .ph{font-size:11px;letter-spacing:.2em;color:#ffb070;margin-top:2px;text-shadow:0 1px 4px #000}#maiBoss.v .f{background:linear-gradient(90deg,#e0c020,#fff27a)}'+
 '#maiAware{position:absolute;left:50%;top:calc(max(58px,9vh) + 46px);white-space:nowrap;transform:translateX(-50%);font-family:"Share Tech Mono",monospace;font-size:12px;letter-spacing:.12em;color:#cfe6b0;text-shadow:0 1px 4px #000;pointer-events:none;z-index:28;opacity:.9}';
 document.head.appendChild(st);
 const mk=(id,html)=>{const d=document.createElement('div');d.id=id;d.innerHTML=html||'';document.body.appendChild(d);return d;};
 MAI.dom.banner=mk('maiBanner','<div class="t"></div><div class="s"></div><div class="a"></div>');
 MAI.dom.warn=mk('maiWarn');
 MAI.dom.boss=mk('maiBoss','<div class="n"></div><div class="bar"><div class="f"></div><div class="p" style="left:33.3%"></div><div class="p" style="left:66.6%"></div></div><div class="ph"></div>');
 MAI.dom.aware=mk('maiAware');
}
function maiBanner(t,s,a,dur){maiDom();const b=MAI.dom.banner;b.children[0].textContent=t;b.children[1].textContent=s||'';b.children[2].textContent=a||'';b.style.opacity=1;clearTimeout(MAI.dom.bt);MAI.dom.bt=setTimeout(()=>b.style.opacity=0,(dur||3)*1000);}
function maiWarn(t,dur){maiDom();const w=MAI.dom.warn;w.textContent='⚠ '+t;w.style.opacity=1;clearTimeout(MAI.dom.wt);MAI.dom.wt=setTimeout(()=>w.style.opacity=0,(dur||1.6)*1000);snd(880,.08,'square',.09,660);}
function maiHudHide(){if(!MAI.dom.ok)return;MAI.dom.boss.style.display='none';MAI.dom.aware.textContent='';MAI.dom.warn.style.opacity=0;MAI.dom.banner.style.opacity=0;}

/* ---------- EFEITOS (anéis de aviso, círculos no chão) ---------- */
function maiRing(x,z,r,col,life,grow){
 const m=new THREE.Mesh(_maiRingG,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
 m.rotation.x=-Math.PI/2;m.position.set(x,.07,z);m.scale.setScalar(r);scene.add(m);MAI.fx.push({m,t:0,life,r,grow:grow||0});return m;}
function maiDisc(x,z,r,col){const m=new THREE.Mesh(_maiDiscG,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.25,depthWrite:false,blending:THREE.AdditiveBlending}));
 m.rotation.x=-Math.PI/2;m.position.set(x,.06,z);m.scale.setScalar(r);scene.add(m);return m;}
function maiFxUpdate(dt){
 for(let i=MAI.fx.length-1;i>=0;i--){const f=MAI.fx[i];f.t+=dt;const k=f.t/f.life;
  if(f.grow)f.m.scale.setScalar(f.r+f.grow*k);f.m.material.opacity=.85*(1-k);
  if(k>=1){scene.remove(f.m);f.m.material.dispose();MAI.fx.splice(i,1);}}
 /* zonas com aviso (chuva de fogo / esporos / ondas de choque) */
 for(let i=MAI.warn.length-1;i>=0;i--){const w=MAI.warn[i];w.t+=dt;
  if(w.kind==='zone'){const k=Math.min(1,w.t/w.warnT);w.disc.material.opacity=.15+.35*k+Math.sin(w.t*30)*.08*k;w.ring.scale.setScalar(w.r*(1-k)+.2);
   if(w.t>=w.warnT){scene.remove(w.disc);scene.remove(w.ring);w.disc.material.dispose();w.ring.material.dispose();
    const pos=new THREE.Vector3(w.x,.6,w.z);burst(pos,14,w.col,.5,6,2,1.4);burst(pos,6,0x333333,1,2,-.5,2.2);SFX.boom();
    if(typeof aiNoise==='function')aiNoise(w.x,w.z,20);
    if(!P.dead&&Math.hypot(P.x-w.x,P.z-w.z)<w.r+PR&&P.y<1.6)hurt(w.dmg,pos);
    MAI.warn.splice(i,1);}}
  else if(w.kind==='wave'){/* onda de choque expansiva: pule para desviar */
   const r=w.t*w.speed;w.ring.scale.setScalar(r);w.ring.material.opacity=Math.max(0,.9-r/w.max);
   const d=Math.hypot(P.x-w.x,P.z-w.z);if(!w.hit&&!P.dead&&Math.abs(d-r)<.9&&P.y<.45){w.hit=true;hurt(w.dmg,new THREE.Vector3(w.x,0,w.z));
    if(typeof MONPW_KB!=='undefined'){const k=1/(d||1);MONPW_KB.t=.3;MONPW_KB.vx=(P.x-w.x)*k*9;MONPW_KB.vz=(P.z-w.z)*k*9;}}
   if(r>=w.max){scene.remove(w.ring);w.ring.material.dispose();MAI.warn.splice(i,1);}}}
}
function maiZone(x,z,r,dmg,warnT,col){
 const disc=maiDisc(x,z,r,col),ring=new THREE.Mesh(_maiRingG,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
 ring.rotation.x=-Math.PI/2;ring.position.set(x,.08,z);scene.add(ring);MAI.warn.push({kind:'zone',x,z,r,dmg,warnT,col,t:0,disc,ring});}
function maiShock(x,z,dmg,max,col){const ring=new THREE.Mesh(_maiRingG,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
 ring.rotation.x=-Math.PI/2;ring.position.set(x,.15,z);ring.scale.setScalar(.5);scene.add(ring);MAI.warn.push({kind:'wave',x,z,dmg,max,speed:9,t:0,ring,hit:false});}

/* ---------- PROJÉTEIS (pool) ---------- */
function maiShoot(from,tx,ty,tz,C,col,owner){
 let p=MAI.proj.find(p=>!p.live);
 if(!p){const m=new THREE.Mesh(_maiOrbG,new THREE.MeshBasicMaterial({color:col}));const s=new THREE.Sprite(maiEyeMat(col));s.scale.set(1.6,1.6,1);m.add(s);p={m,s,v:new THREE.Vector3(),live:false};MAI.proj.push(p);}
 p.m.material.color.setHex(col);p.s.material=maiEyeMat(col);p.m.position.copy(from);
 p.v.set(tx-from.x,ty-from.y,tz-from.z).normalize().multiplyScalar(C.speed);p.live=true;p.life=4;p.C=C;p.col=col;p.owner=owner;scene.add(p.m);
}
function maiProjUpdate(dt){
 const tgt=new THREE.Vector3(P.x,P.y+1.1,P.z);
 for(const p of MAI.proj){if(!p.live)continue;p.life-=dt;p.m.position.addScaledVector(p.v,dt);
  if(Math.random()<dt*30)burst(p.m.position,1,p.col,.25,.5,0,.9);
  const pos=p.m.position;let end=p.life<=0||pos.y<.05;
  if(!end&&hitsBox(pos.x,pos.z,pos.y-.2,.15,.4))end=true;
  const dHit=pos.distanceTo(tgt);
  if(!end&&dHit<p.C.r+.35){end=true;if(!P.dead)hurt(p.C.dmg*(p.owner?p.owner.dmgMul:1),pos);}
  if(end){p.live=false;scene.remove(p.m);burst(pos,10,p.col,.4,4,1,1.2);
   if(p.C.aoe){const d=Math.hypot(P.x-pos.x,P.z-pos.z);if(dHit>=p.C.r+.35&&d<p.C.aoe&&!P.dead)hurt(p.C.dmg*.5,pos);snd(120,.25,'sawtooth',.12,50);}}}
}

/* ---------- VISUAL TECNOLÓGICO / SOBRENATURAL ---------- */
function maiDress(e){
 const m=e.m;const Pp=MAI_PERS[e.mkey]||MAI_PERS.skeleton,T=e.MT,q=curQ();
 if(!m.mai){
  const grp=new THREE.Group();m.g.add(grp);const fy=T.fly||0,w=Math.min(1.6,Math.max(.6,MON.assets[e.mkey].width*.7));
  const eyes=[];for(const sx of [-1,1]){const s=new THREE.Sprite(maiEyeMat(Pp.eye));s.scale.set(.2,.2,1);s.position.set(sx*w*.16,T.h*.84+fy,w*.42);grp.add(s);eyes.push(s);}
  let ring=null;if(q>=1){ring=new THREE.Mesh(_maiRingG,new THREE.MeshBasicMaterial({color:Pp.eye,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
   ring.rotation.x=-Math.PI/2;ring.position.y=.05+fy*.2;ring.scale.setScalar(w*.9);grp.add(ring);}
  let arc=null;if(Pp.tech==='tech'&&q>=1){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(8*3),3));
   arc=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xbfe8ff,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));arc.frustumCulled=false;grp.add(arc);}
  const charge=new THREE.Sprite(maiEyeMat(Pp.eye));charge.visible=false;charge.position.set(0,T.h*.62+fy,w*.55);grp.add(charge);
  m.mai={grp,eyes,ring,arc,charge,w};
 }
 m.mai.grp.visible=true;m.mai.charge.visible=false;
}
function maiDressUpdate(e,dt){
 const D=e.m.mai;if(!D)return;const A=e.ai,t=MAI.t;
 const alert=A.mode==='engage'?1:A.mode==='search'||A.mode==='investigate'?.6:.3;
 const flash=A.flash>0?2.2:1;A.flash=Math.max(0,A.flash-dt);
 const es=(.16+alert*.09)*flash*(1+Math.sin(t*9+e.pos.x)*.08);for(const s of D.eyes){s.scale.set(es,es,1);s.visible=e.state!=='dead';}
 if(D.ring){D.ring.rotation.z+=dt*(1+alert*2);D.ring.material.opacity=(.12+alert*.25)*(A.vulnT>0?2:1);D.ring.visible=e.state!=='dead';
  if(A.vulnT>0)D.ring.material.color.setHex(0xfff060);else D.ring.material.color.setHex((MAI_PERS[e.mkey]||{}).eye||0xffffff);}
 if(D.arc){const on=e.state!=='dead'&&Math.random()<(alert>.5?.35:.12);D.arc.visible=on;if(on){const a=D.arc.geometry.attributes.position.array,h=e.MT.h,fy=e.MT.fly||0;
   let x=(Math.random()-.5)*D.w,y=fy+Math.random()*h,z=(Math.random()-.5)*D.w;for(let i=0;i<8;i++){a[i*3]=x;a[i*3+1]=y;a[i*3+2]=z;x+=(Math.random()-.5)*.35;y+=(Math.random()-.5)*.4;z+=(Math.random()-.5)*.35;}
   D.arc.geometry.attributes.position.needsUpdate=true;}}
 if(A.charge>0){D.charge.visible=true;const k=1-A.charge/A.chargeMax;const s=.4+k*1.6+Math.sin(t*40)*.1;D.charge.scale.set(s,s,1);}else D.charge.visible=false;
 /* veias de energia: faíscas ocasionais em criaturas biológicas/arcanas quando em combate */
 if(alert>.9&&Math.random()<dt*(curQ()>=2?3:1.2))burst(e.pos.clone().setY((e.MT.fly||0)+Math.random()*e.MT.h),1,(MAI_PERS[e.mkey]||{}).eye||0xffffff,.35,.6,-.5,.7);
}

/* ---------- PERCEPÇÃO ---------- */
function maiLOS(ax,az,bx,bz){
 /* colisores altos (troncos, rochas, paredes) bloqueiam; segmento x AABB */
 const dx=bx-ax,dz=bz-az;
 for(const c of colliders){if(c.top<1.3||c.forest==='edge')continue;
  let t0=0,t1=1;
  if(Math.abs(dx)<1e-6){if(ax<c.x0||ax>c.x1)continue;}else{let u=(c.x0-ax)/dx,v=(c.x1-ax)/dx;if(u>v){const s=u;u=v;v=s;}t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)continue;}
  if(Math.abs(dz)<1e-6){if(az<c.z0||az>c.z1)continue;}else{let u=(c.z0-az)/dz,v=(c.z1-az)/dz;if(u>v){const s=u;u=v;v=s;}t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)continue;}
  if(t1>.03&&t0<.97)return false;}
 return true;
}
function maiPerceive(e){
 const A=e.ai,Pp=A.p,dx=P.x-e.pos.x,dz=P.z-e.pos.z,d=Math.hypot(dx,dz);
 if(P.dead)return false;
 const fd=typeof forestDensAt==='function'?forestDensAt(P.x,P.z):0;     /* jogador escondido na mata */
 let range=Pp.sight*(1-Math.min(.55,fd*.45))*(P.crouch?.75:1)*(.85+A.iq*.25);
 if(A.mode==='engage')range*=1.35;                         /* quem já está caçando acompanha melhor */
 if(d>range)return false;
 if(d>2.6){const fwd=e.g.rotation.y,ang=Math.abs(monTurn(0,Math.atan2(dx,dz)-fwd,1));if(ang>Pp.fov*Math.PI/360&&A.mode!=='engage')return false;}
 if(!maiLOS(e.pos.x,e.pos.z,P.x,P.z))return false;
 if(typeof forestFoliageBetween==='function'){const fol=forestFoliageBetween(e.pos.x,e.pos.z,P.x,P.z);if(fol>(A.mode==='engage'?2.4:1.5))return false;}
 return true;
}
function maiSetLKP(e,x,z,conf,src){const A=e.ai;A.lkp.x=x;A.lkp.z=z;A.lkpT=MAI.t;A.conf=conf;A.src=src;}
function maiShare(e,conf){
 const R=MAI_CFG.shareR*(.7+e.ai.iq*.6);
 for(const o of enemies){if(o===e||!o.monster||o.state==='dead'||!o.ai)continue;
  if(Math.hypot(o.pos.x-e.pos.x,o.pos.z-e.pos.z)>R||o.ai.mode==='engage'||o.ai.mode==='retreat')continue;
  if(MAI.t-o.ai.lkpT<.8&&o.ai.conf>=conf)continue;
  maiSetLKP(o,P.x+(Math.random()-.5)*3,P.z+(Math.random()-.5)*3,conf*.8,'ally');
  if(o.ai.mode!=='ambush'||o.ai.iq<.5)maiMode(o,'investigate');}
 MAI.lkp={x:P.x,z:P.z};MAI.lkpT=MAI.t;
}
function maiMode(e,m){const A=e.ai;if(A.mode===m)return;A.prev=A.mode;A.mode=m;A.modeT=0;
 if(m==='search'){A.searchPts=[];const n=3+(A.iq>.5?1:0);for(let i=0;i<n;i++){const a=Math.random()*6.283,r=4+Math.random()*7;A.searchPts.push({x:A.lkp.x+Math.cos(a)*r,z:A.lkp.z+Math.sin(a)*r});}A.searchI=0;}
}

/* ---------- MOVIMENTO PRÓPRIO (fora do engajamento direto) ---------- */
function maiSteer(e,gx,gz,spd,dt,useFlow){
 const dx=gx-e.pos.x,dz=gz-e.pos.z,d=Math.hypot(dx,dz);if(d<.4)return true;
 let ang=Math.atan2(dx,dz);
 if(useFlow){const f=monFlowDir(e.pos.x,e.pos.z,useFlow);if(f!==null&&d>2.5)ang=f;}
 const A=e.ai,look=1.3;
 if(monBlocked(e.pos.x+Math.sin(ang)*look,e.pos.z+Math.cos(ang)*look,.45)){
  let found=null;for(const k of [.45,.9,1.35,1.8,2.4]){for(const s of [A.side,-A.side]){const a2=ang+k*s;
    if(!monBlocked(e.pos.x+Math.sin(a2)*look,e.pos.z+Math.cos(a2)*look,.45)){found=a2;if(s!==A.side)A.side=s;break;}}if(found!==null)break;}
  if(found!==null)ang=found;}
 const step=Math.min(d,spd*dt),bx=e.pos.x,bz=e.pos.z;monMove(e,Math.sin(ang)*step,Math.cos(ang)*step);
 e.g.rotation.y=monTurn(e.g.rotation.y,ang,dt*7);
 if(Math.hypot(e.pos.x-bx,e.pos.z-bz)<step*.3){A.stuck+=dt;if(A.stuck>.8){A.side=-A.side;A.stuck=0;A.useFlow=2;}}else A.stuck=Math.max(0,A.stuck-dt);
 /* separação entre monstros */
 for(const o of enemies){if(o===e||!o.monster||o.state==='dead')continue;const ox=e.pos.x-o.pos.x,oz=e.pos.z-o.pos.z,od=Math.hypot(ox,oz);if(od<1.3&&od>.001)monMove(e,ox/od*(1.3-od)*.4,oz/od*(1.3-od)*.4);}
 return d<1.2;
}
/* manutenção que o monAI original faria (animação, voo, recargas) quando a camada tática conduz */
function maiTick(e,dt,anim,ts){
 e.m.mixer.update(dt);const T=e.MT;
 if(T.fly){const extra=e.ai.hover||0;e.m.holder.position.y=MON.assets[e.mkey].offY+T.fly+extra+Math.sin(performance.now()*.003+e.pos.x)*.15;}
 e.atkCD=Math.max(0,e.atkCD-dt);e.hitT=Math.max(0,e.hitT-dt);
 if(anim){const a=monPlay(e,anim);if(a)a.timeScale=ts||1;}
 if(e.state!=='idle'&&e.state!=='wander')e.state=e.ai.mode==='patrol'?'idle':'wander';
 monSetBar(e);
}

/* ---------- PAPÉIS / OBJETIVOS ---------- */
function maiPackSlot(e){
 /* posição de cerco ao redor do jogador, relativa ao olhar dele: 0 = frente (isca), depois costas e laterais */
 const pack=enemies.filter(o=>o.monster&&o.state!=='dead'&&o.ai&&o.ai.mode==='engage'&&(o.ai.role==='swarm'||o.ai.role==='flank'||o.ai.role==='ambush'));
 const i=Math.max(0,pack.indexOf(e)),slots=[0,Math.PI,Math.PI*.6,-Math.PI*.6,Math.PI*.3,-Math.PI*.3,Math.PI*.85,-Math.PI*.85];
 const fwd=Math.atan2(-Math.sin(P.yaw),-Math.cos(P.yaw)),a=fwd+slots[i%slots.length];
 return {a,i,n:pack.length};
}
function maiGoal(e){
 /* devolve null => entregar ao monAI original (ataque direto); ou {x,z,spd,anim} para manobra tática */
 const A=e.ai,dx=P.x-e.pos.x,dz=P.z-e.pos.z,d=Math.hypot(dx,dz),T=e.MT;
 const role=A.role,iq=A.iq;
 if(role==='front'||role==='charger'||d<4.2)return null;
 if(role==='guard'&&A.ward&&A.ward.state!=='dead'){const w=A.ward;if(d<7)return null;
  const wx=w.pos.x+(P.x-w.pos.x)/(Math.hypot(P.x-w.pos.x,P.z-w.pos.z)||1)*2.6,wz=w.pos.z+(P.z-w.pos.z)/(Math.hypot(P.x-w.pos.x,P.z-w.pos.z)||1)*2.6;return {x:wx,z:wz,spd:T.speed,anim:'run'};}
 if(role==='swarm'||role==='flank'||role==='ambush'){
  if(iq<.25)return null;
  const s=maiPackSlot(e);
  if(s.n<2&&role==='swarm')return null;
  const r=role==='flank'||role==='ambush'?7:3.6;
  if(s.i===0&&s.n>1&&role!=='flank'){ /* ISCA: segura na frente até alguém chegar pelas costas */
   const behind=enemies.some(o=>o!==e&&o.ai&&o.ai.mode==='engage'&&Math.hypot(o.pos.x-P.x,o.pos.z-P.z)<3.5);
   if(behind||A.modeT>6)return null;
   if(d<5.5)return {x:e.pos.x-dx/d*.5,z:e.pos.z-dz/d*.5,spd:T.speed*.25,anim:'walk',face:true};}
  const gx=P.x+Math.sin(s.a)*r,gz=P.z+Math.cos(s.a)*r;
  if(Math.hypot(gx-e.pos.x,gz-e.pos.z)<2||A.modeT>9)return null;
  return {x:gx,z:gz,spd:T.speed*(role==='ambush'?1.15:1.05),anim:'run'};}
 if(role==='erratic'){const px=-dz/d,pz=dx/d,w=Math.sin(MAI.t*2.2+A.seed*6)*4.5;return {x:P.x+px*w,z:P.z+pz*w,spd:T.speed,anim:'run'};}
 if(role==='caster'){/* mantém distância e dispara */
  if(d<9)return {x:e.pos.x-dx/d*4,z:e.pos.z-dz/d*4,spd:T.speed*.8,anim:'walk',face:true};
  if(d>15)return {x:P.x,z:P.z,spd:T.speed,anim:'run',flow:true};
  const px=-dz/d*A.side,pz=dx/d*A.side;return {x:e.pos.x+px*3,z:e.pos.z+pz*3,spd:T.speed*.55,anim:'walk',face:true};}
 if(role==='aerial'){
  if(A.dive>0)return null;
  if(d<8)return {x:e.pos.x-dx/d*3,z:e.pos.z-dz/d*3,spd:T.speed,anim:'run',face:true};
  const px=-dz/d*A.side,pz=dx/d*A.side;const tx=P.x-dx/d*11+px*4,tz=P.z-dz/d*11+pz*4;return {x:tx,z:tz,spd:T.speed*.9,anim:'run',face:true};}
 if(role==='boss')return null;
 return null;
}

/* ---------- HABILIDADES ADICIONAIS (com aviso) ---------- */
function maiCharge(e,t,label,fn){const A=e.ai;A.charge=t;A.chargeMax=t;A.onCharge=fn;if(label)maiWarn(label,t+.3);snd(220,t,'sawtooth',.06,880);}
function maiAbilities(e,dt,d,seen){
 const A=e.ai,k=e.mkey;
 if(A.charge>0){A.charge-=dt;if(A.charge<=0&&A.onCharge){const f=A.onCharge;A.onCharge=null;f();A.vulnT=Math.max(A.vulnT,k==='forestboss'?0:.9);}return true;}
 A.cdR=Math.max(0,A.cdR-dt);A.cdS=Math.max(0,A.cdS-dt);
 if(!seen||P.dead)return false;
 const head=()=>e.pos.clone().setY((e.MT.fly||0)+(A.hover||0)+e.MT.h*.62);
 if(k==='bluedemon'&&A.cdR<=0&&d>6&&d<30){A.cdR=MAI_CFG.orb.cd*(1.2-A.iq*.3);
  maiCharge(e,MAI_CFG.orb.charge,'DEMÔNIO AZUL CARREGANDO ENERGIA',()=>{const h=head();for(const o of [-.12,0,.12]){const c=Math.cos(o),s=Math.sin(o),vx=P.x-h.x,vz=P.z-h.z;maiShoot(h,h.x+vx*c-vz*s,P.y+1.1,h.z+vx*s+vz*c,MAI_CFG.orb,0x40b0ff,e);}});return true;}
 if(k==='bluedemon'&&A.cdS<=0&&A.hurtT>0&&d<10){/* teletransporte tático ao ser atingido de perto */
  A.cdS=9;for(let t=0;t<12;t++){const a=Math.random()*6.283,r=8+Math.random()*6,x=P.x+Math.cos(a)*r,z=P.z+Math.sin(a)*r;
   if(!monBlocked(x,z,.6)&&Math.abs(x)<SZ-3&&Math.abs(z)<SZ-3){burst(e.pos.clone().setY(1.2),18,0x40b0ff,.5,4,0,1.4);e.pos.x=x;e.pos.z=z;burst(e.pos.clone().setY(1.2),18,0x40b0ff,.5,4,0,1.4);snd(1200,.2,'sine',.1,200);break;}}return true;}
 if(k==='dragon'){
  if(A.cdR<=0&&d>7&&d<40){A.cdR=MAI_CFG.fire.cd*(1.2-A.iq*.3);
   maiCharge(e,MAI_CFG.fire.charge,'DRAGÃO PREPARANDO FOGO',()=>{const h=head();maiShoot(h,P.x,P.y+1,P.z,MAI_CFG.fire,0xff7a20,e);});return true;}
  if(A.cdS<=0&&d>6&&d<30){A.cdS=MAI_CFG.rain.cd;maiWarn('CHUVA DE FOGO — SAIA DOS CÍRCULOS',1.6);
   for(let i=0;i<3+(A.iq>.6?2:0);i++){const a=Math.random()*6.283,r=i?2+Math.random()*4.5:0;maiZone(P.x+Math.cos(a)*r,P.z+Math.sin(a)*r,MAI_CFG.rain.r,MAI_CFG.rain.dmg*e.dmgMul,MAI_CFG.rain.warn+i*.12,0xff6a20);}
   A.dive=0;return false;}
  if(A.cdD===undefined)A.cdD=6;A.cdD-=dt;if(A.cdD<=0&&d<16){A.cdD=10;A.dive=3;maiWarn('DRAGÃO EM MERGULHO',1.2);}
 }
 if(k==='mushking'&&A.cdS<=0&&d>5&&d<26){A.cdS=MAI_CFG.summon.cd;maiWarn('REI COGUMELO INVOCANDO AJUDANTES',1.6);
  maiCharge(e,1,null,()=>maiSummon(e,MAI_CFG.summon.n));return true;}
 return false;
}
function maiSummon(e,n){
 let made=0;for(let i=0;i<n;i++){if(enemies.filter(o=>o.monster&&o.state!=='dead').length>=MON_CFG.maxAlive+3)break;
  const k=MON.assets.cactoro?'cactoro':'skeleton';const m=monSpawn(k);if(!m)continue;maiInit(m);
  const a=Math.random()*6.283,x=e.pos.x+Math.cos(a)*1.8,z=e.pos.z+Math.sin(a)*1.8;if(!monBlocked(x,z,.45)){m.pos.x=x;m.pos.z=z;}
  m.g.scale.setScalar(.55);m.hp=m.max=Math.round(70*(1+MON.wave*.05));m._lastHp=m.hp;m.mini=true;m.T={pts:40,scale:.55,hp:m.hp};m.dmgMul*=.5;
  maiSetLKP(m,P.x,P.z,1,'summon');maiMode(m,'engage');m.ai.role='swarm';
  burst(m.pos.clone().setY(.4),14,0xff9a3c,.6,3,-1,1.3);made++;}
 if(made)snd(300,.3,'triangle',.12,700);
}

/* ---------- CHEFE: REI ANCESTRAL DA FLORESTA (3 fases) ---------- */
const MAI_BOSS_PH=['FASE 1 — DESPERTAR','FASE 2 — FÚRIA DOS ESPOROS','FASE 3 — CORRUPÇÃO TOTAL'];
function maiBossInit(e){
 MAI.boss=e;e.ai.role='boss';e.ai.phase=0;e.ai.bt={rain:4,slam:8,orb:6,sum:12};e.ai.inv=0;
 e.m.holder.traverse(o=>{if(o.isMesh&&!o.userData.bossMat){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.userData.bossMat=true;}});
 e.bossMats=[];e.m.holder.traverse(o=>{if(o.isMesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.emissive)e.bossMats.push(m);});});
 /* entra na clareira central do mapa da floresta, longe do jogador */
 if(typeof FOREST!=='undefined'&&FOREST.active&&Math.hypot(P.x,P.z)>14){e.pos.x=0;e.pos.z=-2;}
 maiDom();MAI.dom.boss.style.display='block';MAI.dom.boss.children[0].textContent=e.MT.name.toUpperCase();
 maiBanner('CHEFE FINAL','REI ANCESTRAL DA FLORESTA','Fique atento aos círculos e pule as ondas de choque',4.5);
 snd(60,1.4,'sawtooth',.25,30);
}
function maiBossTint(e,hex,k){for(const m of e.bossMats||[]){m.emissive.setHex(hex);m.emissiveIntensity=k;}}
function maiBoss(e,dt,d){
 const A=e.ai,B=A.bt,f=e.hp/e.max;
 const ph=f>.66?0:f>.33?1:2;
 if(ph!==A.phase){A.phase=ph;A.inv=1.6;maiBanner(MAI_BOSS_PH[ph],'O Rei Ancestral muda de comportamento','',3);maiShock(e.pos.x,e.pos.z,12*e.dmgMul,14,0xff4020);
  maiSummon(e,ph===1?3:4);snd(55,1.6,'sawtooth',.28,28);}
 if(A.inv>0){A.inv-=dt;e.hp=Math.max(e.hp,e._invHp||e.hp);}else e._invHp=e.hp;
 /* aparência por fase */
 const pulse=.5+.5*Math.sin(MAI.t*(4+ph*3));
 if(A.vulnT>0)maiBossTint(e,0xffe040,1.2+pulse);else maiBossTint(e,ph===2?0xff2010:ph===1?0xb050ff:0x000000,ph?.4+pulse*.6:0);
 const spd=1+ph*.18;e.MT=Object.assign({},MON_TYPES.forestboss,{speed:MON_TYPES.forestboss.speed*spd,cd:MON_TYPES.forestboss.cd/(1+ph*.2)});
 if(A.charge>0||e.state==='attack'||A.vulnT>0)return false;
 for(const k in B)B[k]-=dt;
 /* Pisão Sísmico: preparação longa, onda que exige pulo, depois vulnerável */
 if(B.slam<=0&&d<16){B.slam=ph===2?7:10;
  maiCharge(e,1.25,'PISÃO SÍSMICO — PULE A ONDA!',()=>{maiShock(e.pos.x,e.pos.z,22*e.dmgMul,18,0xffa030);if(ph===2)setTimeout(()=>{if(e.state!=='dead')maiShock(e.pos.x,e.pos.z,18*e.dmgMul,18,0xff5020);},700);
   SFX.boom();e.ai.vulnT=2.6;e.hitT=2.6;maiWarn('REI ATORDOADO — ATAQUE AGORA!',2.2);});return true;}
 if(B.rain<=0&&d<40){B.rain=ph===0?8:6;const n=ph===0?4:ph===1?6:8;maiWarn('CHUVA DE ESPOROS',1.4);
  for(let i=0;i<n;i++){const a=Math.random()*6.283,r=i?1.5+Math.random()*6:0;maiZone(P.x+Math.cos(a)*r,P.z+Math.sin(a)*r,2.4,18*e.dmgMul,1.3+i*.08,ph===2?0xff3020:0xb070ff);}return false;}
 if(ph>=1&&B.orb<=0&&d>5){B.orb=ph===2?4.5:6.5;
  maiCharge(e,.9,'ORBES DE ENERGIA',()=>{const h=e.pos.clone().setY(e.MT.h*.7);const n=ph===2?5:3;for(let i=0;i<n;i++){const o=(i-(n-1)/2)*.16,c=Math.cos(o),s=Math.sin(o),vx=P.x-h.x,vz=P.z-h.z;maiShoot(h,h.x+vx*c-vz*s,P.y+1.1,h.z+vx*s+vz*c,MAI_CFG.orb,ph===2?0xff4020:0xc080ff,e);}});return true;}
 if(ph>=1&&B.sum<=0){B.sum=16;maiWarn('O REI CONVOCA A FLORESTA',1.5);maiSummon(e,2+ph);}
 return false;
}
function maiBossHud(){
 const e=MAI.boss;if(!e||!MAI.dom.ok)return;
 if(e.state==='dead'||enemies.indexOf(e)<0){MAI.dom.boss.style.display='none';if(e.state==='dead'&&!MAI.bossDown){MAI.bossDown=true;maiBanner('CHEFE DERROTADO','O Rei Ancestral caiu','',3.5);}MAI.boss=null;return;}
 const B=MAI.dom.boss;B.children[1].children[0].style.width=Math.max(0,e.hp/e.max*100)+'%';B.children[2].textContent=MAI_BOSS_PH[e.ai.phase]+(e.ai.vulnT>0?'  ·  VULNERÁVEL':'');B.classList.toggle('v',e.ai.vulnT>0);
}

/* ---------- CICLO POR MONSTRO ---------- */
function maiInit(e){
 const Pp=MAI_PERS[e.mkey]||MAI_PERS.skeleton,w=MON.wave||1;
 const iq=Math.min(1,.15+w*.09);
 e.ai={p:Pp,role:Pp.role,mode:'investigate',modeT:0,prev:null,lkp:{x:P.x,z:P.z},lkpT:MAI.t,conf:.3,src:'spawn',aware:0,iq,
  seed:Math.random(),side:Math.random()<.5?-1:1,stuck:0,pt:Math.random()*.2,seen:false,lostT:0,hp0:e.hp,lastHp:e.hp,hurtT:0,vulnT:0,
  charge:0,chargeMax:1,cdR:2+Math.random()*2,cdS:4+Math.random()*4,flash:0,rage:0,dodgeCD:1+Math.random()*2,retreated:false,hover:0,dive:0,prevState:e.state,useFlow:0};
 /* posição inicial aproximada do jogador (com erro): eles chegam procurando, não teleguiados */
 const err=14*(1-iq*.6);maiSetLKP(e,P.x+(Math.random()-.5)*err,P.z+(Math.random()-.5)*err,.3,'spawn');
 if(w<3&&(e.ai.role==='flank'||e.ai.role==='ambush'))e.ai.role=Math.random()<.5?'swarm':'front';  /* ondas iniciais: táticas simples */
 /* emboscada na floresta: algumas criaturas se escondem na mata densa perto do caminho do jogador */
 if(typeof FOREST!=='undefined'&&FOREST.active&&!e.mini&&e.mkey!=='forestboss'&&e.mkey!=='dragon'&&Math.random()<(w>=4?.3:.15)){
  const spot=maiAmbushSpot(e);if(spot){e.ai.amb=spot;maiMode(e,'ambush');}}
 maiDress(e);
}
function maiAmbushSpot(e){
 let best=null,bs=-1;for(let t=0;t<24;t++){const a=Math.random()*6.283,r=9+Math.random()*14,x=P.x+Math.cos(a)*r,z=P.z+Math.sin(a)*r;
  if(Math.abs(x)>SZ-4||Math.abs(z)>SZ-4||monBlocked(x,z,.6))continue;const dn=forestDensAt(x,z);
  /* atrás de tronco/árvore em relação ao jogador vale mais */
  const cover=maiLOS(P.x,P.z,x,z)?0:.8;const s=dn+cover-Math.abs(r-14)*.02;if(s>bs){bs=s;best={x,z};}}
 return bs>.6?best:null;
}
function maiUpdateMon(e,dt,inner){
 const A=e.ai,T=e.MT;A.modeT+=dt;
 const dx=P.x-e.pos.x,dz=P.z-e.pos.z,d=Math.hypot(dx,dz);
 /* dano recebido: alerta imediato + vulnerabilidade amplia o dano */
 if(e.hp<A.lastHp){const lost=A.lastHp-e.hp;A.flash=.18;A.hurtT=1.2;
  if(A.vulnT>0)e.hp=Math.max(1,e.hp-lost*MAI_CFG.vuln.mul);
  burst(e.pos.clone().setY((T.fly||0)+T.h*.6),3,A.p.eye,.25,3,4,.8);
  maiSetLKP(e,P.x,P.z,1,'hit');if(A.mode!=='retreat')maiMode(e,'engage');maiShare(e,.9);}
 A.lastHp=e.hp;A.hurtT=Math.max(0,A.hurtT-dt);A.vulnT=Math.max(0,A.vulnT-dt);A.rage=Math.max(0,A.rage-dt);
 /* transição para um poder existente => aviso visual/sonoro; ao terminar => vulnerável */
 if(e.state!==A.prevState){
  if(/^pw/.test(e.state)){const nm={pwjump:'ALIEN SALTANDO',pwfire:'DEMÔNIO INVOCANDO CHAMAS',pwcharge:'DINO VAI INVESTIR!',pwroar:'YETI — RUGIDO CONGELANTE',pwtele:'CAVEIRA TELETRANSPORTANDO'}[e.state];
   maiRing(e.pos.x,e.pos.z,1.2,A.p.eye,.8,4);if(nm&&d<30)maiWarn(nm,1.2);}
  if(/^pw/.test(A.prevState||'')&&e.state==='chase')A.vulnT=MAI_CFG.vuln.t;
  A.prevState=e.state;}
 /* percepção (frequência menor para monstros distantes) */
 A.pt-=dt;if(A.pt<=0){A.pt=d<15?.12:d<30?.22:.4;
  const see=maiPerceive(e);
  if(see){A.aware=Math.min(1.2,A.aware+(A.pt*(1.6+A.iq*2)*(d<8?3:1)*A.p.react));if(A.aware>=1||A.mode==='engage'){A.seen=true;maiSetLKP(e,P.x,P.z,1,'sight');
    if(A.mode!=='engage'&&A.mode!=='retreat'){maiMode(e,'engage');e.seen=true;if(A.prev==='patrol'||A.prev==='search'||A.prev==='ambush')snd(140+Math.random()*60,.25,'sawtooth',.08,70);}
    MAI.lastSeenAny=MAI.t;if(MAI.t-(A.shareT||0)>1){A.shareT=MAI.t;maiShare(e,.85);}}}
  else{A.aware=Math.max(0,A.aware-A.pt*.5);A.seen=false;
   /* audição: tiros/explosões (AI.noise) e passos do jogador */
   if(typeof AI!=='undefined'&&AI.noiseT>0&&AI.noise){const n=AI.noise,nd=Math.hypot(n.x-e.pos.x,n.z-e.pos.z);
    if(nd<n.r*A.p.hear*1.6&&(A.mode!=='engage'||MAI.t-A.lkpT>2)&&A.mode!=='retreat'){if(MAI.t-A.lkpT>.5||A.src!=='sight'){maiSetLKP(e,n.x+(Math.random()-.5)*2,n.z+(Math.random()-.5)*2,.8,'noise');if(A.mode!=='engage'&&A.mode!=='investigate'&&A.mode!=='ambush')maiMode(e,'investigate');}}}
   if(MAI.noise&&d<MAI.noise*A.p.hear&&A.mode!=='engage'&&A.mode!=='retreat'){maiSetLKP(e,P.x+(Math.random()-.5)*2.5,P.z+(Math.random()-.5)*2.5,.7,'step');if(A.mode!=='ambush')maiMode(e,'investigate');else if(d<10)maiMode(e,'engage');}
  }}
 /* ENGAJADO mas perdeu contato: vai à última posição conhecida, depois busca */
 if(A.mode==='engage'&&!A.seen&&e.mkey!=='forestboss'){A.lostT+=dt;if(A.lostT>(1.2+A.iq*.8)&&d>3.5){A.lostT=0;
   /* criaturas espertas tentam contornar a mata para surpreender */
   if(A.iq>.5&&(A.role==='flank'||A.role==='ambush'||A.role==='erratic')&&Math.random()<.5){const a=Math.atan2(A.lkp.x-e.pos.x,A.lkp.z-e.pos.z)+A.side*1.2;A.lkp.x+=Math.sin(a)*6;A.lkp.z+=Math.cos(a)*6;}
   maiMode(e,'investigate');}}else A.lostT=0;
 /* recuo estratégico com pouca vida (criaturas ágeis) */
 if(A.p.retreat&&!A.retreated&&e.hp<e.max*A.p.retreat&&A.mode==='engage'&&d<14&&e.state==='chase'){A.retreated=true;maiMode(e,'retreat');
  burst(e.pos.clone().setY(1),10,A.p.eye,.4,3,0,1);}
 /* habilidades novas */
 let busy=false;
 const innerBusy=e.state!=='idle'&&e.state!=='wander'&&e.state!=='chase';
 if(!innerBusy&&A.mode==='engage'){busy=e.mkey==='forestboss'?maiBoss(e,dt,d):maiAbilities(e,dt,d,A.seen);}
 else if(A.charge>0){A.charge-=dt;if(A.charge<=0&&A.onCharge){const f=A.onCharge;A.onCharge=null;f();}busy=true;}
 if(e.mkey==='forestboss')maiBossHud();
 if(busy){maiTick(e,dt,'idle');e.g.rotation.y=monTurn(e.g.rotation.y,Math.atan2(dx,dz),dt*6);e.state='chase';maiDressUpdate(e,dt);return;}
 if(innerBusy){inner(e,dt);maiDressUpdate(e,dt);return;}
 /* ---- Decisão por modo ---- */
 const spdK=(A.rage>0?1.25:1);
 if(A.mode==='engage'){
  /* esquiva lateral (ninja / alien) quando o jogador mira nele */
  if(A.p.dodge||e.mkey==='alien'){A.dodgeCD-=dt;const fwdx=-Math.sin(P.yaw),fwdz=-Math.cos(P.yaw),aim=-(dx*fwdx+dz*fwdz)/(d||1);
   if(A.dodgeCD<=0&&aim>.96&&d>4&&d<25){A.dodgeCD=1.4+Math.random()*1.6;A.dodge={t:.28,x:-dz/d*A.side*(e.mkey==='ninja'?14:11),z:dx/d*A.side*(e.mkey==='ninja'?14:11)};A.side=-A.side;
    burst(e.pos.clone().setY(.8),8,e.mkey==='ninja'?0x222233:0x9dff6a,.4,2,0,1.4);}}
  if(A.dodge&&A.dodge.t>0){A.dodge.t-=dt;monMove(e,A.dodge.x*dt,A.dodge.z*dt);maiTick(e,dt,'run',1.6);maiDressUpdate(e,dt);return;}
  if(e.mkey==='dragon'){A.hover+=((A.dive>0?0:2.4)-A.hover)*Math.min(1,dt*2);if(A.dive>0)A.dive-=dt;}
  const goal=maiGoal(e);
  if(!goal){e.state='chase';const T0=e.MT;if(A.rage>0)e.MT=Object.assign({},T0,{speed:T0.speed*spdK});inner(e,dt);if(A.rage>0&&e.MT!==T0&&e.mkey!=='forestboss')e.MT=T0;maiDressUpdate(e,dt);return;}
  maiTick(e,dt,goal.anim,goal.anim==='run'?1:1.1);
  maiSteer(e,goal.x,goal.z,goal.spd*spdK,dt,goal.flow?NAV:null);
  if(goal.face)e.g.rotation.y=monTurn(e.g.rotation.y,Math.atan2(dx,dz),dt*8);
  maiDressUpdate(e,dt);return;}
 if(A.mode==='retreat'){
  /* foge para longe do jogador, preferindo vegetação densa, por ~3,5 s; depois volta com fúria */
  const ax=e.pos.x-dx/d*8,az=e.pos.z-dz/d*8;maiTick(e,dt,'run',1.2);maiSteer(e,ax,az,T.speed*1.15,dt);
  if(A.modeT>3.5||d>22){A.rage=6;maiMode(e,'investigate');maiSetLKP(e,P.x,P.z,.9,'memory');}
  maiDressUpdate(e,dt);return;}
 if(A.mode==='ambush'){
  const s=A.amb;if(!s){maiMode(e,'investigate');}else{
   const at=Math.hypot(s.x-e.pos.x,s.z-e.pos.z)<1.2;
   if(!at){maiTick(e,dt,'run');maiSteer(e,s.x,s.z,T.speed*1.1,dt);}
   else{maiTick(e,dt,'idle');e.g.rotation.y=monTurn(e.g.rotation.y,Math.atan2(dx,dz),dt*3);}
   if(d<(at?9:6)||A.modeT>28){A.rage=3;maiMode(e,'engage');maiSetLKP(e,P.x,P.z,1,'ambush');if(d<12)maiWarn('EMBOSCADA!',1);}}
  maiDressUpdate(e,dt);return;}
 if(A.mode==='investigate'){
  const share=MAI.t-MAI.lkpT<3&&A.src!=='noise';
  if(share){A.lkp.x+=(MAI.lkp.x-A.lkp.x)*.02;A.lkp.z+=(MAI.lkp.z-A.lkp.z)*.02;}
  maiTick(e,dt,A.conf>.6?'run':'walk',1);
  const far=Math.hypot(A.lkp.x-e.pos.x,A.lkp.z-e.pos.z);
  const arrived=maiSteer(e,A.lkp.x,A.lkp.z,T.speed*(A.conf>.6?1:.6)*spdK,dt,(A.useFlow>0||far>18)&&MAI.lkpField?MAI.lkpField:null);
  if(A.useFlow>0)A.useFlow-=dt;
  if(arrived||A.modeT>18)maiMode(e,'search');
  maiDressUpdate(e,dt);return;}
 if(A.mode==='search'){
  const p=A.searchPts[A.searchI];maiTick(e,dt,'walk',1);
  if(!p||A.modeT>MAI_CFG.forgetT){maiMode(e,'patrol');}
  else if(maiSteer(e,p.x,p.z,T.speed*.6,dt)){A.searchI++;e.g.rotation.y+=A.side*.6;}
  maiDressUpdate(e,dt);return;}
 /* PATRULHA: anda pela área (clareiras e trilhas) até perceber algo */
 if(!A.pat||Math.hypot(A.pat.x-e.pos.x,A.pat.z-e.pos.z)<1.5||A.modeT>12){A.modeT=A.modeT>12?0:A.modeT;
  const a=Math.random()*6.283,r=6+Math.random()*14;A.pat={x:Math.max(-SZ+4,Math.min(SZ-4,(MAI.lkp?MAI.lkp.x:0)+Math.cos(a)*r)),z:Math.max(-SZ+4,Math.min(SZ-4,(MAI.lkp?MAI.lkp.z:0)+Math.sin(a)*r))};}
 maiTick(e,dt,'walk',1);maiSteer(e,A.pat.x,A.pat.z,T.speed*.4,dt);
 maiDressUpdate(e,dt);
}

/* ---------- ENVOLTÓRIOS ---------- */
{const _inner=monAI;monAI=function(e,dt){
 if(!e.monster||e.state==='dead'||GM.active!=='monsters'){if(e.m&&e.m.mai&&e.state==='dead'){e.m.mai.grp.visible=false;}_inner(e,dt);return;}
 if(!e.ai)maiInit(e);
 maiUpdateMon(e,dt,_inner);
};}
function maiEnsureBoss(){
 if(MON.assets.forestboss||!MON.assets.mushking)return !!MON.assets.forestboss;
 const A=MON.assets.mushking,f=MON_TYPES.forestboss.h/MON_TYPES.mushking.h;
 MON.assets.forestboss={scene:A.scene,scale:A.scale*f,offY:A.offY*f,offX:A.offX*f,offZ:A.offZ*f,width:A.width*f,clips:A.clips};return true;}
{const _sp=monSpawn;monSpawn=function(k){if(k==='forestboss')maiEnsureBoss();const e=_sp(k);if(e){e.m.g.scale.setScalar(1);e.ai=null;if(e.m.mai)e.m.mai.grp.visible=true;
  if(k==='forestboss'){maiInit(e);maiBossInit(e);}}return e;};}
/* ondas com composição própria (ordem de entrada = ordem da lista) */
const MAI_WAVES=[
 null,
 {n:'PATRULHA DOS MORTOS',a:'Criaturas comuns · aprenda os ataques',l:{skeleton:5,ninja:3,cactoro:3}},
 {n:'SUSSURROS NA MATA',a:'Aliens saltam · caveiras teletransportam',l:{skeleton:4,cactoro:2,alien:3,ghost:2,ninja:2}},
 {n:'MURALHA DE CARNE',a:'Orcs resistentes · grito de guerra',l:{orc:2,skeleton:5,ninja:3,ghost:2,cactoro:2}},
 {n:'INFERNO E INVESTIDA',a:'Demônios em chamas · Dino investe',l:{demon:2,orc:2,dino:1,alien:3,skeleton:4}},
 {n:'GIGANTES DO GELO',a:'Yetis congelam · Dinos derrubam',l:{yeti:2,dino:2,cactoro:4,ninja:4,ghost:2}},
 {n:'O ESCOLTADO',a:'Demônio Azul dispara energia · guardas o protegem',l:{bluedemon:1,skeleton:4,orc:2,demon:2,alien:3}},
 {n:'PRESSÃO ESPECIAL',a:'Reis Cogumelo invocam e explodem',l:{mushking:2,bluedemon:1,ninja:5,ghost:3,yeti:1}},
 {n:'CÉU EM CHAMAS',a:'Dragões · bolas de fogo · chuva de fogo',l:{dragon:2,demon:2,alien:4,dino:1,skeleton:4}},
 {n:'CAÇADA COORDENADA',a:'Grupos inteligentes · cerco total',l:{dragon:1,bluedemon:2,mushking:1,orc:3,ninja:4,ghost:3,yeti:1}},
 {n:'O REI ANCESTRAL',a:'Chefe com 3 fases · pule as ondas de choque',l:{forestboss:1,orc:2,skeleton:4,ninja:2}}
];
{const _wl=monWaveList;monWaveList=function(w){
 const W=MAI_WAVES[w];if(!W)return _wl(w);const list=[];maiEnsureBoss();
 for(const k in W.l){if(!MON.assets[k])continue;for(let i=0;i<W.l[k];i++)list.push(k);}
 if(!list.length)return _wl(w);
 /* intercala tipos (comuns primeiro, especiais no meio) e inverte: a fila sai do fim */
 const order=list.sort((a,b)=>((MON_TYPES[a].cls==='comum'?0:1)-(MON_TYPES[b].cls==='comum'?0:1))||(Math.random()-.5));
 if(order.includes('forestboss')){order.splice(order.indexOf('forestboss'),1);order.splice(2,0,'forestboss');}
 return order.reverse();};}
{const _sw=monStartWave;monStartWave=function(){_sw();const W=MAI_WAVES[MON.wave];MAI.bossDown=false;MAI.stallT=0;
 if(W)maiBanner('ONDA '+MON.wave+(MON.wave===MON_CFG.waves?' · FINAL':''),W.n,W.a+'  ·  '+MON.queue.length+' monstros',3.4);};}
{const _upd=gmUpdate;gmUpdate=function(dt){
 _upd(dt);
 if(GM.active!=='monsters'||state!=='play')return;
 MAI.t+=dt;
 /* ruído dos passos do jogador (correr = alto, agachado = quase nada; vegetação densa farfalha) */
 const sp=Math.hypot(P.x-MAI.pp.x,P.z-MAI.pp.z)/Math.max(.001,dt);MAI.pp.x=P.x;MAI.pp.z=P.z;MAI.speed+=(Math.min(12,sp)-MAI.speed)*Math.min(1,dt*6);
 const fd=typeof forestDensAt==='function'?forestDensAt(P.x,P.z):0;
 MAI.noise=MAI.speed<.6?0:(P.crouch?MAI_CFG.noiseCrouch:MAI.speed>5.5?MAI_CFG.noiseSprint:MAI_CFG.noiseWalk)*(1+fd*.5);
 /* campo de fluxo compartilhado até a última posição conhecida do grupo */
 if(MAI.lkp&&typeof navUpdate==='function'&&NAV.blk){MAI.lkpField=MAI.lkpField||{dist:null,q:null,t:0,pc:-1};navUpdate(dt,MAI.lkp,MAI.lkpField);}
 /* anti-travamento: se ninguém vê o jogador há muito tempo, os monstros "farejam" a posição */
 const living=enemies.filter(e=>e.monster&&e.state!=='dead');
 if(living.length&&MAI.t-MAI.lastSeenAny>22){MAI.lastSeenAny=MAI.t-8;for(const e of living)if(e.ai&&e.ai.mode!=='engage'){maiSetLKP(e,P.x+(Math.random()-.5)*6,P.z+(Math.random()-.5)*6,.7,'scent');maiMode(e,'investigate');}}
 maiProjUpdate(dt);maiFxUpdate(dt);
 /* indicador de consciência: quantos te viram / procuram */
 if(MAI.dom.ok||living.length){maiDom();const eng=living.filter(e=>e.ai&&e.ai.mode==='engage').length,src=living.filter(e=>e.ai&&(e.ai.mode==='search'||e.ai.mode==='investigate')).length;
  const hid=fd>.5?'  ·  ESCONDIDO NA MATA':'';MAI.dom.aware.textContent=living.length?('👁 '+eng+' te veem  ·  ? '+src+' procurando'+hid):'';}
};}
/* explosões: atordoam e empurram monstros próximos; os demais investigam */
{const _ve=typeof vegOnExplosion==='function'?vegOnExplosion:null;window.vegOnExplosion=function(pos,k){if(_ve)_ve(pos,k);
 if(GM.active!=='monsters')return;
 for(const e of enemies){if(!e.monster||e.state==='dead'||!e.ai)continue;const d=Math.hypot(e.pos.x-pos.x,e.pos.z-pos.z);
  if(d<6.5&&e.mkey!=='forestboss'){e.hitT=Math.max(e.hitT,.6);const f=(6.5-d)/6.5*1.6/(d||1);monMove(e,(e.pos.x-pos.x)*f,(e.pos.z-pos.z)*f);if(e.m.acts.hit){const a=monPlay(e,'hit',.05);if(a)a.timeScale=1.5;}}
  else if(d<45&&e.ai.mode!=='engage'){maiSetLKP(e,pos.x,pos.z,.8,'noise');maiMode(e,'investigate');}}};
 try{vegOnExplosion=window.vegOnExplosion;}catch(e){}}
/* reação à morte de um aliado: os próximos ficam furiosos e sabem de onde veio o tiro */
{const _k=gmOnKill;gmOnKill=function(e){
 if(GM.active==='monsters'&&e&&e.monster){
  if(e.m&&e.m.mai)e.m.mai.grp.visible=false;
  let roar=false;for(const o of enemies){if(o===e||!o.monster||o.state==='dead'||!o.ai)continue;
   if(Math.hypot(o.pos.x-e.pos.x,o.pos.z-e.pos.z)<20){o.ai.rage=4;maiSetLKP(o,P.x,P.z,.9,'ally');if(o.ai.mode!=='retreat')maiMode(o,'engage');roar=true;}}
  if(roar)snd(110,.4,'sawtooth',.08,60);
  if(e===MAI.boss)maiBossHud();}
 _k(e);};}
{const _c=gmClear;gmClear=function(){
 for(const p of MAI.proj)if(p.live){p.live=false;scene.remove(p.m);}
 for(const f of MAI.fx){scene.remove(f.m);}MAI.fx.length=0;
 for(const w of MAI.warn){if(w.disc)scene.remove(w.disc);if(w.ring)scene.remove(w.ring);}MAI.warn.length=0;
 MAI.boss=null;MAI.lkp=null;MAI.lkpField=null;MAI.lastSeenAny=MAI.t;maiHudHide();
 _c();};}
{const _h=gmHudText;gmHudText=function(){const s=_h();if(GM.active!=='monsters')return s;const W=MAI_WAVES[MON.wave];
 const map=typeof FOREST!=='undefined'&&FOREST.active?'ENCHANTED WILDS · ':'';return map+s+(W&&MON.inWave?'  ·  '+W.n:'');};}
/* guardas: comuns da mesma onda protegem criaturas especiais */
setInterval(()=>{try{if(GM.active!=='monsters')return;const sp=enemies.filter(e=>e.monster&&e.state!=='dead'&&e.ai&&(e.mkey==='bluedemon'||e.mkey==='mushking'||e.mkey==='forestboss'));
 for(const s of sp){const g=enemies.filter(o=>o.monster&&o.state!=='dead'&&o.ai&&o.ai.role==='guard'&&o.ai.ward===s).length;if(g>=2)continue;
  const c=enemies.find(o=>o.monster&&o.state!=='dead'&&o.ai&&!o.mini&&MON_TYPES[o.mkey].cls==='comum'&&o.ai.role!=='guard'&&Math.hypot(o.pos.x-s.pos.x,o.pos.z-s.pos.z)<18);
  if(c&&c.ai.iq>.45){c.ai.role='guard';c.ai.ward=s;}}
 for(const o of enemies)if(o.ai&&o.ai.role==='guard'&&(!o.ai.ward||o.ai.ward.state==='dead'))o.ai.role=o.ai.p.role;}catch(err){}},1000);
/* esconde os avisos fora da partida */
setInterval(()=>{if(!MAI.dom.ok)return;const on=state==='play'&&GM.active==='monsters';MAI.dom.aware.style.display=on?'':'none';if(!on){MAI.dom.boss.style.display='none';}else if(MAI.boss)MAI.dom.boss.style.display='block';},300);
/* ganchos de depuração */
window.__mai={MAI,MAI_PERS,MAI_WAVES,state:()=>enemies.filter(e=>e.monster&&e.ai).map(e=>({k:e.mkey,mode:e.ai.mode,role:e.ai.role,hp:e.hp,seen:e.ai.seen,x:+e.pos.x.toFixed(1),z:+e.pos.z.toFixed(1)}))};
