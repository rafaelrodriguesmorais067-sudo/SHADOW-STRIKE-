"use strict";
/* SELEÇÃO DE MODO — TELA E INTEGRAÇÃO
   Tela própria (#modesel) entre o MENU PRINCIPAL e o jogo. Não substitui nenhum sistema:
   - JOGAR chama o startMode() original (que chama resetGame() → gmStart()).
   - CONTRA MONSTROS abre a tela original de ondas (#monwave).
   - Envolve show/startMode/toMenu/startGame/renderer.render, como os módulos do Titã fazem.
   Dados dos modos: modesel_data.js. Estilo: modesel.css. */

const MS={on:false,built:false,wired:false,tab:'featured',sel:'titan',busy:false,modal:false,cards:{},bgFlip:0,bgArt:'',raf:0,el:{}};

function msHexRgb(h){const n=parseInt(h.slice(1),16);return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255);}
function msEl(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
function msPips(d){let s='<span class="ms-pips" aria-label="Nível '+d+' de 5">';for(let i=1;i<=5;i++)s+='<i'+(i<=d?' class="on"':'')+'></i>';return s+'</span>';}

/* Sons curtos de interface pelo sintetizador do jogo (snd em core.js usa save.vol; nada fica tocando). */
function msSfx(k){
 if(typeof snd!=='function'||!AC)return;
 if(k==='sel'){snd(880,.045,'triangle',.08);setTimeout(()=>snd(1320,.04,'sine',.05),28);}
 else if(k==='tab'){snd(420,.06,'square',.05,620);}
 else if(k==='ok'){snd(540,.08,'sine',.12);setTimeout(()=>snd(810,.1,'sine',.1),70);}
 else if(k==='back'){snd(520,.06,'triangle',.07,300);}
 else if(k==='go'){snd(200,.38,'sawtooth',.09,900);setTimeout(()=>snd(660,.22,'sine',.12),120);}
}
function msAudio(){try{initAudio();if(AC&&AC.state==='suspended')AC.resume();}catch(e){}}

/* Progresso salvo exibido nos cards (somente leitura). */
function msRecord(id){
 if(typeof save==='undefined')return '';
 if(id==='campaign')return 'MISSÕES '+Math.min(save.mission||0,4)+'/4';
 if(id==='survival')return save.wave?'RECORDE: ONDA '+save.wave:'';
 if(id==='monsters')return save.monWave?'RECORDE: ONDA '+save.monWave+'/10':'';
 return '';
}

/* ---------- CONSTRUÇÃO (uma vez) ---------- */
function msCard(id){
 const m=MS_MODES[id],c=msEl('button','ms-card');
 c.type='button';c.dataset.mode=id;c.setAttribute('role','option');c.setAttribute('aria-selected','false');
 c.setAttribute('aria-label',m.title+(m.title2?' '+m.title2:'')+'. '+m.desc);
 c.style.setProperty('--c',m.accent);c.style.setProperty('--c-rgb',msHexRgb(m.accent));
 const eager=MS_TABS.featured.big.includes(id);
 c.innerHTML='<span class="ms-art"><img alt="" decoding="async" '+(eager?'':'loading="lazy" ')+'src="'+m.art+'"'+(m.artPos?' style="object-position:'+m.artPos+'"':'')+'></span>'+
  '<span class="ms-shade"></span><span class="ms-shine"></span>'+
  '<span class="ms-head"><em class="ms-cat">'+m.cat+'</em>'+(m.tag?'<em class="ms-tag">'+m.tag+'</em>':'')+'</span>'+
  '<span class="ms-check" aria-hidden="true">✓</span>'+
  '<span class="ms-body"><small class="ms-sub">'+m.sub+'</small><b class="ms-title">'+m.title+(m.title2?'<span class="ms-title2">'+m.title2+'</span>':'')+'</b>'+
  '<span class="ms-desc">'+m.desc+'</span>'+
  '<span class="ms-meta">'+msPips(m.diff)+'<span class="ms-pl">'+m.players+' · '+m.time+'</span><span class="ms-rec"></span></span></span>'+
  '<span class="ms-frame"></span>';
 return c;
}
function msBuild(){
 if(MS.built)return;MS.built=true;
 const R=$('modesel'),E=MS.el;
 Object.assign(E,{root:R,bgA:R.querySelector('.ms-bgA'),bgB:R.querySelector('.ms-bgB'),fx:R.querySelector('.ms-fx'),tabs:R.querySelector('.ms-tabs'),
  track:R.querySelector('.ms-track'),rail:R.querySelector('.ms-rail'),feat:R.querySelector('.ms-feat'),grid:R.querySelector('.ms-grid'),
  arrL:R.querySelector('.ms-arr.l'),arrR:R.querySelector('.ms-arr.r'),sel:R.querySelector('.ms-sel'),selThumb:R.querySelector('.ms-sel-thumb'),
  selMeta:R.querySelector('.ms-sel-meta'),selTitle:R.querySelector('.ms-sel-title'),selDesc:R.querySelector('.ms-sel-desc'),
  play:R.querySelector('.ms-play'),diff:R.querySelector('.ms-diffb'),modal:R.querySelector('.ms-modal')});
 MS_CATS.forEach(c=>{const b=msEl('button','ms-tab','<span class="l">'+c.label+'</span><span class="s">'+c.short+'</span>');b.type='button';b.dataset.tab=c.id;b.setAttribute('role','tab');E.tabs.appendChild(b);});
 E.tabBar=msEl('i','ms-tabbar');E.tabs.appendChild(E.tabBar);
 for(const id in MS_MODES)MS.cards[id]=msCard(id);
 /* brasas: poucas, só transform/opacity, e param sozinhas quando a tela está oculta */
 for(let i=0;i<14;i++){const p=msEl('i');p.style.cssText='--x:'+(Math.random()*100).toFixed(1)+'%;--s:'+(2+Math.random()*3).toFixed(1)+'px;--d:'+(9+Math.random()*9).toFixed(1)+'s;--dl:-'+(Math.random()*16).toFixed(1)+'s;--dx:'+((Math.random()-.5)*120).toFixed(0)+'px';E.fx.appendChild(p);}
 /* eventos (delegados; registrados uma única vez) */
 E.tabs.addEventListener('click',e=>{const b=e.target.closest('.ms-tab');if(!b)return;msAudio();msSetTab(b.dataset.tab,true);});
 E.rail.addEventListener('click',e=>{const c=e.target.closest('.ms-card');if(!c)return;msAudio();msSelect(c.dataset.mode,true);});
 E.rail.addEventListener('dblclick',e=>{const c=e.target.closest('.ms-card');if(c&&matchMedia('(hover:hover)').matches)msPlay();});
 E.play.addEventListener('click',()=>{msAudio();msPlay();});
 R.querySelector('.ms-back').addEventListener('click',()=>{msAudio();msBack();});
 R.querySelector('.ms-close').addEventListener('click',()=>{msAudio();msBack();});
 R.querySelector('.ms-info').addEventListener('click',()=>{msAudio();msModal(true);});
 E.diff.addEventListener('click',()=>{msAudio();msCycleDiff();});
 E.modal.addEventListener('click',e=>{if(e.target===E.modal||e.target.closest('.ms-dclose')){msModal(false);msSfx('back');}else if(e.target.closest('.ms-dplay'))msPlay();});
 E.arrL.addEventListener('click',()=>msScrollBy(-1));E.arrR.addEventListener('click',()=>msScrollBy(1));
 E.track.addEventListener('scroll',msArrowsSoon,{passive:true});
 E.track.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&E.track.scrollWidth>E.track.clientWidth){E.track.scrollLeft+=e.deltaY;e.preventDefault();}},{passive:false});
 addEventListener('resize',msLayoutSoon);addEventListener('orientationchange',()=>setTimeout(msLayout,250));
 document.addEventListener('keydown',msKey);
}

