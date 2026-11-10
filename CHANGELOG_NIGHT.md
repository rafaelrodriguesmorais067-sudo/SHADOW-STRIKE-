# SHADOW STRIKE — Enchanted Wilds: Bosque Assombrado à Noite

## O que mudou nesta versão

### 1. Campo maior
- A floresta passou de ~90 m para **140 m de lado**.
- Todas as regiões (clareira, mata densa, pântano, ruínas) cresceram junto.
- O mapa original dos outros modos não mudou.

### 2. Menos árvores
- Densidade reduzida principalmente na mata densa e no meio do mapa.
- Mais pedras e troncos caídos no lugar das árvores, para o combate não ficar vazio.

### 3. Mais estradas
- De 5 para **11 estradas**, quase duas vezes mais largas.
- Estradas cruzam o mapa e há uma volta completa pelo norte e pelo sul.

### 4. Noite assombrada (shader)
- Névoa azul-escura e luar frio no lugar da luz do dia.
- Mata densa quase negra; cogumelos com brilho roxo.
- Escurecimento nas bordas da tela (vinheta) e granulação leve.
- Raios de luz agora são de luar; vaga-lumes verdes.
- **Lua cheia** com crateras e halo, posicionada à frente do ponto inicial.

### 5. Sons
- Pássaros deram lugar a **corujas e uivos distantes**.
- A floresta silencia quando há monstros por perto.
- Vento, chuva, pássaros/corujas e passos em folhas ou solo molhado são gerados por código e respeitam o volume das configurações.

## Como jogar
1. Extraia a pasta `shadowstrike/`.
2. Sirva a pasta (ex.: `npx serve shadowstrike` ou Live Server).
3. Abra no navegador — precisa de internet para o CDN do Three.js r128.
4. Escolha **CONTRA MONSTROS** para jogar na floresta.

## Ajuste de brilho
Se a cena estiver escura demais na sua tela, use o **ajuste de brilho nas configurações** do jogo para clarear.

## Licença dos modelos da floresta
A licença do pacote da floresta (`models/forest/LICENSE.txt`) permite usar os modelos no jogo, mas **proíbe revender ou redistribuir os modelos soltos**.
