"use strict";
/* TITAN — ÁUDIO PROCEDURAL (Web Audio)
   Usa o AudioContext do jogo (AC, core.js) e o volume salvo (save.vol).
   Sons do golem são posicionais (PannerNode) com o ouvinte preso à câmera.
   A explosão gravada do pacote original (SFX.boom) reforça os impactos maiores. */
const TTA={noise:null,bus:null,loops:{},lastStep:0,_lp:new THREE.Vector3(),_lf:new THREE.Vector3()};
function ttaOk(){return !!(AC&&save.vol>0&&AC.state!=='closed');}
function ttaInit(){
 if(!AC)return false;
 if(!TTA.noise){
  const n=AC.sampleRate*2,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);
  let last=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;last=(last+.02*w)/1.02;d[i]=w*.6+last*3;}
  TTA.noise=b;
 }
 if(!TTA.bus){TTA.bus=AC.createGain();TTA.bus.connect(AC.destination);}
 TTA.bus.gain.value=save.vol;
 return true;
}
/* destino: posicional (pos) ou direto */
function ttaOut(pos,ref){
 if(!pos)return TTA.bus;
 const p=AC.createPanner();p.panningModel='equalpower';p.distanceModel='inverse';p.refDistance=ref||10;p.rolloffFactor=.9;p.maxDistance=200;
 if(p.positionX){p.positionX.value=pos.x;p.positionY.value=pos.y||1;p.positionZ.value=pos.z;}else p.setPosition(pos.x,pos.y||1,pos.z);
 p.connect(TTA.bus);return p;
}
function ttaListener(){
 if(!AC||!AC.listener)return;
 const L=AC.listener;cam.getWorldPosition(TTA._lp);cam.getWorldDirection(TTA._lf);
 try{
  if(L.positionX){L.positionX.value=TTA._lp.x;L.positionY.value=TTA._lp.y;L.positionZ.value=TTA._lp.z;
   L.forwardX.value=TTA._lf.x;L.forwardY.value=TTA._lf.y;L.forwardZ.value=TTA._lf.z;L.upX.value=0;L.upY.value=1;L.upZ.value=0;}
  else{L.setPosition(TTA._lp.x,TTA._lp.y,TTA._lp.z);L.setOrientation(TTA._lf.x,TTA._lf.y,TTA._lf.z,0,1,0);}
 }catch(e){}
 if(TTA.bus)TTA.bus.gain.value=save.vol;
}
/* ruído filtrado com envelope */
function ttaNoise(o){
 if(!ttaOk()||!ttaInit())return null;
 const t=AC.currentTime+(o.delay||0),src=AC.createBufferSource();src.buffer=TTA.noise;src.loop=true;
 src.playbackRate.value=o.rate||1;
 const f=AC.createBiquadFilter();f.type=o.type||'lowpass';f.frequency.setValueAtTime(o.f0||400,t);if(o.f1)f.frequency.exponentialRampToValueAtTime(Math.max(20,o.f1),t+o.dur);f.Q.value=o.q||.7;
 const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,o.gain||.4),t+(o.att||.01));
 g.gain.exponentialRampToValueAtTime(.0001,t+o.dur);
 src.connect(f);f.connect(g);g.connect(ttaOut(o.pos,o.ref));src.start(t,Math.random()*1.5);src.stop(t+o.dur+.05);
 return {src,g,f};
}
function ttaTone(o){
 if(!ttaOk()||!ttaInit())return null;
 const t=AC.currentTime+(o.delay||0),os=AC.createOscillator();os.type=o.wave||'sine';os.frequency.setValueAtTime(o.f0,t);
 if(o.f1)os.frequency.exponentialRampToValueAtTime(Math.max(15,o.f1),t+o.dur);
 const g=AC.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,o.gain||.3),t+(o.att||.01));g.gain.exponentialRampToValueAtTime(.0001,t+o.dur);
 os.connect(g);g.connect(ttaOut(o.pos,o.ref));os.start(t);os.stop(t+o.dur+.05);return {os,g};
}
/* laço contínuo controlável (respiração do golem, carga do raio, raio) */
function ttaLoop(key,o){
 if(!ttaOk()||!ttaInit())return null;
 ttaStop(key,.05);
 const src=AC.createBufferSource();src.buffer=TTA.noise;src.loop=true;src.playbackRate.value=o.rate||1;
 const f=AC.createBiquadFilter();f.type=o.type||'lowpass';f.frequency.value=o.f||300;f.Q.value=o.q||1;
 const g=AC.createGain();g.gain.value=.0001;g.gain.setTargetAtTime(o.gain||.2,AC.currentTime,.15);
 let osc=null,og=null;
 if(o.tone){osc=AC.createOscillator();osc.type=o.wave||'sawtooth';osc.frequency.value=o.tone;og=AC.createGain();og.gain.value=o.toneGain||.08;osc.connect(og);og.connect(f);osc.start();}
 src.connect(f);f.connect(g);
 const pan=o.pos?ttaOut(o.pos,o.ref):TTA.bus;g.connect(pan);src.start();
 TTA.loops[key]={src,f,g,osc,og,pan};return TTA.loops[key];
}
function ttaLoopSet(key,gain,freq,tone,pos){
 const L=TTA.loops[key];if(!L||!AC)return;const t=AC.currentTime;
 if(gain!==undefined)L.g.gain.setTargetAtTime(Math.max(.0001,gain),t,.08);
 if(freq!==undefined)L.f.frequency.setTargetAtTime(freq,t,.08);
 if(tone!==undefined&&L.osc)L.osc.frequency.setTargetAtTime(tone,t,.08);
 if(pos&&L.pan&&L.pan.positionX){L.pan.positionX.value=pos.x;L.pan.positionY.value=pos.y;L.pan.positionZ.value=pos.z;}
}
function ttaStop(key,fade){
 const L=TTA.loops[key];if(!L)return;delete TTA.loops[key];
 try{const t=AC.currentTime;L.g.gain.setTargetAtTime(.0001,t,fade||.12);L.src.stop(t+(fade||.12)*5);if(L.osc)L.osc.stop(t+(fade||.12)*5);}catch(e){}
}
function ttaStopAll(){for(const k in TTA.loops)ttaStop(k,.05);}

