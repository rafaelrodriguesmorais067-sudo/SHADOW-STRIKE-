"use strict";
/* TITAN: THE ANCIENT COLOSSUS — MODO DE JOGO
   Integra o chefe ao jogo existente pelos mesmos ganchos usados pelos outros modos
   (gmStart/gmUpdate/gmClear/gmHudText em modes.js) e envolve, sem reescrever:
   enemyAI/trackAI (o golem tem IA própria), cbtZoneMul (região atingida), burst (ponto do impacto),
   cbtMatOf (tiros quebram rochas da arena), shoot (bloqueio na cinemática), hurt (estatísticas),
   endGame (sequência de derrota), envApplyLighting (iluminação da arena).
   Cinemática de introdução, HUD do chefe, vitória/derrota e reinício também ficam aqui. */

MODES_META.titan={title:'TITAN: THE ANCIENT COLOSSUS',goal:1,desc:'Derrote o colosso de pedra'};
TT.cine=null;TT.down=null;TT.wait=false;

/* ---------- GANCHOS NO JOGO ORIGINAL ---------- */
{const _ai=enemyAI;enemyAI=function(e,dt){if(e&&e.golem){if(e.state!=='dead')e.state='fight';return;}_ai(e,dt);};}
if(typeof trackAI==='function'){const _t=trackAI;trackAI=function(e,dt){if(e&&e.golem)return;_t(e,dt);};}
if(typeof cbtZoneMul==='function'){const _z=cbtZoneMul;cbtZoneMul=function(o,ball){if(o&&o.userData&&o.userData.ttZone){TT.hitZone=o.userData.ttZone;TT.hitObj=o;return 1;}return _z(o,ball);};}
{const _b=burst;burst=function(pos,n,col,life,spd,grav,size){if(TT.active&&TT.pend.length&&col===0xb02020){ttFlushHit(pos);_b(pos,n,0x8f8a7e,life,spd,grav,size);return;}_b(pos,n,col,life,spd,grav,size);};}
if(typeof cbtMatOf==='function'){const _mo=cbtMatOf;cbtMatOf=function(obj){if(TT.active&&obj&&obj.userData&&obj.userData.ttProp){const p=obj.userData.ttProp;if(p.breakable&&p.kind!=='pillar')ttPropDamage(p,WEAPONS[cw].dmg,P);}return _mo(obj);};}
{const _s=shoot;shoot=function(){if(TT.lockFire)return false;return _s();};}
{const _h=hurt;hurt=function(d,from){if(TT.active&&(TT.cine||TT.god))return;const b=P.hp;_h(d,from);if(TT.active&&TT.stats)TT.stats.taken+=Math.max(0,b-P.hp);};}
{const _e=endGame;endGame=function(win){if(TT.active&&GM.active==='titan'){if(!win)ttPlayerDown();return;}_e(win);};}
{const _l=envApplyLighting;envApplyLighting=function(col){_l(col);if(TT.active)ttLighting();};}
{const _gs=gmStart;gmStart=function(m){if(m!=='titan'){_gs(m);return;}gmClear();GM.active='titan';ttModeStart();};}
{const _gc=gmClear;gmClear=function(){if(TT.active||TT.wait)ttModeStop();_gc();};}
{const _gu=gmUpdate;gmUpdate=function(dt){_gu(dt);if(TT.active)ttModeUpdate(dt);};}
if(typeof gmHudText==='function'){const _ht=gmHudText;gmHudText=function(){if(GM.active==='titan'&&TT.B)return 'TITAN — FASE '+(TT.B.phase+1)+': '+TITAN_CFG.phaseNames[TT.B.phase];return _ht();};}
/* pré-carrega o modelo enquanto o jogador está no menu */
{const _sg=startGame;startGame=function(){_sg();setTimeout(()=>ttLoad(),1200);ttHudWire();};}

