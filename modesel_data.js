"use strict";
/* SELEÇÃO DE MODO — REGISTRO DOS MODOS
   Só dados (sem DOM): cada entrada aponta para um modo que JÁ existe no jogo.
   id = identificador passado a startMode() (game.js / modes.js MODES_META / titan_mode.js).
   flow:'monwave' = abre a tela original de escolha de onda antes de jogar.
   cats = abas onde o card aparece. A ordem em MS_TABS define quais viram cards grandes. */

const MS_CATS=[
 {id:'featured',label:'DESTAQUES',short:'DESTAQUES'},
 {id:'classic',label:'MODOS CLÁSSICOS',short:'CLÁSSICOS'},
 {id:'survival',label:'SOBREVIVÊNCIA',short:'SOBREV.'},
 {id:'specops',label:'OPERAÇÕES ESPECIAIS',short:'OPS. ESP.'},
 {id:'boss',label:'BATALHAS DE CHEFE',short:'CHEFES'},
 {id:'training',label:'TREINO',short:'TREINO'}
];

/* Em cada aba: big = cards grandes (máx. 2), small = grade secundária. */
const MS_TABS={
 featured:{big:['titan','monsters'],small:['campaign','survival','zombie','tdm','dom','bomb','hostage','specops','bossfight','practice']},
 classic:{big:['tdm','dom'],small:['bomb','hostage']},
 survival:{big:['survival','zombie'],small:['monsters']},
 specops:{big:['specops','campaign'],small:['hostage','bomb','bossfight','practice']},
 boss:{big:['titan','bossfight'],small:[]},
 training:{big:['practice'],small:[]}
};

const MS_DIFF=['','MUITO FÁCIL','FÁCIL','MÉDIO','DIFÍCIL','EXTREMO'];

