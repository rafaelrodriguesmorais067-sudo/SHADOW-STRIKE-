"use strict";
/* CORE: utilidades, erro, save, áudio e carregador dos demais arquivos */
const $=id=>document.getElementById(id);
function fail(m){console.error(m);$('loadmsg').textContent='Erro: '+m;$('retry').style.display='inline-block';$('load').classList.add('on');}
window.addEventListener('error',e=>fail((e.message||'erro desconhecido')+(e.filename?' ['+e.filename.split('/').pop()+':'+e.lineno+']':'')));

/* SAVE */
const DEF={sens:4,vol:.6,q:1,lp:'auto',bri:1,hi:0,wave:0,mission:0,xp:0,diff:'normal',level:1,money:200,monWave:0};
let save=Object.assign({},DEF);
try{
 const s=JSON.parse(localStorage.getItem('ss_save')||'{}');
 for(const k in DEF){
  if(typeof DEF[k]==='number'&&typeof s[k]==='number'&&isFinite(s[k]))save[k]=s[k];
  else if(typeof s[k]==='string')save[k]=s[k];
 }
 // complex fields kept as-is for progress.js
 /* v14: perfil automático na primeira execução (celular = MÉDIA, desktop = ALTA) */
 if(typeof s.q!=='number'){const mob=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||('ontouchstart' in window&&innerWidth<1100);
  const cores=navigator.hardwareConcurrency||4,mem=navigator.deviceMemory||4;save.q=mob?((cores>=8&&mem>=6)?2:1):(cores>=6?2:1);}
 ['unlocked','ownedFlags','stats','ach','daily','medkits','loadout'].forEach(k=>{if(s[k]!==undefined)save[k]=s[k];});
}catch(e){console.warn('Save resetado',e);}
function store(){try{localStorage.setItem('ss_save',JSON.stringify(save));}catch(e){console.warn('Falha ao salvar',e);}}

/* ÁUDIO: sons reais do pacote military_sfx + fallback procedural */
let AC=null;
const BUF={};
const SFX_PATHS={
  shot:['sounds/assault_rifles/ar/ar_single_near_01.wav','sounds/assault_rifles/ar/ar_single_near_02.wav'],
  pistol:['sounds/pistols/pi_hand/pi_hand_single_near_01.wav'],
  shotgun:['sounds/shotguns/sg/sg_single_near_01.wav'],
  sniper:['sounds/sniper_rifles/sr/sr_single_near_03.wav','sounds/sniper_rifles/sr/sr_single_near_04.wav'],
  boom:['sounds/explosions/fx_exp/fx_exp_single_near_01.wav'],
  foot:['sounds/movement/foot_short1.wav','sounds/movement/foot_short2.wav','sounds/movement/foot_short3.wav'],
  scrape:['sounds/movement/scrape1.wav','sounds/movement/scrape2.wav','sounds/movement/scrape3.wav'],
  cloth:['sounds/movement/cloth_soft.wav','sounds/movement/leather_soft.wav']
};
function initAudio(){
  if(AC)return;
  try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){console.warn('Áudio off',e);return;}
  if(AC.state==='suspended')AC.resume();
  for(const k in SFX_PATHS){
    SFX_PATHS[k].forEach(url=>{
      if(BUF[url]!==undefined)return;
      BUF[url]=null;
      fetch(url).then(r=>r.arrayBuffer()).then(ab=>AC.decodeAudioData(ab)).then(b=>{BUF[url]=b;}).catch(e=>console.warn('SFX load fail',url,e));
    });
  }
}
function playBuf(urls,gain=1){
  if(!AC||save.vol<=0||!urls||!urls.length)return false;
  const ready=urls.filter(u=>BUF[u]);
  if(!ready.length)return false;
  try{
    const url=ready[Math.floor(Math.random()*ready.length)];
    const src=AC.createBufferSource();
    const g=AC.createGain();
    src.buffer=BUF[url];
    g.gain.value=Math.min(1,gain)*save.vol;
    src.connect(g);g.connect(AC.destination);
    src.start(0);
    return true;
  }catch(e){return false;}
}
function snd(f,d,t,g,sl){if(!AC||save.vol<=0)return;try{const o=AC.createOscillator(),v=AC.createGain();o.type=t||'square';o.frequency.value=f;if(sl)o.frequency.exponentialRampToValueAtTime(Math.max(20,sl),AC.currentTime+d);v.gain.value=(g||.2)*save.vol;v.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d);o.connect(v);v.connect(AC.destination);o.start();o.stop(AC.currentTime+d);}catch(e){}}
const SFX={
  shot:()=>{if(!playBuf(SFX_PATHS.shot,0.85))snd(220,.12,'sawtooth',.3,60);},
  pistol:()=>{if(!playBuf(SFX_PATHS.pistol,0.9))snd(320,.1,'square',.25,90);},
  shotgun:()=>{if(!playBuf(SFX_PATHS.shotgun,0.95))snd(140,.25,'sawtooth',.4,40);},
  sniper:()=>{if(!playBuf(SFX_PATHS.sniper,0.9))snd(180,.18,'sawtooth',.35,50);},
  boom:()=>{if(!playBuf(SFX_PATHS.boom,1))snd(80,.6,'sawtooth',.5,25);},
  foot:()=>{if(!playBuf(SFX_PATHS.foot,0.28))snd(180,.04,'triangle',.08);},
  scrape:()=>{if(!playBuf(SFX_PATHS.scrape,0.22))snd(90,.12,'sawtooth',.1,40);},
  cloth:()=>{if(!playBuf(SFX_PATHS.cloth,0.18))snd(220,.05,'triangle',.07);},
  reload:()=>{snd(500,.05,'square',.15);setTimeout(()=>snd(380,.07,'square',.15),300)},
  hit:()=>snd(900,.06,'triangle',.2),
  enemy:()=>snd(180,.1,'square',.12,80),
  hurt:()=>snd(100,.2,'sawtooth',.3,50),
  ui:()=>snd(600,.05,'square',.1),
  win:()=>{snd(500,.2,'sine',.25);setTimeout(()=>snd(750,.3,'sine',.25),200)},
  empty:()=>snd(1000,.03,'square',.1),
  jump:()=>snd(260,.1,'sine',.1,400),
  pick:()=>snd(800,.12,'sine',.2,1200)
};