/* ---------- ILUMINAÇÃO DA ARENA (por fase) ---------- */
const TT_LIGHT=[
 {fog:0x1a2129,n:26,f:118,hs:0x71859a,hg:0x2b2620,hi:.56,sun:0xb4c6ff,si:1.05,fi:.2,exp:1.02,rune:.35,fire:1},
 {fog:0x1d1b27,n:24,f:108,hs:0x6c6f96,hg:0x262030,hi:.52,sun:0xa8b0ff,si:1.0,fi:.16,exp:1.0,rune:.6,fire:1.1},
 {fog:0x281412,n:18,f:92,hs:0x8a5a52,hg:0x221010,hi:.48,sun:0xffb4a0,si:.9,fi:.12,exp:.98,rune:.9,fire:1.3}];
function ttLighting(){
 const L=TT_LIGHT[TT.B?TT.B.phase:0],bri=save.bri||1;
 scene.fog.color.setHex(L.fog);scene.fog.near=L.n;scene.fog.far=L.f;scene.background.setHex(L.fog);
 hemi.color.setHex(L.hs);hemi.groundColor.setHex(L.hg);hemi.intensity=L.hi;sun.color.setHex(L.sun);sun.intensity=L.si;fill.intensity=L.fi;
 renderer.toneMappingExposure=L.exp*bri*(ENV.nvOn?1.15:1);
 if(typeof _gDir!=='undefined')_gDir.set(-.35,.85,.42).normalize();
 if(typeof GFX!=='undefined')GFX.emergK=0;
 if(window.__sunGlow)window.__sunGlow.visible=false;
 TTAR.runeK=L.rune;TTAR.lightK=L.fire;
}
const TT_ENVSAVE={};
function ttEnvEnter(){
 TT_ENVSAVE.weather=ENV.weather;TT_ENVSAVE.next=ENV.weatherNext;TT_ENVSAVE.wt=ENV.weatherT;TT_ENVSAVE.sky=window.__sky?window.__sky.visible:true;
 ENV.weather='clear';ENV.weatherNext=1e9;if(ENV.rainMesh)ENV.rainMesh.visible=false;if(window.__sky)window.__sky.visible=false;
 if(typeof GFX!=='undefined')GFX.skyKey='';envApplyLighting(envSkyColor(ENV.time));
}
function ttEnvExit(){
 if(TT_ENVSAVE.weather!==undefined){ENV.weather=TT_ENVSAVE.weather;ENV.weatherNext=TT_ENVSAVE.next;ENV.weatherT=TT_ENVSAVE.wt;}
 if(window.__sky)window.__sky.visible=TT_ENVSAVE.sky!==false;
 if(typeof GFX!=='undefined')GFX.skyKey='';envApplyLighting(envSkyColor(ENV.time));if(typeof gSetLightDirFollow==='function')gSetLightDirFollow();
}