const MS_MODES={
 titan:{title:'TITAN',title2:'THE ANCIENT COLOSSUS',cat:'CHEFE ÉPICO',tag:'NOVO',accent:'#4ff0df',art:'img/modes/titan.jpg',
  sub:'BATALHA CONTRA O COLOSSO',desc:'Enfrente o golem de pedra de 8,6 m numa arena em ruínas.',
  diff:4,players:'SOLO',time:'8–15 MIN',
  long:'Um colosso de pedra desperta numa arena antiga. Ele tem três fases, cinco ataques diferentes e pontos fracos que brilham. Use as colunas e pedras como cobertura e mire na cabeça, nas pernas e no núcleo exposto.',
  obj:['Derrote o Titã em 3 fases','Acerte os pontos fracos para dano extra','Fuja da prisão de pedra apertando PULAR'],
  tips:['Quando o núcleo brilhar, todo tiro nele causa muito mais dano.','Círculos vermelhos no chão avisam onde os meteoros vão cair.']},
 monsters:{title:'CONTRA MONSTROS',cat:'ONDAS',tag:'HOT',accent:'#ff9a3c',art:'img/modes/monsters.jpg',flow:'monwave',
  sub:'10 ONDAS DE CRIATURAS',desc:'Esqueletos, orcs, yetis e demônios em ondas cada vez mais fortes.',
  diff:3,players:'SOLO',time:'10–25 MIN',
  long:'Criaturas atacam em 10 ondas, cada uma com mais monstros, mais vida e mais força. Comece da onda 1 ou escolha uma onda mais avançada.',
  obj:['Sobreviva às 10 ondas','Monstros especiais aparecem a partir da onda 6','Escolha a onda inicial antes de entrar'],
  tips:['O Rei Cogumelo explode: mantenha distância.','Recolha caixas verdes para recuperar vida.']},
 campaign:{title:'CAMPANHA',cat:'HISTÓRIA',accent:'#e9a23b',art:'img/modes/campaign.jpg',
  sub:'4 MISSÕES TÁTICAS',desc:'Do posto avançado ao esquadrão de elite. Seu progresso fica salvo.',
  diff:3,players:'SOLO',time:'5–10 MIN / MISSÃO',
  long:'Quatro missões em sequência: posto avançado, instalação industrial, emboscada urbana e esquadrão de elite. Cada vitória libera a próxima missão.',
  obj:['Elimine todos os hostis da missão','Vença para liberar a próxima missão','A última missão tem um chefe'],
  tips:['Snipers aparecem na missão 3: use cobertura.','Médicos curam aliados: elimine-os primeiro.']},
 tdm:{title:'TEAM DEATHMATCH',cat:'CLÁSSICO',accent:'#5aa9ff',art:'img/modes/tdm.jpg',
  sub:'30 ELIMINAÇÕES',desc:'Faça 30 eliminações antes do tempo acabar.',
  diff:2,players:'SOLO VS IA',time:'5 MIN',
  long:'Combate contínuo: inimigos reaparecem o tempo todo. Faça 30 eliminações em 5 minutos ou tenha mais abates que o time inimigo quando o tempo acabar.',
  obj:['Alcance 30 eliminações','Ou lidere quando os 5 minutos acabarem'],tips:['Mantenha-se em movimento: os inimigos não param de chegar.']},
 dom:{title:'DOMINAÇÃO',cat:'CLÁSSICO',accent:'#3fe0ff',art:'img/modes/dom.jpg',
  sub:'PONTOS A · B · C',desc:'Capture e segure os pontos A, B e C.',
  diff:3,players:'SOLO VS IA',time:'6–10 MIN',
  long:'Três pontos de controle no mapa. Fique dentro de um ponto para capturá-lo. Cada ponto seu soma placar; chegue a 100 primeiro.',
  obj:['Capture os pontos A, B e C','Chegue a 100 pontos antes do inimigo'],tips:['Segurar dois pontos já garante vantagem.']},
 bomb:{title:'DESARME DE BOMBA',cat:'CLÁSSICO',tag:'TÁTICO',accent:'#f0b429',art:'img/modes/bomb.jpg',artPos:'50% 78%',
  sub:'PLANTE OU ELIMINE',desc:'Plante a bomba no alvo amarelo ou elimine os defensores.',
  diff:3,players:'SOLO VS IA',time:'4–8 MIN',
  long:'Leve a bomba até o alvo amarelo e segure AGACHAR para plantar. Depois defenda a posição até a explosão, ou elimine todos os defensores.',
  obj:['Chegue ao alvo amarelo','Segure AGACHAR para plantar','Defenda até a explosão'],tips:['Limpe a área antes de plantar.']},
 hostage:{title:'RESGATE DE REFÉNS',cat:'CLÁSSICO',accent:'#4fe08a',art:'img/modes/hostage.jpg',
  sub:'3 REFÉNS · EXTRAÇÃO',desc:'Resgate 3 reféns e leve-os à zona verde.',
  diff:3,players:'SOLO VS IA',time:'6–10 MIN',
  long:'Três reféns (amarelos) estão presos no mapa. Chegue perto para libertá-los; eles seguem você até a zona verde de extração.',
  obj:['Liberte os 3 reféns','Leve-os à zona verde'],tips:['Os reféns seguem você: não corra demais.']},
 survival:{title:'SOBREVIVÊNCIA',cat:'ONDAS',accent:'#e5483a',art:'img/modes/survival.jpg',
  sub:'ONDAS INFINITAS',desc:'Ondas sem fim de soldados. Até onde você chega?',
  diff:3,players:'SOLO',time:'SEM LIMITE',
  long:'Ondas infinitas de soldados inimigos. A cada onda surgem mais inimigos e tipos mais perigosos: pesados, médicos, snipers e chefes.',
  obj:['Sobreviva o máximo de ondas','Bata o seu recorde de onda'],tips:['Chefes podem aparecer a partir da onda 6.']},
 zombie:{title:'SOBREVIVÊNCIA ZUMBI',cat:'HORDA',tag:'TERROR',accent:'#7dff8f',art:'img/modes/zombie.jpg',artPos:'50% 62%',
  sub:'HORDA RÁPIDA',desc:'Hordas rápidas e agressivas que nunca param de avançar.',
  diff:4,players:'SOLO',time:'SEM LIMITE',
  long:'Os inimigos correm mais rápido, atacam sem parar e vêm direto até você. Cada onda traz uma horda maior.',
  obj:['Sobreviva às ondas zumbi','Hordas maiores a cada onda'],tips:['Recue enquanto atira: eles são rápidos.']},
 specops:{title:'OPERAÇÕES ESPECIAIS',cat:'OPERAÇÃO',accent:'#2fd6b5',art:'img/modes/specops.jpg',
  sub:'OBJETIVO ALEATÓRIO',desc:'Eliminar, sobreviver ou coletar: cada missão é diferente.',
  diff:3,players:'SOLO',time:'2–6 MIN',
  long:'Uma missão tática sorteada: eliminar alvos prioritários, sobreviver por 90 segundos ou coletar 3 suprimentos inimigos.',
  obj:['Complete o objetivo sorteado'],tips:['Leia o objetivo no topo da tela.']},
 bossfight:{title:'BATALHA DE CHEFES',cat:'CHEFE',accent:'#ff4d3a',art:'img/modes/bossfight.jpg',
  sub:'COMANDANTE DE ELITE',desc:'Derrote o comandante blindado e seus reforços.',
  diff:4,players:'SOLO',time:'3–6 MIN',
  long:'Um comandante de elite com muito mais vida e dano, escoltado por soldados pesados. Elimine o chefe para vencer.',
  obj:['Derrote o chefe','Sobreviva aos reforços'],tips:['Tiros na cabeça causam 2,5x de dano.']},
 practice:{title:'TREINO LIVRE',cat:'TREINO',accent:'#c8e07a',art:'img/modes/practice.jpg',
  sub:'SEM DANO',desc:'Alvos que reaparecem e sem dano. Teste todas as armas.',
  diff:1,players:'SOLO',time:'LIVRE',
  long:'Alvos parados que reaparecem sozinhos e você não leva dano. Ideal para testar armas, controles e sensibilidade.',
  obj:['Teste armas e controles à vontade'],tips:['Ajuste a sensibilidade em CONFIGURAÇÕES.']}
};
