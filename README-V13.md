# SHADOW STRIKE v13 — Movimento avançado

Novo arquivo: `js/movement.js` (carrega depois do `game.js` e antes do `br.js`). Ele substitui `updatePlayer()` e `dashPlayer()` e envolve `updateWeapon()` e `resetGame()`. Nenhum arquivo foi recriado; jogo, armas, IA, modos (Campanha, Sobrevivência, Treino, Battle Royale) e aim assist foram mantidos.

## Controles
| Ação | Toque | PC |
|---|---|---|
| Deslizar | botão **DESLIZ.** ou **AGACH.** enquanto corre | **C** enquanto corre |
| Inclinar | segurar **◀ / ▶** | segurar **Z / X** |
| Correr | **CORRER** (liga/desliga) ou empurrar o analógico até o fim | Shift |
| Agachar | **AGACH.** | C |
| Pular | **PULAR** | Espaço |
| Esquiva | **ESQUIVA** (direção do analógico; parado = para trás) | **E** ou toque duplo em **A / D / S** |

## O que mudou
- **Corrida:** aceleração e frenagem suaves; gasta stamina (barra amarela sob a vida). Em 0 você fica sem fôlego e a corrida desliga até recuperar 20%.
- **Deslize:** exige correr (≥5,2 m/s), impulso inicial até 9,5 m/s com atrito crescente (~4–5 m), câmera baixa, poeira, pode pular para fora mantendo o impulso, para ao bater em parede. Recarga 1,6 s, custa 10 de stamina.
- **Inclinar:** até 0,38 m e ~11° de roll; limitado por colisão (a câmera não entra na parede); desativado correndo, deslizando, no ar ou esquivando. O tiro sai da posição inclinada.
- **Agachar:** altura da câmera suave; checagem de teto (não levanta sob espaço baixo). Velocidade agachado ajustável em Configurações.
- **Pulo:** coyote time (0,1 s), buffer de pulo (0,12 s), queda mais firme, altura variável no teclado, pouso com impacto proporcional à queda (mola na câmera e na arma), pouso duro reduz velocidade por 0,3 s, poeira e som. Sem dano de queda.
- **Esquiva:** 8 direções, ~4 m com desaceleração, roll da câmera, FOV, invulnerabilidade (já existente), recarga 1,4 s, custo 12 de stamina.
- **Câmera:** head bob por passo (fase proporcional à velocidade real), balanço lateral, roll ao correr de lado, respiração no parado, FOV dinâmico, subida de degrau suave. Intensidade ajustável (0 desliga) em Configurações → Balanço da câmera.
- **Arma:** sway por molas ao girar a câmera (arma "atrasa" e volta), bob de passo, pose de corrida, pose de deslize, abaixa levemente ao agachar, sobe/desce no ar, inclina ao recarregar, quase sem balanço ao mirar. Armas mais longas balançam mais.
- **Colisão:** movimento em sub-passos de no máximo 0,28 m; impossível atravessar paredes finas mesmo na esquiva (22 m/s). Velocidade é amortecida ao bater.

## Arquivos alterados
- novo: `js/movement.js`, `README-V13.md`
- `js/core.js`: adiciona `movement.js` à lista de carregamento
- `js/player.js`: botões/teclas de agachar e esquiva chamam as novas funções
- `js/assist.js`: o olho do aim assist usa a altura real da câmera (`P.eyeH`)
- `js/game.js`: apenas o texto da tela CONTROLES
- `index.html`, `style.css`: botões DESLIZ./◀/▶, sliders de ajuste (balanço, velocidade agachado)

## Ajustes
Tudo em `MVCFG` (topo do `movement.js`): velocidades, stamina, slide, lean, pulo, gravidade. Em `updateWeapon` (fim do arquivo) ficam os valores das poses da arma.

## Desempenho (Android)
Sem alocação por quadro (vetores reutilizados), textos de botões e barra de stamina só mudam quando o valor muda, sem novos objetos 3D. Passos sonoros usam um oscilador curto por passo.

## Testes feitos
Verificação de sintaxe com Node em todos os arquivos; testes automatizados em Node com as funções reais de colisão do `world.js` e os arquivos reais `player.js`/`movement.js` (DOM e Three simulados): aceleração, stamina (esgotar/recuperar), slide (início, fim, recarga, parede, pulo), agachar (velocidade, teto baixo, suavidade), pulo (altura, coyote, buffer, pouso), esquiva (distância, recarga, custo, sem atravessar parede), lean (limite por parede, bloqueio correndo), poses da arma, e fuzz de 20.000 quadros sem NaN e sem sair do mapa.
**Não houve execução real em navegador/WebGL.** Teste no celular alvo e confira o console. Valores visuais da pose da arma (rotações) podem precisar de ajuste fino.
Em Battle Royale (3ª pessoa) o lean inclina a câmera, mas o boneco não inclina.