/* ---------- INÍCIO / FIM DO MODO ---------- */
function ttModeStart(){
 document.body.classList.add('titan');
 if(TT.err&&!TT.asset){ttLoadError();return;}
 if(!TT.asset){
  TT.wait=true;ttShow('ttload',true);ttUI.loadTxt.textContent='Despertando o colosso…';
  $('hud').classList.remove('on');
  const iv=setInterval(()=>{ttUI.loadBar.style.width=Math.round((TT.progress||0)*100)+'%';},100);
  ttLoad().then(()=>{clearInterval(iv);if(!TT.wait||GM.active!=='titan')return;TT.wait=false;ttShow('ttload',false);ttBegin();})
   .catch(()=>{clearInterval(iv);TT.wait=false;ttLoadError();});
  return;}
 ttBegin();
}
function ttLoadError(){
 ttShow('ttload',true);ttUI.loadTxt.innerHTML='<b>O Titã não pôde ser carregado.</b><br><small>'+(TT.err||'erro desconhecido')+'</small>';ttUI.loadBar.style.width='0';
 ttUI.loadBack.style.display='inline-block';console.error('[TITAN] Modo cancelado: o chefe não foi criado para evitar um golem invisível.');
}
function ttBegin(){
 /* FX (texturas) antes do chefe: o chefe usa o brilho dos pools */
 ttfxInit();const B=ttBuildBoss();
 if(!TT.stoneSet){TT.stoneSet=true;ttArenaBuild();const sm=new THREE.MeshStandardMaterial({map:TTAR.tex.rockMap||null,roughness:.97,metalness:0,color:0xa8a398});TTFX.stoneMat=sm;TTFX.deb.material=sm;}
 TT.active=true;GM.active='titan';
 ttArenaEnter();ttArenaReset();ttfxAttach(true);ttfxReset();ttEnvEnter();
 ttResetBoss();if(enemies.indexOf(B.e)<0)enemies.push(B.e);alive=1;toSpawn=0;
 Object.assign(P,{x:0,y:0,z:25,vy:0,yaw:0,pitch:.04,hp:100,dead:false});TT.lastPX=P.x;TT.lastPZ=P.z;TT.pv.set(0,0,0);
 TT.supplyT=TITAN_CFG.supplyEvery;dropPick(-4,22);dropPick(5,21);
 TT.down=null;ttShow('ttend',false);ttUI.fade.style.opacity='0';
 ttHudReset();ttCineStart();
 ttLog('luta iniciada · HP',B.max,'· dificuldade',typeof diffKey!=='undefined'?diffKey:'normal');
}
function ttModeStop(){
 TT.wait=false;ttShow('ttload',false);
 if(!TT.active){document.body.classList.remove('titan');return;}
 TT.active=false;TT.lockFire=false;TT.cine=null;TT.down=null;
 ttRemoveBoss();ttPrisonClear(true);ttfxReset();ttfxAttach(false);ttArenaExit();ttaStopAll();ttEnvExit();
 gun.visible=true;cam.fov=75;cam.updateProjectionMatrix();
 ['ttlb','tttitle','ttskip','ttend','ttbar'].forEach(id=>ttShow(id,false));ttUI.fade.style.opacity='0';ttHudPrison(false);
 document.body.classList.remove('titan');
}