/* ---------- BIBLIOTECA DE SONS ---------- */
const TTS={
 step(pos,k){const now=performance.now();if(now-TTA.lastStep<180)return;TTA.lastStep=now;
  ttaTone({f0:70,f1:32,dur:.35,gain:.45*(k||1),wave:'sine',pos,ref:14});ttaNoise({f0:260,f1:60,dur:.3,gain:.25*(k||1),pos,ref:14});},
 crack(pos,k){for(let i=0;i<3;i++)ttaNoise({type:'bandpass',f0:1800+Math.random()*1500,f1:600,q:2,dur:.07+Math.random()*.05,gain:.22*(k||1),delay:i*.045+Math.random()*.03,pos});},
 impact(pos,k){k=k||1;ttaTone({f0:90,f1:24,dur:1.1,gain:.7*k,pos,ref:18});ttaNoise({f0:900,f1:50,dur:1.2,gain:.6*k,pos,ref:18});
  ttaNoise({type:'bandpass',f0:2500,f1:400,q:1.2,dur:.35,gain:.3*k,pos});if(k>.7&&typeof SFX!=='undefined')SFX.boom();},
 quake(dur){ttaNoise({f0:120,f1:40,dur:dur||2.5,gain:.5,att:.3});ttaTone({f0:38,f1:28,dur:dur||2.5,gain:.35,att:.3});},
 rockBreak(pos,k){ttaNoise({f0:1400,f1:120,dur:.6,gain:.45*(k||1),pos});TTS.crack(pos,k);ttaTone({f0:120,f1:40,dur:.4,gain:.3*(k||1),pos});},
 meteorWhistle(pos,dur){ttaTone({f0:1400,f1:180,dur:dur||1.6,gain:.12,wave:'triangle',pos,ref:16,att:.2});ttaNoise({type:'bandpass',f0:3000,f1:500,q:3,dur:dur||1.6,gain:.15,att:.3,pos,ref:16});},
 explosion(pos,k){TTS.impact(pos,k||1);ttaNoise({f0:3000,f1:200,dur:.5,gain:.4*(k||1),pos});},
 prisonForm(pos){ttaNoise({f0:200,f1:1200,dur:.9,gain:.5,att:.2,pos});TTS.crack(pos,1.2);ttaTone({f0:55,f1:110,dur:.9,gain:.3,wave:'sawtooth',pos});},
 prisonBreak(pos){TTS.rockBreak(pos,1.3);ttaTone({f0:500,f1:1200,dur:.25,gain:.15,wave:'triangle'});},
 roar(pos,k){k=k||1;ttaTone({f0:95,f1:55,dur:2.2,gain:.42*k,wave:'sawtooth',att:.25,pos,ref:22});ttaTone({f0:142,f1:70,dur:2.2,gain:.22*k,wave:'square',att:.3,pos,ref:22});
  ttaNoise({type:'bandpass',f0:500,f1:180,q:1.5,dur:2.3,gain:.5*k,att:.2,pos,ref:22});},
 chargeRoar(pos){TTS.roar(pos,.8);ttaNoise({f0:300,f1:80,dur:2.5,gain:.35,att:.6,pos});},
 swing(pos){ttaNoise({type:'bandpass',f0:300,f1:1200,q:1,dur:.45,gain:.35,att:.2,pos});},
 stagger(pos){TTS.crack(pos,1.5);ttaTone({f0:80,f1:40,dur:1.2,gain:.4,wave:'sawtooth',pos});},
 weak(){ttaTone({f0:1200,f1:1800,dur:.12,gain:.12,wave:'triangle'});},
 crit(){ttaTone({f0:1500,f1:2400,dur:.1,gain:.14,wave:'square'});ttaTone({f0:900,dur:.18,gain:.1,wave:'triangle',delay:.05});},
 coreHit(){ttaTone({f0:700,f1:1400,dur:.25,gain:.18,wave:'sine'});ttaTone({f0:1400,f1:2800,dur:.2,gain:.08,wave:'triangle'});},
 phase(){TTS.quake(3);ttaTone({f0:55,f1:41,dur:3,gain:.5,att:.4,wave:'sawtooth'});[220,277,330,440].forEach((f,i)=>ttaTone({f0:f,dur:2.6,gain:.06,att:.5,delay:i*.08}));},
 death(pos){TTS.roar(pos,1.2);for(let i=0;i<10;i++)setTimeout(()=>TTS.rockBreak(pos,1),400+i*260);},
 victory(){[392,494,587,784].forEach((f,i)=>ttaTone({f0:f,dur:1.8-i*.2,gain:.14,att:.03,delay:i*.18,wave:'triangle'}));ttaTone({f0:196,dur:2.6,gain:.12,att:.1,delay:.7});},
 defeat(){[330,262,196].forEach((f,i)=>ttaTone({f0:f,f1:f*.8,dur:1.2,gain:.12,delay:i*.35,wave:'triangle'}));},
 alarm(){ttaTone({f0:880,dur:.1,gain:.08,wave:'square'});ttaTone({f0:660,dur:.12,gain:.08,wave:'square',delay:.12});}
};
