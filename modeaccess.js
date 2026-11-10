"use strict";
/* Availability policy: keep shared original systems, expose only retained modes. */
const SS_ALLOWED_MODES = Object.freeze(['titan', 'monsters', 'practice']);
function ssModeAllowed(id) { return SS_ALLOWED_MODES.includes(id); }

for (const id of Object.keys(MS_MODES)) {
 if (!ssModeAllowed(id)) delete MS_MODES[id];
}
for (const id of Object.keys(MODES_META)) {
 if (!ssModeAllowed(id)) delete MODES_META[id];
}
MS_CATS.splice(0, MS_CATS.length, {id:'featured', label:'MODOS DE JOGO', short:'MODOS'});
for (const tab of Object.keys(MS_TABS)) delete MS_TABS[tab];
MS_TABS.featured = {big:['titan','monsters'], small:['practice']};
MS.tab = 'featured';
if (!ssModeAllowed(MS.sel)) MS.sel = 'titan';
try {
 const last = localStorage.getItem('ss_lastmode');
 if (last && !ssModeAllowed(last)) localStorage.removeItem('ss_lastmode');
} catch (e) { /* Storage may be unavailable. */ }

{const original = startMode;
 startMode = function(id) {
  if (!ssModeAllowed(id)) return;
  return original.apply(this, arguments);
 };
}
{const original = resetGame;
 resetGame = function() {
  if (!ssModeAllowed(mode)) return;
  return original.apply(this, arguments);
 };
}
{const original = gmStart;
 gmStart = function(id) {
  if (!ssModeAllowed(id)) return;
  return original.apply(this, arguments);
 };
}
{const original = startGame;
 startGame = function() {
  document.querySelectorAll('[data-m]').forEach(el => {
   if (!ssModeAllowed(el.dataset.m)) el.remove();
  });
  const subtitle = document.querySelector('#bplay small');
  if (subtitle) subtitle.textContent = 'SELECIONAR MODO DE JOGO · 3 MODOS';
  return original.apply(this, arguments);
 };
}