/* ---------- CINEMÁTICA ---------- */
const TT_CINE_LEN=10.6;
function ttCineStart(){
 const B=TT.B;TT.cine={t:0,ev:{}};TT.lockFire=true;gun.visible=false;
 B.tilt.position.y=-9.4;const a=B.anim.restart('awaken',0,0);if(a)a.time=0;B.ai.state='INTRO';
 $('hud').classList.remove('on');if(isTouch)TB.forEach(i=>{const el=$(i);if(el)el.style.display='none';});
 ttShow('ttlb',true);ttShow('ttskip',true);ttShow('ttbar',false);ttUI.title.classList.remove('show');ttShow('tttitle',true);
 ttUI.fade.style.transition='none';ttUI.fade.style.opacity='1';setTimeout(()=>{ttUI.fade.style.transition='opacity 1.2s';ttUI.fade.style.opacity='0';},60);
 TTS.quake(3.4);
}
const _ttCP=new THREE.Vector3(),_ttCL=new THREE.Vector3(),_ttPQ=new THREE.Quaternion(),_ttPP=new THREE.Vector3(),_ttM4=new THREE.Matrix4();
function ttEase(k){k=Math.max(0,Math.min(1,k));return k*k*(3-2*k);}
function ttCineUpdate(dt){
 const C=TT.cine,B=TT.B,t=(C.t+=dt),G=B.root.position,ev=C.ev;
 P.x=0;P.z=25;P.y=0;P.vy=0;P.yaw=0;P.pitch=.04;inp.fire=false;
 /* eventos */
 if(t<3.2){if(Math.random()<dt*6){const a=Math.random()*6.283,r=3+Math.random()*7;TT._v3.set(G.x+Math.cos(a)*r,.2,G.z+Math.sin(a)*r);ttfxDust(TT._v3,1,3,2,2);if(Math.random()<.5)ttfxDebris(TT._v3,3,6,.3);}
  ttfxShake(.25+t*.08,.2);TTAR.runeK=.35+t*.25;if(!ev.crack){ev.crack=1;ttfxCrack(G,8,6,0x55ffe6);}}
 if(t>=3.2&&!ev.rise){ev.rise=1;const a=B.anim.cur;if(a)a.timeScale=1;TTS.impact(G,1.2);TTS.roar(G,.6);ttfxDebris(TT._v3.copy(G).setY(.5),30,11,.5,1.2);ttfxDust(G,12,6,3.5,8);ttfxShake(1.2,.8);ttfxCrater(G,6);}
 if(t>=3.2&&t<6.4){const k=ttEase((t-3.2)/3.0);B.tilt.position.y=-9.4*(1-k);if(Math.random()<dt*10){const a=Math.random()*6.283;TT._v3.set(G.x+Math.cos(a)*3,.3,G.z+Math.sin(a)*3);ttfxDebris(TT._v3,2,6,.35);ttfxDust(TT._v3,1,3,1.8,2);}ttfxShake(.5,.2);}
 if(t>=6.4&&!ev.up){ev.up=1;B.tilt.position.y=0;}
 if(t>=6.6&&!ev.roar){ev.roar=1;B.anim.restart('enraged',.3);TTS.roar(G,1.4);ttUI.title.classList.add('show');}
 if(t>=7.4&&!ev.wave){ev.wave=1;ttfxRing(G,1,30,1.2,0x5ffff0,.9);ttfxShake(1.3,.9);ttfxFlash(TT._v3.copy(G).setY(5),0x5ffff0,8,.6);ttfxSpark(B.anchors.core.getWorldPosition(TT._v3),26,0x7ffff0,12,1,.5,0);}
 if(t>=9.4&&!ev.end){ev.end=1;ttUI.title.classList.remove('show');ttShow('ttlb',false);}
 /* câmera */
 let k;
 if(t<3.2){k=t/3.2;_ttCP.set(16-5*k,2.2-.6*k,10-6*k);_ttCL.set(G.x,2,G.z);}
 else if(t<6.6){k=(t-3.2)/3.4;_ttCP.set(-7+2*k,.7-.1*k,1-2*k);_ttCL.set(G.x,2+ttEase(k)*4.5,G.z);}
 else{k=Math.min(1,(t-6.6)/2.8);_ttCP.set(0,1.3+.5*k,4+5*k);_ttCL.set(G.x,5.6,G.z);}
 _ttPP.copy(cam.position);_ttPQ.copy(cam.quaternion);
 cam.position.copy(_ttCP);cam.lookAt(_ttCL);
 if(t>=9.4){const b=ttEase((t-9.4)/1.2);cam.position.lerp(_ttPP,b);cam.quaternion.slerp(_ttPQ,b);}
 cam.fov=t<9.4?52:52+(75-52)*ttEase((t-9.4)/1.2);cam.updateProjectionMatrix();
 if(t>=TT_CINE_LEN)ttCineEnd();
}
function ttCineSkip(){if(!TT.cine)return;const B=TT.B;B.tilt.position.y=0;B.anim.restart('idle',.2);ttUI.title.classList.remove('show');ttCineEnd();}
function ttCineEnd(){
 const B=TT.B;TT.cine=null;TT.lockFire=false;gun.visible=true;B.tilt.position.y=0;if(typeof updHud==='function')updHud();
 ttShow('ttlb',false);ttShow('ttskip',false);ttShow('tttitle',false);ttShow('ttbar',true);
 $('hud').classList.add('on');if(isTouch)TB.forEach(i=>{const el=$(i);if(el)el.style.display='flex';});
 cam.fov=75;cam.updateProjectionMatrix();
 ttSet(B,'DETECT_PLAYER');TT.stats.t0=performance.now();tStart=performance.now();
 msg('TITAN — '+TITAN_CFG.phaseNames[0],2.6);ttHudPhase(0);
 if(!isTouch&&document.pointerLockElement!==canvas)try{canvas.requestPointerLock();}catch(e){}
}

