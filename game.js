"use strict";
/* GAME: estado, modos, HUD, menus, tela deitada, loop principal e startGame() */
let mode='monsters',mis=0,wave=0,score=0,kills=0,shots=0,hitsN=0,tStart=0,state='load',alive=0,toSpawn=0,spawnT=0,msgT=0,lastT=performance.now(),radarT=0,prevScreen='menu';
const MISSIONS=[
 {n:'Posto avançado: elimine os hostis',c:6,mix:['std','std','scout']},
 {n:'Instalação industrial: assegure a área',c:9,mix:['std','std','heavy','scout','medic']},
 {n:'Emboscada urbana: sobreviva',c:12,mix:['std','scout','scout','heavy','sniper']},
 {n:'Esquadrão de elite: derrote todos',c:10,mix:['heavy','scout','sniper','medic','std','boss']}];
const SPAWNS=[[-35,-35],[35,-30],[0,-42],[-38,20],[38,22],[-10,-8],[10,-20],[-25,0],[26,-4],[0,-20],[-12,38],[12,-30]];
const TB=['joy','fire','ads','jump','rel','swp','crh','spr','dash','flashbtn'];
const pick=a=>a[Math.floor(Math.random()*a.length)];

/* TELA DEITADA: tela cheia + trava de orientação (Chrome Android) */
function goLandscape(){
 try{
  const el=document.documentElement;
  const p=el.requestFullscreen?el.requestFullscreen():(el.webkitRequestFullscreen?el.webkitRequestFullscreen():null);
  Promise.resolve(p).then(()=>screen.orientation&&screen.orientation.lock?screen.orientation.lock('landscape'):null).catch(e=>console.warn('Orientação não travada',e));
 }catch(e){console.warn('Tela cheia indisponível',e);}
}

/* HUD */
function msg(t,d){$('msg').textContent=t;msgT=d||2.5;}
function updAmmo(){const w=ws[cw];$('ammo').innerHTML=WEAPONS[cw].name+'<br>'+(reloading>0?'RECARREGANDO…':w.mag+' / '+w.res);}
function updHud(){
 $('hpf').style.width=Math.max(0,P.hp)+'%';$('hpf').style.background=P.hp<30?'#c94a3a':'#9bc35a';
 let _obj=mode==='campaign'?'M'+(mis+1)+': '+MISSIONS[mis].n:mode==='survival'?'SOBREVIVÊNCIA  Onda '+wave:'TREINO LIVRE';
 if(typeof gmHudText==='function'){const g=gmHudText();if(g)_obj=g;}
 $('obj').textContent=_obj;
 $('en').textContent='Hostis: '+(alive+toSpawn)+'   Pontos: '+score+(typeof envTimeStr==='function'?'  · '+envTimeStr():'');updAmmo();
}
function hurt(d,from){
 if(typeof cbtHurt==='function'){cbtHurt(d,from);return;}
 if(P.dead||mode==='practice'||P.dashT>0)return; /* invulnerável durante o dash */
 P.hp-=d;$('dmg').style.opacity=1;setTimeout(()=>$('dmg').style.opacity=0,120);
 if(from){const dx=from.x-P.x,dz=from.z-P.z,cy=Math.cos(P.yaw),sy=Math.sin(P.yaw);
  $('dd').style.transform='rotate('+Math.atan2(dx*cy-dz*sy,-dx*sy-dz*cy)+'rad)';$('dd').style.opacity=1;setTimeout(()=>$('dd').style.opacity=0,500);}
 SFX.hurt();updHud();
 if(P.hp<=0){P.hp=0;P.dead=true;endGame(false);}
}

