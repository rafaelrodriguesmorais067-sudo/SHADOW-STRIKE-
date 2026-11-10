"use strict";
/* v24: OTIMIZAÇÃO PARA CELULAR — mantém o visual do Ultra e corta o custo invisível.
   - resolução limitada a 1.5x (tela do celular já é densa) com ajuste dinâmico mais rápido
   - sombras do sol recalculadas em dias alternados de quadro (sol quase não se move)
   - sombra da lanterna desligada no celular (a mais cara, quase imperceptível)
   - pausa o desenho quando a aba fica escondida */
(function(){
 if(typeof MOBP==='undefined'||!MOBP)return;
 QT.pr[3]=Math.min(QT.pr[3],1.5);QT.pr[2]=Math.min(QT.pr[2],1.25);
 const _aq=applyQuality;
 applyQuality=function(){
  _aq();
  if(save.q!==-1&&sun.shadow.mapSize.x>2048){sun.shadow.mapSize.set(2048,2048);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
  if(typeof ENV!=='undefined'&&ENV.flash)ENV.flash.castShadow=false;
 };
 /* resolução dinâmica: alvo de 45 fps, desce até 0.55 */
 gDynRes=function(dt){
  GFX.fpsAvg+=(1/Math.max(dt,.001)-GFX.fpsAvg)*.08;GFX.dynT+=dt;
  if(GFX.dynT<1.5)return;GFX.dynT=0;
  const old=GFX.dyn;
  if(GFX.fpsAvg<40&&GFX.dyn>.55)GFX.dyn=Math.max(.55,GFX.dyn-.1);
  else if(GFX.fpsAvg>55&&GFX.dyn<1)GFX.dyn=Math.min(1,GFX.dyn+.05);
  if(old!==GFX.dyn)applyQuality();
 };
 /* sombras a cada 2 quadros */
 renderer.shadowMap.autoUpdate=false;
 let fr=0;const _r=renderer.render.bind(renderer);
 renderer.render=function(sc,cm){
  if(sc===scene){fr++;if(fr%2===0||renderer.shadowMap.needsUpdate)renderer.shadowMap.needsUpdate=true;}
  if(typeof ENV!=='undefined'&&ENV.flash&&ENV.flash.castShadow)ENV.flash.castShadow=false;
  if(document.hidden)return;
  _r(sc,cm);
 };
 renderer.shadowMap.needsUpdate=true;
 applyQuality();
 console.log('Mobile perf v24 ativo');
})();