/* ---------- ATUALIZAÇÃO DO MODO ---------- */
function ttModeUpdate(dt){
 const B=TT.B;if(!B)return;
 if(TT.cine)ttCineUpdate(dt);else if(!TT.down||B.ai.state!=='INTRO')ttBossUpdate(dt);
 B.anim.update(dt);
 ttBossVisual(dt);
 ttWavesUpdate(dt);ttMeteorsUpdate(dt);ttPrisonUpdate(dt);ttArenaUpdate(dt);
 /* foguetes da bazuca acertam o corpo do golem (região mais próxima) */
 if(typeof BZ!=='undefined'&&BZ.rockets.length&&!B.dead){for(let i=BZ.rockets.length-1;i>=0;i--){const r=BZ.rockets[i],p=r.m.position;
  if(Math.hypot(p.x-B.root.position.x,p.z-B.root.position.z)<TITAN_CFG.radius+.6&&p.y<B.H){let best=null,bd=3.2;for(const m of B.e.meshes){const dd=m.position.distanceTo(p);if(dd<bd){bd=dd;best=m;}}
   scene.remove(r.m);BZ.rockets.splice(i,1);TT.hitZone=best?best.userData.ttZone:'torso';TT.hitObj=best;bzExplode(p.clone());}}}
 /* números de dano que não vieram de um tiro (explosões) */
 while(TT.pend.length)ttFlushHit(null);
 /* suprimentos periódicos */
 if(!TT.cine&&!B.dead){TT.supplyT-=dt;if(TT.supplyT<=0){TT.supplyT=TITAN_CFG.supplyEvery;if(picks.length<3){for(let i=0;i<20;i++){const a=Math.random()*6.283,r=8+Math.random()*24,x=Math.cos(a)*r,z=Math.sin(a)*r;
   if(!hitsBox(x,z,0,.8,1)&&Math.hypot(x-B.root.position.x,z-B.root.position.z)>9){dropPick(x,z);break;}}}}}
 ttfxUpdate(dt);
 if(TT.down)ttDownUpdate(dt);
 ttfxApplyShake();ttaListener();ttHudUpdate(dt);
}