/* ---------- ABAS ---------- */
function msTabHas(tab,id){const T=MS_TABS[tab];return !!T&&(T.big.includes(id)||T.small.includes(id));}
function msSetTab(tab,user){
 if(!MS_TABS[tab])tab='featured';
 const E=MS.el,T=MS_TABS[tab],changed=tab!==MS.tab;MS.tab=tab;
 E.feat.textContent='';E.grid.textContent='';
 T.big.forEach((id,i)=>{const c=MS.cards[id];c.classList.add('big');c.style.setProperty('--i',i);E.feat.appendChild(c);});
 T.small.forEach((id,i)=>{const c=MS.cards[id];c.classList.remove('big');c.style.setProperty('--i',i+T.big.length);E.grid.appendChild(c);});
 E.grid.style.display=T.small.length?'':'none';
 E.track.classList.remove('swap');void E.track.offsetWidth;E.track.classList.add('swap');
 E.track.style.scrollBehavior='auto';E.track.scrollLeft=0;E.track.style.scrollBehavior='';
 E.tabs.querySelectorAll('.ms-tab').forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false');});
 msTabBar();
 if(user&&changed)msSfx('tab');
 msSelect(msTabHas(tab,MS.sel)?MS.sel:T.big[0],false);
 msArrowsSoon();
}
function msTabBar(){const E=MS.el,b=E.tabs&&E.tabs.querySelector('.ms-tab.on');if(!b)return;E.tabBar.style.width=b.offsetWidth+'px';E.tabBar.style.transform='translateX('+b.offsetLeft+'px)';}
function msTabStep(d){const i=MS_CATS.findIndex(c=>c.id===MS.tab);msSetTab(MS_CATS[(i+d+MS_CATS.length)%MS_CATS.length].id,true);}

