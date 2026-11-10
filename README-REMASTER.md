# OPERATION: SHADOW STRIKE — Graphics Remaster

## What changed
- Updated the Three.js r128 renderer to use ACES filmic tone mapping and sRGB output encoding.
- Tuned sunlight, hemisphere fill, atmospheric fog, shadow bias, and shadow profiles.
- Converted shared environment materials from Lambert shading to roughness/metalness-aware `MeshStandardMaterial` where supported, while retaining the original procedural textures and module order.
- Improved the first-person weapon viewmodel with a barrel, muzzle, handguard, receiver, magazine, stock, rail, and mechanical ribs.
- Added modular tactical armor details to procedural enemy soldiers without replacing their AI or combat logic.
- Refined menu, HUD, touch-button, and settings styling.
- Added an Ultra quality choice; it is optional and may be too demanding for older phones.
- Added resize handling for changing screen dimensions.

## Run on Android (SPCK Editor / Acode)
1. Extract the entire ZIP into one project folder. Keep `index.html`, `style.css`, and the `js/` folder together.
2. Open `index.html` with the editor's preview or a local web server.
3. The project currently loads Three.js r128 from cdnjs, so an internet connection is required on first load.
4. Rotate the phone to landscape and enable automatic rotation. Start with Medium quality; use High/Ultra only if frame rate remains stable.

## Graphics settings
Open **Configurações → Qualidade**. Low and Medium are recommended for weaker devices. Ultra increases pixel ratio and enables high-quality shadow maps, which may increase heat and battery use. The existing save data stores the selected quality locally.

## Compatibility and limitations
- Original gameplay modules, controls, weapons, enemy AI, collision routines, missions, and game modes are retained.
- Procedural textures and procedural models are retained; no external model or texture packs were added.
- This is a code-level graphics remaster, not a claim of AAA asset parity. The game still uses lightweight procedural characters and environments.
- Three.js remains at r128 to preserve the original API compatibility.

## Validation performed
- Checked JavaScript files for syntax errors with Node.js.
- Checked ZIP structure and required project files.
- A real browser/WebGL visual run was not available in this execution environment. Please test the project on the target Android browser and inspect its console before relying on the new visual profile.

## Personagem 3D (soldado)
- Os inimigos e o personagem em terceira pessoa agora usam o modelo `soldierbackpack.fbx` (convertido para `js/soldier.js`, sem dependências extras e sem internet além do Three.js).
- Tipos heavy e scout recebem apenas uma variação de cor sobre o mesmo modelo.
- O modelo é estático (sem esqueleto), então não há animação de pernas/braços; a cabeça tem hitbox invisível para manter o dano de headshot.

## Controles (v4)
- CORRER: toque para ligar/desligar. Shift (PC) também alterna. Corre para frente e para os lados.
- ESQUIVA (dash): botão ou tecla E. Impulso curto na direção do movimento (parado = esquiva para trás). Tem recarga de 1,6 s e invulnerabilidade durante o impulso.

## Dificuldade
- Inimigos acertam mais (precisão maior, principalmente à distância) e atiram um pouco mais rápido.

## Modelos 3D (v6)
- Inimigos comuns: Soldier by Umair Yaqub. Heavy: Knight by Dawid2K. Scout: Soldier by madtrollstudio (tingido).
- Fuzil de assalto: Rifle by Quaternius (Weapon_Rifle). Carabina (arma 4): Rifle by Quaternius (segundo modelo).
- Fuzil de precisão (arma 5, tecla 5): Sniper Rifle by Zsky.
- Armas: 1 Fuzil de assalto, 2 Pistola, 3 Escopeta, 4 Carabina, 5 Fuzil de precisão (teclas 1 a 5). A troca percorre todas.
- Os modelos são estáticos (sem animação) e estão embutidos em js/models.js, sem internet além do Three.js.

## Bots com empunhadura de duas mãos (v7)
- Os bots agora seguram o fuzil com as duas mãos: a mão direita no punho/gatilho e a esquerda no guarda-mão, com braços procedurais (IK) presos ao ombro.
- Em combate o fuzil sobe para mirar no jogador; em patrulha fica em posição baixa.
- Cada tiro dá um pequeno coice no fuzil.
- Os braços são malhas procedurais separadas, pois o modelo embutido é estático.

## Revisão v8 (correções de qualidade gráfica)
- **Ultra corrigido:** antes, o perfil Ultra (índice 3) calculava pixel ratio `NaN`, não tinha sombras (sombras só estavam ativas no perfil Alta) e não tinha tufos de grama. Agora cada perfil usa uma tabela única em `js/engine.js` (`QT`):

| Perfil | Pixel ratio | Sombras | Texturas | Anisotropia | Tufos de grama |
|---|---|---|---|---|---|
| Baixa | 1.0 | desligadas | 128 px | 1x | 0 |
| Média | 1.25 | desligadas | 256 px | 2x | 160 |
| Alta | 1.5 | 1024 px | 384 px | 4x | 380 |
| Ultra | 2.0 | 2048 px | 512 px | 8x | 600 |