/* ---------- DERROTA / VITÓRIA ---------- */
function ttPlayerDown(){
 if(TT.down)return;TT.down={t:0,x:P.x,z:P.z,y:P.y};ttPrisonClear(true);TTS.defeat();inp.fire=false;TT.lockFire=true;
 TT.stats.t1=performance.now();gun.visible=false;ttUI.fade.style.transition='opacity 2.4s';ttUI.fade.style.background='radial-gradient(ellipse at 50% 50%,rgba(60,0,0,.25),rgba(20,0,0,.9))';ttUI.fade.style.opacity='1';
}
function ttDownUpdate(dt){
 const D=TT.down;D.t+=dt;P.x=D.x;P.z=D.z;const k=ttEase(D.t/1.4);
 const G=TT.B.anchors.head.getWorldPosition(TT._v3);cam.position.set(P.x,D.y+1.6-1.25*k,P.z);cam.lookAt(G);cam.rotateZ(.55*k);
 if(D.t>3.4&&!D.shown){D.shown=true;ttShowEnd(false);}
}
function ttVictory(){TTS.victory();ttShowEnd(true);}
function ttFmt(n){return Math.round(n).toLocaleString('pt-BR');}
function ttShowEnd(win){
 const S=TT.stats,B=TT.B,secs=Math.max(0,((S.t1||performance.now())-S.t0)/1000),mm=(secs/60)|0,ss=Math.round(secs%60);
 state='end';document.exitPointerLock&&document.exitPointerLock();inp.fire=false;
 $('hud').classList.remove('on');TB.forEach(i=>{const el=$(i);if(el)el.style.display='none';});ttShow('ttbar',false);
 let reward=0,xp=0,best=null;
 if(win){const R=TITAN_CFG.reward;reward=R.money+(S.taken<30?R.noDmgBonus:0);xp=R.xp;
  if(typeof addMoney==='function')addMoney(reward);if(typeof addXP==='function')addXP(xp,'Titã');
  try{const prev=JSON.parse(localStorage.getItem('ss_titan')||'{}');if(!prev.best||secs<prev.best){prev.best=secs;}prev.wins=(prev.wins||0)+1;localStorage.setItem('ss_titan',JSON.stringify(prev));best=prev.best;}catch(e){}}
 if(typeof progOnMatchEnd==='function')progOnMatchEnd(win,{kills:win?1:0,shots,hits:hitsN,mode:'titan'});
 if(typeof PROG_S!=='undefined'){PROG_S.stats.shots=(PROG_S.stats.shots||0)+shots;PROG_S.stats.hits=(PROG_S.stats.hits||0)+hitsN;}
 store();
 ttUI.endT.textContent=win?'COLOSSUS DEFEATED':'DEFEAT';ttUI.end.classList.toggle('win',win);
 const pct=Math.round(B.hp/B.max*100);
 ttUI.endS.innerHTML=(win?'':'<div class="ttsub">O Titã ainda tem '+pct+'% da vida · Fase '+(B.phase+1)+'</div>')+
  '<table><tr><td>Tempo</td><td>'+mm+':'+String(ss).padStart(2,'0')+'</td></tr>'+
  '<tr><td>Dano recebido</td><td>'+ttFmt(S.taken)+'</td></tr><tr><td>Dano causado</td><td>'+ttFmt(S.dealt)+'</td></tr>'+
  '<tr><td>Acertos críticos</td><td>'+S.crits+'</td></tr><tr><td>Acertos em pontos fracos</td><td>'+S.weak+'</td></tr>'+
  '<tr><td>Recompensa</td><td>'+(win?'$'+ttFmt(reward)+' · '+xp+' XP'+(S.taken<30?' <small>(bônus sem dano)</small>':''):'—')+'</td></tr>'+
  (best?'<tr><td>Melhor tempo</td><td>'+((best/60)|0)+':'+String(Math.round(best%60)).padStart(2,'0')+'</td></tr>':'')+'</table>';
 ttShow('ttend',true);ttUI.fade.style.opacity='0';
}

/* ---------- HUD ---------- */
const ttUI={};
function ttShow(id,on){const el=$(id);if(el)el.classList.toggle('on',!!on);}
function ttHudWire(){
 if(ttUI.ok)return;ttUI.ok=true;
 Object.assign(ttUI,{bar:$('ttbar'),fill:$('ttfill'),trail:$('tttrail'),hpT:$('tthpt'),pct:$('ttpct'),ph:$('ttph'),tags:$('tttags'),
  prison:$('ttprison'),pf:$('ttpf'),pt:$('ttpt'),title:$('tttitle'),fade:$('ttfade'),end:$('ttend'),endT:$('ttet'),endS:$('ttes'),
  load:$('ttload'),loadTxt:$('ttloadtxt'),loadBar:$('ttloadbar'),loadBack:$('ttloadback')});
 ttUI.trailV=1;ttUI.tagList={};
 $('ttskip').addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();ttCineSkip();});
 $('ttrestart').onclick=()=>{SFX.ui();ttShow('ttend',false);resetGame();};
 $('ttmenu').onclick=()=>{SFX.ui();ttShow('ttend',false);toMenu();};
 ttUI.loadBack.onclick=()=>{ttShow('ttload',false);ttUI.loadBack.style.display='none';toMenu();};
 document.addEventListener('keydown',e=>{if(TT.cine&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();ttCineSkip();}});
}
function ttHudReset(){ttUI.trailV=1;ttUI.tagList={};ttUI.tags.innerHTML='';ttUI.fill.style.width='100%';ttUI.trail.style.width='100%';}
function ttHudPhase(n){const b=ttUI.bar;b.classList.remove('p0','p1','p2');b.classList.add('p'+n);b.classList.remove('flash');void b.offsetWidth;b.classList.add('flash');
 ttUI.ph.textContent='FASE '+['I','II','III'][n]+' · '+TITAN_CFG.phaseNames[n];}