/* MODOS */
function spawnEnemy(type,passive){
 let s,t=0;do{s=pick(SPAWNS);t++;}while(Math.hypot(s[0]-P.x,s[1]-P.z)<22&&t<20);
 const e=makeEnemy(type,s[0]+(Math.random()-.5)*3,s[1]+(Math.random()-.5)*3,passive);
 rescue(e.pos,.45,1.8);alive++;return e;
}
function startMode(m){initAudio();goLandscape();if(typeof envInit==='function'&&!window.__envInited){window.__envInited=1;envInit();}if(typeof trackInit==='function')trackInit();mode=m;if(m==='campaign')mis=Math.min(save.mission,3);if(typeof setDifficulty==='function'&&save.diff)setDifficulty(save.diff);resetGame();}
function resetGame(){
 clearEnemies();picks.forEach(p=>scene.remove(p.m));picks.length=0;
 pool.forEach(m=>m.visible=false);decals.forEach(m=>m.visible=false);
 Object.assign(P,{x:0,y:0,z:38,vy:0,yaw:Math.PI,pitch:0,hp:100,armor:0,ground:true,dead:false,crouch:false});if(typeof CBT!=='undefined'){CBT.recoilV=0;CBT.recoilH=0;CBT.bloom=0;CBT.heat=0;CBT.suppress=0;}aim=false;
 WEAPONS.forEach((w,i)=>{ws[i].mag=w.mag;ws[i].res=w.res;});
 score=kills=shots=hitsN=0;alive=0;wave=0;toSpawn=0;setWeapon(0);
 if(typeof gmClear==='function')gmClear();
 if(mode==='campaign'){const m=MISSIONS[mis];toSpawn=m.c;for(let i=0;i<Math.min(3,toSpawn);i++){spawnEnemy(pick(m.mix));toSpawn--;}msg('MISSÃO '+(mis+1)+': '+m.n,3.5);}
 else if(mode==='survival')nextWave();
 else if(typeof MODES_META!=='undefined'&&MODES_META[mode]){if(typeof gmStart==='function')gmStart(mode);}
 else{for(let i=0;i<4;i++){const e=spawnEnemy(['std','heavy','scout','std'][i],true);e.pos.set(-8+i*5.3,0,22);}msg('Treino livre: alvos reaparecem, sem dano',3);}
 $('hud').classList.add('on');if(isTouch)TB.forEach(i=>$(i).style.display='flex');
 ['menu','pause','end','set','info','load','monwave'].forEach(i=>$(i).classList.remove('on'));
 if(typeof applyLoadoutPerks==='function')applyLoadoutPerks();
 state='play';tStart=performance.now();lastT=performance.now();updHud();
 if(!isTouch)try{canvas.requestPointerLock();}catch(e){}
}
function nextWave(){
 wave++;toSpawn=3+wave*2;if(wave>save.wave){save.wave=wave;store();}msg('ONDA '+wave,2.5);
 for(let i=0;i<Math.min(toSpawn,4);i++){
  let ty='std';
  if(wave>=6&&Math.random()<.12)ty='boss';
  else if(wave>=4&&Math.random()<.18)ty='sniper';
  else if(wave>=3&&Math.random()<.15)ty='medic';
  else if(wave>2&&Math.random()<.28)ty='heavy';
  else if(wave>1&&Math.random()<.35)ty='scout';
  spawnEnemy(ty);toSpawn--;
 }
 updHud();
}
function onKill(e,isHead){
 e.state='dead';alive--;kills++;score+=e.T.pts;
 if(typeof progOnKill==='function'&&mode!=='practice')progOnKill(e,!!isHead);
 if(typeof gmOnKill==='function')gmOnKill(e);
 else if(mode!=='practice'){save.xp=(save.xp||0)+e.T.pts/10;store();}
 if(Math.random()<.35)dropPick(e.pos.x,e.pos.z);
 if(mode==='practice'){alive++;kills--;
  setTimeout(()=>{scene.remove(e.g);const i=enemies.indexOf(e);if(i>=0)enemies.splice(i,1);alive--;const n=spawnEnemy(e.type,true);n.pos.set(e.pos.x,0,22);},2500);return;}
 if(toSpawn>0&&alive<4)spawnT=1.5;
 if(alive+toSpawn<=0){
  if(typeof MODES_META!=='undefined'&&MODES_META[mode]){
   if(mode==='tdm'||mode==='dom'||mode==='bomb'||mode==='hostage'){if(toSpawn<=0&&alive<=0)spawnT=1.5;}
  }else if(mode==='campaign')endGame(true);
  else if(mode==='survival'){msg('Onda concluída!',2);setTimeout(()=>{if(state==='play')nextWave();},2500);}
 }
 updHud();
}
function endGame(win){
 state='end';document.exitPointerLock&&document.exitPointerLock();
 $('hud').classList.remove('on');TB.forEach(i=>$(i).style.display='none');if(typeof ENV!=='undefined'){if(ENV.flash)ENV.flash.intensity=0;ENV.flashOn=false;if(ENV.nvOn&&typeof envToggleNV==='function'){ENV.nvOn=true;envToggleNV();}}
 const t=((performance.now()-tStart)/1000)|0,acc=shots?Math.round(hitsN/shots*100):0;
 if(score>save.hi)save.hi=score;
 if(win){SFX.win();if(mode==='campaign'&&mis>=save.mission)save.mission=Math.min(mis+1,4);}
 if(typeof PROG_S!=='undefined'){PROG_S.stats.shots=(PROG_S.stats.shots||0)+shots;PROG_S.stats.hits=(PROG_S.stats.hits||0)+hitsN;if(typeof progOnMatchEnd==='function')progOnMatchEnd(win,{kills,shots,hits:hitsN,wave,mode,missionWin:win&&mode==='campaign'});}
 store();
 let _et=win?'MISSÃO CUMPRIDA':(mode==='survival'?'FIM (Onda '+wave+')':'MISSÃO FALHOU');
 if(typeof gmEndTitle==='function'){const g=gmEndTitle(win);if(g)_et=g;}
 $('et').textContent=_et;
 $('es').innerHTML='Pontos: '+score+'<br>Eliminados: '+kills+'<br>Precisão: '+acc+'%<br>Tempo: '+t+'s<br>Nível: '+(typeof PROG_S!=='undefined'?PROG_S.level:1)+' · $'+(typeof PROG_S!=='undefined'?PROG_S.money:0)+'<br>Recorde: '+save.hi;
 $('econt').style.display=win&&mode==='campaign'&&mis<3?'block':'none';$('end').classList.add('on');
}