- **Materiais PBR:** o cenário (chão, asfalto, concreto, tijolo, madeira, containers, areia, folhagem, barris, telhados) usa `MeshStandardMaterial` com rugosidade e metalicidade por tipo de superfície nos perfis Média, Alta e Ultra. O perfil Baixa mantém `MeshLambertMaterial` para celulares mais fracos. Os soldados inimigos (mangas) também usam a nova função `mkMat`.
- **Aviso de recarga:** texturas, tufos de grama e antialias são montados na inicialização. Se o perfil for alterado nas configurações, o jogo mostra a mensagem "Recarregue a página…" em vez de fingir que a mudança já foi aplicada. Pixel ratio e sombras são atualizados na hora.
- **Não incluído nesta versão:** menu separado para qualidade de textura, sombras, intensidade de efeitos, distância de renderização e antialias; efeitos de partículas adicionais; pós-processamento (bloom, DOF). Esses itens continuam pendentes.
- **Testes:** verificação de sintaxe com Node em todos os arquivos. Um teste estático (com THREE simulado) executou `engine.js` e `world.js` nos quatro perfis e confirmou o tipo de material, o pixel ratio e os tufos. **Não houve execução real em navegador/WebGL** neste ambiente, portanto ainda é necessário testar no celular alvo.

## Bots SWAT animados (v9)
- Os bots (comum, heavy e scout) agora usam o personagem **SWAT by Quaternius (CC0)**, com esqueleto de 62 ossos e animações. O arquivo `.glb` está embutido em `js/swatdata.js` (base64) e é lido por `js/swat.js`, um carregador de GLB próprio para o Three.js r128 (não precisa de GLTFLoader nem de internet extra).
- Animações usadas: `Idle_Gun` (parado), `Walk` (patrulha/andando devagar), `Run` / `Run_Back` / `Run_Left` / `Run_Right` (de acordo com a direção do movimento em relação ao corpo; scout faz strafe), `HitRecieve` / `HitRecieve_2` (reação ao levar tiro, com intervalo mínimo de 1,1 s) e `Death` (morte). A velocidade da animação acompanha a velocidade real do bot.
- Fuzil de duas mãos: o fuzil do jogo (escala 0,68) fica no pivô de mira; os **braços do SWAT são recalculados por IK de dois ossos** nos ossos reais (ombro, cotovelo, mão) para as duas mãos acompanharem o fuzil, inclusive mira para cima/baixo e coice.
- Variações: comum = armadura azul-escura, heavy = vermelho-escuro (1,2x maior), scout = bege (0,95x).
- Hitboxes: como a malha animada não serve para raycast, o corpo usa uma caixa invisível e a cabeça uma esfera invisível presa ao osso da cabeça (headshot continua valendo 2,5x).
- Desempenho: a malha é compartilhada, só o esqueleto/mixer é por bot. Bots a mais de 55 m do jogador atualizam a animação ~6x/s e ficam sem IK. Na qualidade Baixa o material é Lambert; Média/Alta/Ultra usam PBR.
- Reserva: se o SWAT não carregar por algum motivo, o jogo volta sozinho ao soldado estático antigo (mensagem no console).
- Não mudou: o personagem em 3ª pessoa do jogador (modo Battle Royale) continua com o soldado antigo; armas, IA, dano e modos são os mesmos.
- Carregamento: `core.js` carrega `swatdata.js` e `swat.js` logo depois de `models.js`. O arquivo de dados tem ~2 MB.

### Testes feitos na v9
- Verificação de sintaxe com Node em todos os arquivos.
- Teste com um "mini Three.js" em Node (matemática real de matrizes, quaternions, ossos e mixer) executando os arquivos reais `swat.js` e `enemies.js`: carga do GLB, 24 animações sem osso faltando, pele (pés em y=0, altura ~1,81 m), IK (mão a no máximo ~4 cm da âncora do fuzil, antebraço com comprimento constante), troca de estados, reação a tiro, morte e LOD.
- **Não houve execução real em navegador/WebGL** neste ambiente. Teste no celular e olhe o console: ajustes finos de posição do fuzil ou do cotovelo ficam em `SWK` e no vetor de polo em `swatArmIK` (`js/enemies.js` / `js/swat.js`).

## Aim Assist estilo Free Fire (v11)
Arquivo: `js/assist.js` (substitui o sistema antigo de 4 níveis; carrega por último e envolve `update()`, sem editar os outros arquivos).
Escolha em **Configurações → Assistência de mira** (salvo em `localStorage` `ss_aimassist`):

| Modo | O que faz |
|---|---|
| **PADRÃO** | Atração suave da câmera até o **torso** do inimigo + acompanhamento **limitado** do movimento dele. |
| **PRECISO AO MIRAR** | Só atração (até um ponto fixo gravado ao travar). **Sem** acompanhamento automático: se o inimigo andar, você acompanha. |
| **CONTROLE TOTAL** | Nenhuma assistência. |

Regras (valem para PADRÃO e PRECISO):
- Só age com **inimigo válido** dentro do raio ao redor da mira e **enquanto você atira ou mira (ADS)**.
- Valida: vivo, distância (1,5–60 m), **campo de visão** (raio nunca passa do FOV) e **linha de visão** até o torso (paredes, caixas e barris bloqueiam).
- Não altera sensibilidade, controles nem o sistema de tiro: só soma uma pequena rotação à câmera. Se você girar **contra** o alvo, a assistência cede na hora.
- Retículo fica avermelhado quando há alvo válido na área.
- Removidos junto com o sistema antigo: o **tiro automático ao mirar** (nível ALTA) e o **atrito** (câmera mais lenta perto do alvo), pois alteravam tiro/sensibilidade.

Ajustes (no topo de `assist.js`): `AIMA_CFG` (distância, FOV, altura do torso, zona morta, cessão) e `AIMA_MODES` (raio em graus sem/com mira, força da atração, velocidades máximas).

Validação: lógica testada em Node com o jogo simulado (14 casos: atração, raio, ADS, distância, morto, parede, sem tiro, sem assistência, acompanhamento x ponto fixo, jogador escapando). **Não houve execução real em navegador/WebGL** neste ambiente: teste no celular alvo.