/* ---------- SELEÇÃO ---------- */
function msSelect(id,user){
 const m=MS_MODES[id];if(!m)return;const E=MS.el;
 const prev=MS.cards[MS.sel];if(prev&&prev.dataset.mode!==id){prev.classList.remove('sel','pop');prev.setAttribute('aria-selected','false');}
 const same=MS.sel===id&&MS.cards[id].classList.contains('sel');
 MS.sel=id;const c=MS.cards[id];c.classList.add('sel');c.setAttribute('aria-selected','true');
 if(!same||user){c.classList.remove('pop');void c.offsetWidth;c.classList.add('pop');}
 E.rail.classList.add('has-sel');
 E.root.style.setProperty('--acc',m.accent);E.root.style.setProperty('--acc-rgb',msHexRgb(m.accent));
 /* painel de informação (fade) */
 E.selThumb.style.backgroundImage='url("'+m.art+'")';
 E.selMeta.innerHTML='<em>'+m.cat+'</em> '+msPips(m.diff)+' <span>'+m.players+' · '+m.time+'</span>';
 E.selTitle.textContent=m.title+(m.title2?' — '+m.title2:'');E.selDesc.textContent=m.desc;
 E.sel.classList.remove('in');void E.sel.offsetWidth;E.sel.classList.add('in');
 E.play.disabled=false;E.play.querySelector('.ms-play-l').textContent=m.flow==='monwave'?'ESCOLHER ONDA':'JOGAR';
 msBg(m.art);
 if(user){if(!same)msSfx('sel');c.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});}
 if(MS.modal)msFillModal();
}
function msBg(art){
 if(MS.bgArt===art)return;MS.bgArt=art;const E=MS.el;MS.bgFlip^=1;
 const on=MS.bgFlip?E.bgB:E.bgA,off=MS.bgFlip?E.bgA:E.bgB;
 on.style.backgroundImage='url("'+art+'")';on.classList.add('on');off.classList.remove('on');
}
function msVisible(){const T=MS_TABS[MS.tab];return T.big.concat(T.small);}
/* navegação espacial pelo teclado: escolhe o card mais próximo na direção pedida */
function msMove(dx,dy){
 const cur=MS.cards[MS.sel].getBoundingClientRect(),cx=cur.left+cur.width/2,cy=cur.top+cur.height/2;
 let best=null,bd=1e9;
 for(const id of msVisible()){if(id===MS.sel)continue;const r=MS.cards[id].getBoundingClientRect(),x=r.left+r.width/2-cx,y=r.top+r.height/2-cy;
  const along=x*dx+y*dy;if(along<=4)continue;const side=Math.abs(x*dy)+Math.abs(y*dx);const d=along+side*2.2;if(d<bd){bd=d;best=id;}}
 if(best)msSelect(best,true);
}