/* MENUS */
function show(id){['menu','pause','end','set','info','prog','monwave'].forEach(i=>{const el=$(i);if(el)el.classList.toggle('on',i===id);});}
/* Texturas, vegetação e antialias são montadas ao iniciar; se o perfil mudou, avisa para recarregar. */
function qNote(){$('qnote').textContent=(curQ()!==QI||(save.q===-1)!==SUPERLOW)?'Recarregue a página para aplicar texturas, vegetação e antialias.':'';}
function openSettings(from){prevScreen=from;$('q').value=save.q===-1?-1:curQ();qNote();$('sens').value=save.sens;$('vol').value=save.vol;if($('lp'))$('lp').value=save.lp||'auto';if($('bri'))$('bri').value=save.bri||1;show('set');}
function info(t,b){$('it').textContent=t;$('ib').innerHTML=b;show('info');}
function pauseGame(){if(state!=='play')return;state='pause';document.exitPointerLock&&document.exitPointerLock();show('pause');inp.fire=false;}
function toMenu(){
 state='menu';if(typeof gmClear==='function')gmClear();clearEnemies();$('hud').classList.remove('on');TB.forEach(i=>$(i).style.display='none');if(typeof ENV!=='undefined'){if(ENV.flash)ENV.flash.intensity=0;ENV.flashOn=false;if(ENV.nvOn&&typeof envToggleNV==='function'){ENV.nvOn=true;envToggleNV();}}
 if(typeof updateProgHUD==='function')updateProgHUD();else $('best').textContent='Recorde: '+save.hi+' | Melhor onda: '+save.wave+' | Missões: '+save.mission+'/4 | XP: '+Math.floor(save.xp);
 show('menu');
}
function wireUI(){
 document.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{SFX.ui();if(b.dataset.m==='monsters'){show('monwave');return;}startMode(b.dataset.m);}));
 if($('mwgrad'))$('mwgrad').onclick=()=>{SFX.ui();window.MON_START_WAVE=1;startMode('monsters');};
 document.querySelectorAll('[data-wave]').forEach(b=>b.addEventListener('click',()=>{SFX.ui();window.MON_START_WAVE=+b.dataset.wave;startMode('monsters');}));
 if($('mwback'))$('mwback').onclick=()=>{SFX.ui();show('menu');};
 $('bset').onclick=()=>{initAudio();SFX.ui();openSettings('menu');};
 $('psettings').onclick=()=>openSettings('pause');
 $('setback').onclick=()=>{SFX.ui();show(prevScreen);};
 $('q').onchange=e=>{save.q=+e.target.value;store();applyQuality();qNote();};
 if($('lp'))$('lp').onchange=e=>{save.lp=e.target.value;store();if(typeof gfxSetPreset==='function')gfxSetPreset(save.lp);};
 if($('bri'))$('bri').oninput=e=>{save.bri=+e.target.value;store();if(typeof gfxRefresh==='function')gfxRefresh();};
 $('sens').oninput=e=>{save.sens=+e.target.value;store();};
 $('vol').oninput=e=>{save.vol=+e.target.value;store();};
 $('bctl').onclick=()=>info('CONTROLES','<b>Toque:</b> analógico esquerdo move (empurre até o fim para correr), arraste a direita para olhar. FOGO, MIRA (zoom), PULAR, RECAR., TROCAR arma, AGACH., CORRER, ESQUIVA, DESLIZ. (correndo), ◀ ▶ inclinar, 🔦 LANTERNA.<br><b>PC:</b> WASD mover, Shift correr, Espaço pular, mouse olhar, botão esquerdo atira, botão direito mira, R recarrega, 1/2/3 ou Q trocar arma, C esquiva (ou toque duplo em A/D/S), V desliza (correndo), Ctrl esquerdo agacha, Z/X inclinar, F lanterna, N visão noturna, Esc pausa.<br>A corrida não possui limite de fôlego.<br>Tiro na cabeça causa 2,5x de dano. Barris vermelhos explodem. Caixas verdes dão vida, amarelas dão munição.');
 $('babt').onclick=()=>info('SOBRE','Operation: Shadow Strike. FPS em Three.js com arte e áudio procedurais, dividido em vários arquivos. Precisa de internet para carregar o Three.js. Progresso salvo no localStorage.');
 $('infoback').onclick=()=>show('menu');
 $('pauseb').addEventListener('pointerdown',e=>{e.stopPropagation();pauseGame();});
 $('resume').onclick=()=>{$('pause').classList.remove('on');state='play';lastT=performance.now();goLandscape();if(!isTouch)try{canvas.requestPointerLock();}catch(_){}};
 $('restart').onclick=resetGame;$('eretry').onclick=resetGame;$('tomenu').onclick=toMenu;$('emenu').onclick=toMenu;
 $('econt').onclick=()=>{mis=Math.min(3,mis+1);resetGame();};
 addEventListener('resize',applyQuality);
 addEventListener('orientationchange',()=>setTimeout(applyQuality,200));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
}