/* CARREGADOR: carrega os arquivos em ordem e avisa qual está faltando.
   IMPORTANTE: movement.js carrega antes de assist.js; assist.js deve ser o último. */
const GAME_FILES=['js/engine.js','js/soldier.js','js/models.js','js/weaponpack.js','js/swatdata.js','js/swat.js','js/world.js','js/weapons.js','js/combat.js','js/player.js','js/enemies.js','js/progress.js','js/modes.js','js/monsters.js','js/bazooka.js','js/immersion.js','js/tracks.js','js/vegetation.js','js/graphics.js','js/game.js','js/movement.js','js/assist.js','js/mobileperf.js','js/monpowers.js','js/monpowers2.js','js/monpowers3.js','js/titan_config.js','js/titan_anim.js','js/titan_audio.js','js/titan_fx.js','js/titan_arena.js','js/titan_boss.js','js/titan_mode.js','js/modesel_data.js','js/modesel.js','js/forest.js','js/monai.js','js/modeaccess.js'];
function loadScripts(list,done){let i=0;(function next(){if(i>=list.length){done();return;}
 const s=document.createElement('script');s.src=list[i];
 s.onload=()=>{i++;next();};
 s.onerror=()=>fail('Arquivo não encontrado: '+list[i]+' (confira a pasta js/ e o nome do arquivo)');
 document.body.appendChild(s);})();}

(function boot(){
 if(window.__ss)return;window.__ss=1;
 if(typeof THREE==='undefined'){fail('Three.js não carregou. É preciso internet (CDN).');return;}
 try{const t=document.createElement('canvas');if(!(t.getContext('webgl')||t.getContext('experimental-webgl')))throw 0;}catch(e){fail('WebGL indisponível neste navegador.');return;}
 setTimeout(()=>{if(!window.__ready)fail('Tempo esgotado ao iniciar. Verifique a internet e os arquivos.');},45000);
 loadScripts(GAME_FILES,()=>{try{startGame();window.__ready=true;}catch(err){console.error(err);fail('Erro de inicialização: '+err.message);}});
})();
