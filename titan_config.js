"use strict";
/* TITAN: THE ANCIENT COLOSSUS — CONFIGURAÇÃO
   Todos os números do encontro ficam aqui (vida, multiplicadores, dano, recargas, fases).
   Dano ao jogador é em pontos de vida (jogador = 100) e é multiplicado pela dificuldade. */
const TITAN_CFG={
 model:'models/boss/stone-golem.glb',
 height:8.6,                 /* altura do golem em metros (o GLB tem 2,8 m) */
 radius:2.3,                 /* raio do corpo para colisão */
 hp:11000,                   /* era 15000 — luta mais curta */
 name:'TITAN',subtitle:'THE ANCIENT COLOSSUS',
 phase2At:.65,phase3At:.30,
 phaseNames:['AWAKENING OF THE COLOSSUS','ANCIENT FURY','ABSOLUTE DESTRUCTION'],
 /* pontos fracos: multiplicador de dano por região */
 zones:{
  head:{mul:2.0,label:'CABEÇA'},
  core:{mul:2.5,closedMul:.6,label:'NÚCLEO'},
  armL:{mul:1.5,label:'BRAÇO ESQ.'},
  armR:{mul:1.5,label:'BRAÇO DIR.'},
  legL:{mul:1.3,label:'PERNA ESQ.'},
  legR:{mul:1.3,label:'PERNA DIR.'},
  torso:{mul:1.0,label:'CORPO'}
 },
 critMul:2.0,                /* acertos com multiplicador >= este valor contam como CRÍTICO */
 headStagger:{dmg:650,window:5,dur:1.7,cd:9},     /* dano na cabeça em 5 s causa atordoamento curto */
 armWeak:{dmg:1300,dur:18,mul:.6},                /* braço "quebrado": golpes desse braço causam 60% */
 legSlow:{dmg:1000,dur:8,mul:.55},                /* pernas: lentidão temporária */
 exposeTime:6,             /* janela do núcleo exposto após atordoamento */
 phaseShield:.1,             /* dano recebido durante a transição de fase */
 /* movimento (m/s) */
 walkSpeed:2.7,runSpeed:5.4,turnRate:1.6,
 speedMul:[1,1.12,1.25],
 cdMul:[1,.86,.74],          /* recargas por fase */
 recover:[2.1,1.6,1.15],      /* respiro entre ataques por fase (s) */
 comboChance:[0,.25,.4],
 dmgMul:[1,1.05,1.12],
 /* habilidades */
 melee:{range:8.5,dmg:18,arc:.35,cd:4,stompR:6.5,stompDmg:13},
 smash:{cd:9,reach:5.5,inner:4,innerDmg:20,waveDmg:12,maxR:[15,18,22],speed:15,width:1.6,jumpClear:.75,doubleWave:2},
 meteor:{cd:15,count:[4,5,7],radius:3.4,dmg:15,warn:2.1,spread:9,volleys:[1,1,1],from:2},
 prison:{cd:24,ring:1.9,dmg:25,time:5.5,need:[8,8,9],dashValue:3,from:2},
 charge:{cd:12,windup:1.5,speed:21,maxT:2.4,dmg:22,push:7,stagger:5,homing:[0,.1,.3]},
 beam:{cd:20,charge:3.6,fire:2.4,dps:28,tick:.2,width:1.25,range:90,track:[.55,.55,.85],from:3,vent:3},
 /* arena */
 arenaR:38,
 supplyEvery:18,             /* caixas de vida/munição */
 reward:{money:2500,xp:1500,noDmgBonus:1500}
};
const TITAN_DIFF={easy:{dmg:.65,hp:.85},normal:{dmg:1,hp:1},hard:{dmg:1.3,hp:1.15},extreme:{dmg:1.6,hp:1.3}};