/* RADAR */
const rc=$('radar').getContext('2d');
function drawRadar(){
 rc.clearRect(0,0,90,90);const cy=Math.cos(P.yaw),sy=Math.sin(P.yaw),sc=45/40;
 rc.fillStyle='#9bc35a';rc.fillRect(43,43,4,4);
 for(const e of enemies){if(e.state==='dead')continue;
  const dx=e.pos.x-P.x,dz=e.pos.z-P.z,rx=dx*cy-dz*sy,ry=-dx*sy-dz*cy,x=45+rx*sc,y=45-ry*sc;
  if(Math.hypot(x-45,y-45)>42)continue;
  rc.fillStyle=e.state==='patrol'||e.state==='idle'?'#e0c040':'#e04030';rc.fillRect(x-2,y-2,4,4);}
}

/* LOOP PRINCIPAL */
function update(dt){
 if(msgT>0){msgT-=dt;if(msgT<=0)$('msg').textContent='';}
 updatePlayer(dt);updateWeapon(dt);
 for(const e of enemies)enemyAI(e,dt);
 if(typeof gmUpdate==='function')gmUpdate(dt);
 if(typeof envUpdate==='function')envUpdate(dt);
 for(let i=picks.length-1;i>=0;i--){const p=picks[i];p.m.rotation.y+=dt*3;
  if(Math.hypot(p.m.position.x-P.x,p.m.position.z-P.z)<1.6){
   if(p.hp)P.hp=Math.min(100,P.hp+30);else ws[cw].res+=WEAPONS[cw].mag*2;
   SFX.pick();scene.remove(p.m);picks.splice(i,1);updHud();}}
 if(spawnT>0){spawnT-=dt;
  if(spawnT<=0&&toSpawn>0&&alive<4&&state==='play'){spawnEnemy(mode==='campaign'?pick(MISSIONS[mis].mix):(wave>2&&Math.random()<.3?'heavy':'std'));toSpawn--;updHud();if(toSpawn>0)spawnT=2;}}
 else if(toSpawn>0&&alive<2&&mode!=='practice')spawnT=1;
 tickParticles(dt);
 radarT-=dt;if(radarT<=0){radarT=.1;drawRadar();}
}
function frame(now){
 requestAnimationFrame(frame);
 const dt=Math.min(.05,(now-lastT)/1000);lastT=now;
 if(state==='play'){if(innerHeight>innerWidth)pauseGame();else update(dt);}
 renderer.render(scene,cam);
}

/* INÍCIO (chamado pelo core.js depois que todos os arquivos carregam) */
function startGame(){
 buildMap();setWeapon(0);applyQuality();if(typeof gfxPostStart==='function')gfxPostStart();wireUI();toMenu();
 $('load').classList.remove('on');state='menu';
 requestAnimationFrame(frame);
 console.log('Shadow Strike pronto');
}

/* DIFF UI */
(function wireDiff(){
 function sync(){const el=$('diff');if(!el)return;el.value=typeof diffKey!=='undefined'?diffKey:(save.diff||'normal');
  el.onchange=()=>{if(typeof setDifficulty==='function')setDifficulty(el.value);};}
 document.addEventListener('DOMContentLoaded',sync);setTimeout(sync,500);
})();

/* Progress UI boot */
(function(){
 function bootProg(){if(typeof wireProgressUI==='function')wireProgressUI();if(typeof updateProgHUD==='function')updateProgHUD();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootProg);else setTimeout(bootProg,300);
})();

