# SHADOW STRIKE — Dark Horror Lighting Overhaul + Flashlight

## Resumo das mudanças

### 1. Atmosfera de escuridão (horror)
- Ciclo dia/noite começa **sempre de noite** (21h–23h30).
- Cores noturnas muito mais escuras (céu, fog, ambient).
- Intensidade do HemisphereLight à noite reduzida para ~0.12 (antes ~0.35).
- Fill light quase desligado à noite.
- Fog noturna mais densa e próxima (near 18, far 70).
- Tone mapping exposure noturna ~0.20–0.22 (muito mais escuro).
- Luzes de emergência vermelhas sutis (PointLights) em 5 pontos do mapa, com piscar aleatório.

### 2. Lanterna realista (SpotLight 3D)
- `THREE.SpotLight` real anexada à câmera FPS.
- Ângulo do feixe ~42° (0.55 rad), alcance 24 m, penumbra 0.55, decay 1.5.
- Intensidade dinâmica: ~3.4 à noite / ~1.4 de dia.
- Posicionamento tipo lanterna na mão/ombro.
- Target segue a direção da câmera.
- Sombras dinâmicas da lanterna **apenas em qualidade Alta/Ultra** (performance).
- Sistema de bateria opcional (`ENV.batEnabled=false` por padrão; ativável).
- Flicker de bateria baixa preparado.

### 3. Controles
- **Tecla F** (desktop): liga/desliga lanterna.
- **Botão 🔦** (mobile): botão tático circular no canto direito inferior.
- Estado visual ON (verde iluminado) / OFF.
- Compatível com movimento, tiro, mira, etc.
- Tecla V = visão noturna (já existia).

### 4. Arquivos modificados
- `js/immersion.js` — lighting, flashlight, emergency lights, night start
- `js/player.js` — binding do botão flashbtn + tecla F (já existia)
- `js/game.js` — TB array + texto de controles
- `index.html` — botão `#flashbtn`
- `style.css` — estilo do botão lanterna

### 5. Como testar
1. Extrair o ZIP.
2. Servir a pasta `game/` (ex.: `npx serve game` ou Live Server).
3. Abrir no navegador (precisa de internet para CDN Three.js r128).
4. Iniciar qualquer modo → ambiente escuro.
5. Pressionar **F** ou tocar no botão 🔦 para acender a lanterna.
6. Qualidade Alta/Ultra ativa sombras da lanterna.

### Limitações
- Sem volumetria / light shafts (Three.js r128 sem lib extra).
- Sombras da lanterna só em qualidade alta para manter FPS em mobile.
- Bateria desativada por padrão (não frustra o gameplay).
- Mapa continua o mesmo; a escuridão vem do lighting system real.

Pronto para jogar.