/* ---------- JOGAR / VOLTAR ---------- */
function msPlay(){
 if(MS.busy||!MS.on)return;const id=MS.sel,m=MS_MODES[id];if(!m)return;
 msAudio();try{localStorage.setItem('ss_lastmode',id);}catch(e){}
 if(m.flow==='monwave'){msSfx('ok');show('monwave');return;}  /* fluxo original de CONTRA MONSTROS */
 MS.busy=true;msSfx('go');
 setTimeout(()=>{MS.busy=false;},800);
 startMode(id);                                              /* startMode → resetGame → gmStart (original) */
}
function msBack(){if(MS.modal){msModal(false);msSfx('back');return;}msSfx('back');show('menu');if(typeof updateProgHUD==='function')updateProgHUD();}
function msOpen(sel){
 msBuild();MS.busy=false;
 if(sel&&MS_MODES[sel])MS.sel=sel;
 for(const id in MS.cards){const r=msRecord(id),el=MS.cards[id].querySelector('.ms-rec');el.textContent=r;el.style.display=r?'':'none';}
 msDiffLabel();
 show('modesel');
 msLayout();
 msSetTab(msTabHas(MS.tab,MS.sel)?MS.tab:(MS_TABS.featured.big.includes(MS.sel)||MS_TABS.featured.small.includes(MS.sel)?'featured':MS_CATS.find(c=>msTabHas(c.id,MS.sel)).id),false);
 requestAnimationFrame(()=>{msLayout();const c=MS.cards[MS.sel];if(c)c.scrollIntoView({block:'nearest',inline:'nearest'});});
}

/* ---------- DIFICULDADE (usa o setDifficulty original) ---------- */
const MS_DKEYS=['easy','normal','hard','extreme'],MS_DLBL={easy:'FÁCIL',normal:'NORMAL',hard:'DIFÍCIL',extreme:'EXTREMO'};
function msDiffKey(){return typeof diffKey!=='undefined'?diffKey:(save.diff||'normal');}
function msDiffLabel(){const E=MS.el;if(E.diff)E.diff.innerHTML='<small>DIFICULDADE</small><b>'+(MS_DLBL[msDiffKey()]||'NORMAL')+'</b>';}
function msCycleDiff(){
 const k=MS_DKEYS[(MS_DKEYS.indexOf(msDiffKey())+1)%MS_DKEYS.length];
 if(typeof setDifficulty==='function')setDifficulty(k);else{save.diff=k;store();}
 const s=$('diff');if(s)s.value=k;msDiffLabel();msSfx('tab');
}

/* ---------- DETALHES ---------- */
function msFillModal(){
 const m=MS_MODES[MS.sel],E=MS.el,d=E.modal,rec=msRecord(MS.sel);
 d.querySelector('.ms-dart').style.backgroundImage='url("'+m.art+'")';
 d.querySelector('.ms-dcat').textContent=m.cat+(m.tag?' · '+m.tag:'');
 d.querySelector('.ms-dtitle').textContent=m.title+(m.title2?' — '+m.title2:'');
 d.querySelector('.ms-dlong').textContent=m.long;
 d.querySelector('.ms-dobj').innerHTML=m.obj.map(o=>'<li>'+o+'</li>').join('');
 d.querySelector('.ms-dtips').innerHTML=(m.tips||[]).map(o=>'<li>'+o+'</li>').join('');
 d.querySelector('.ms-dstats').innerHTML='<span><small>NÍVEL</small>'+msPips(m.diff)+' '+MS_DIFF[m.diff]+'</span><span><small>JOGADORES</small>'+m.players+'</span><span><small>DURAÇÃO</small>'+m.time+'</span>'+(rec?'<span><small>PROGRESSO</small>'+rec+'</span>':'');
 d.querySelector('.ms-dplay').textContent=m.flow==='monwave'?'ESCOLHER ONDA ▶':'JOGAR ▶';
}
function msModal(on){
 const d=MS.el.modal;if(!d)return;MS.modal=!!on;
 if(on){msFillModal();msSfx('ok');}
 d.classList.toggle('on',!!on);d.setAttribute('aria-hidden',on?'false':'true');
 if(on){const b=d.querySelector('.ms-dplay');b&&b.focus({preventScroll:true});}
}

/* ---------- LAYOUT ---------- */
function msLayout(){
 if(!MS.on||!MS.el.track)return;const E=MS.el;
 const cs=getComputedStyle(E.track),avail=E.track.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
 const h=Math.max(150,Math.min(avail,Math.round(innerWidth*.46),640));
 E.root.style.setProperty('--h',h+'px');msTabBar();msArrows();
}
function msLayoutSoon(){if(!MS.on)return;cancelAnimationFrame(MS.raf);MS.raf=requestAnimationFrame(msLayout);}
function msArrows(){const t=MS.el.track;if(!t)return;const max=t.scrollWidth-t.clientWidth;MS.el.arrL.classList.toggle('on',t.scrollLeft>8);MS.el.arrR.classList.toggle('on',max>8&&t.scrollLeft<max-8);}
let _msArT=0;function msArrowsSoon(){if(_msArT)return;_msArT=requestAnimationFrame(()=>{_msArT=0;msArrows();});}
function msScrollBy(d){const t=MS.el.track;t.scrollBy({left:d*t.clientWidth*.7,behavior:'smooth'});msSfx('tab');}