function ttHudTag(t,d){ttUI.tagList[t]=d;}
function ttHudPrison(on,f,tl){if(!ttUI.prison)return;ttUI.prison.classList.toggle('on',!!on);if(on){ttUI.pf.style.width=Math.min(100,(f||0)*100)+'%';ttUI.pt.style.width=Math.max(0,(tl===undefined?1:tl)*100)+'%';}}
function ttHudUpdate(dt){
 const B=TT.B;if(!B||!ttUI.ok)return;const f=Math.max(0,B.hp/B.max);
 ttUI.fill.style.width=(f*100).toFixed(2)+'%';
 if(ttUI.trailV>f)ttUI.trailV=Math.max(f,ttUI.trailV-dt*.12*(ttUI.trailHold>0?0:1));else ttUI.trailV=f;
 ttUI.trail.style.width=(ttUI.trailV*100).toFixed(2)+'%';
 ttUI.hpT.textContent=ttFmt(B.hp)+' / '+ttFmt(B.max);ttUI.pct.textContent=(f*100).toFixed(1)+'%';
 const tags=[];
 if(B.exposed>0)tags.push(['NÚCLEO EXPOSTO','core']);
 if(B.ai.state==='STAGGERED')tags.push(['ATORDOADO','stag']);
 if(B.ai.state==='PHASE_TRANSITION')tags.push(['ENFURECIDO','rage']);
 if(B.weak.L>0)tags.push(['BRAÇO ESQ. FRACO','weak']);if(B.weak.R>0)tags.push(['BRAÇO DIR. FRACO','weak']);
 if(B.legSlow>0)tags.push(['LENTO','weak']);if(B.dead)tags.push(['DERROTADO','core']);
 const key=tags.map(t=>t[0]).join('|');if(key!==ttUI.tagKey){ttUI.tagKey=key;ttUI.tags.innerHTML=tags.map(t=>'<span class="'+t[1]+'">'+t[0]+'</span>').join('');}
}

/* ---------- FERRAMENTAS DE TESTE (console: __titan) ---------- */
window.__titan={
 get state(){const B=TT.B;return B?{ai:B.ai.state,sub:B.ai.sub,hp:Math.round(B.hp),max:B.max,phase:B.phase+1,exposed:+B.exposed.toFixed(2),anim:B.anim.curName,
  pos:[+B.root.position.x.toFixed(2),+B.root.position.z.toFixed(2)],player:{hp:Math.round(P.hp),x:+P.x.toFixed(2),z:+P.z.toFixed(2),y:+P.y.toFixed(2),dead:P.dead},
  prison:!!TT.prison,meteors:TT.meteors.filter(m=>m.on).length,waves:TT.waves.length,cine:!!TT.cine,stats:TT.stats,gameState:state}:null;},
 report(){return TT.asset?TT.asset.report:TT.err;},
 sim(sec,dt){dt=dt||1/60;const n=Math.round(sec/dt);for(let i=0;i<n;i++){if(state!=='play')break;update(dt);}return this.state;},
 skip(){ttCineSkip();return this.state;},
 setHp(f){const B=TT.B;B.hp=B.max*f;ttDamage(.001,'torso');return this.state;},
 damage(n,zone){TT.hitZone=zone||'torso';TT.B.e.hp-=n;return this.state;},
 force(a){const B=TT.B;ttInterrupt(B);ttStartAttack(B,a);return this.state;},
 god(on){TT.god=!!on;return TT.god;},
 hitboxes(on){if(TT.B)TT.B.hit[0].m.material.visible=!!on;return !!on;},
 tp(x,z){P.x=x;P.z=z;return this.state;},
 counts(){return {sceneChildren:scene.children.length,enemies:enemies.length,golems:enemies.filter(e=>e.golem).length,colliders:colliders.length,solids:solids.length,
  arenaInScene:!!(TTAR.g&&TTAR.g.parent),mixers:TT.B?1:0,fxInScene:!!(TTFX.root&&TTFX.root.parent)};}
};