/* ---------- TECLADO ---------- */
function msKey(e){
 if(!MS.on)return;
 const k=e.code,onBtn=e.target&&e.target.closest&&e.target.closest('button')&&!e.target.closest('.ms-card');
 if(MS.modal){if(k==='Escape'||k==='Backspace'){e.preventDefault();msModal(false);msSfx('back');}else if((k==='Enter'||k==='NumpadEnter')&&!onBtn){e.preventDefault();msPlay();}return;}
 if(k==='ArrowLeft'){e.preventDefault();msMove(-1,0);}
 else if(k==='ArrowRight'){e.preventDefault();msMove(1,0);}
 else if(k==='ArrowUp'){e.preventDefault();msMove(0,-1);}
 else if(k==='ArrowDown'){e.preventDefault();msMove(0,1);}
 else if((k==='Enter'||k==='NumpadEnter')&&!onBtn){e.preventDefault();msAudio();msPlay();}
 else if(k==='Escape'||k==='Backspace'){e.preventDefault();msBack();}
 else if(k==='KeyQ'||k==='PageUp'){e.preventDefault();msTabStep(-1);}
 else if(k==='KeyE'||k==='PageDown'){e.preventDefault();msTabStep(1);}
 else if(k==='KeyI'){e.preventDefault();msModal(true);}
}

/* ---------- MENU PRINCIPAL ---------- */
function msLast(){try{const v=localStorage.getItem('ss_lastmode');return MS_MODES[v]?v:null;}catch(e){return null;}}
function msMenuRefresh(){
 const b=$('bquick'),id=msLast();if(!b)return;
 if(!id){b.style.display='none';return;}
 const m=MS_MODES[id];b.style.display='';b.style.setProperty('--c',m.accent);
 $('bquickt').textContent=m.title+(m.title2?' — '+m.title2:'');
}
function msQuick(){
 const id=msLast();if(!id)return;msAudio();SFX.ui();
 if(MS_MODES[id].flow==='monwave'){show('monwave');return;}
 startMode(id);
}
/* volta à seleção a partir de pausa/fim de partida (mantém o modo atual selecionado) */
function msFromGame(){const cur=typeof mode!=='undefined'?mode:null;SFX.ui();toMenu();msOpen(cur);}

function msWire(){
 if(MS.wired)return;MS.wired=true;
 const bp=$('bplay');if(bp)bp.onclick=()=>{msAudio();SFX.ui();msOpen();};
 const bq=$('bquick');if(bq)bq.onclick=msQuick;
 if($('mwback'))$('mwback').onclick=()=>{SFX.ui();msOpen('monsters');};
 if($('pmodes'))$('pmodes').onclick=msFromGame;
 if($('emodes'))$('emodes').onclick=msFromGame;
 if($('ttmodes'))$('ttmodes').onclick=()=>{if(typeof ttShow==='function')ttShow('ttend',false);msFromGame();};
 msMenuRefresh();
}

/* ---------- GANCHOS NO JOGO ORIGINAL ---------- */
{const _show=show;show=function(id){_show(id);const el=$('modesel');const on=id==='modesel';if(el)el.classList.toggle('on',on);MS.on=on;if(!on&&MS.modal)msModal(false);};}
{const _sm=startMode;startMode=function(m){const el=$('modesel');if(el)el.classList.remove('on');MS.on=false;if(MS.modal)msModal(false);_sm(m);};}
{const _tm=toMenu;toMenu=function(){_tm();msMenuRefresh();};}
{const _sg=startGame;startGame=function(){_sg();msWire();};}
/* a seleção é opaca: não desenhar o 3D por trás dela poupa GPU/bateria */
{const _r=renderer.render;renderer.render=function(a,b){if(MS.on)return;return _r.call(this,a,b);};}
window.__modesel={MS,open:msOpen,select:id=>msSelect(id,true),tab:t=>msSetTab(t,true),play:msPlay};
