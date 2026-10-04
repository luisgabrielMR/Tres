# Três — Comitê 1: regras e arquitetura

**Status: aprovado por Luis; revisado em 04/10/2026.** Luis aprovou o Comitê 1 e autorizou o início do Comitê 2 a partir do mockup HTML enviado. Alteração posterior: cada peça pode se mover no máximo uma vez por carta, inclusive após promoção; o roque utiliza rei e torre. A preferência visual é por animações, respeitando movimento reduzido.

O repositório foi encontrado vazio, exceto pelos metadados Git. A especificação parte do pedido do usuário. As decisões abaixo distinguem requisitos recebidos de interpretações propostas para fechar ambiguidades.

**Revisão posterior aprovada por Luis (04/10/2026):** +2 e +4 passam por `choosing-effect`. A pessoa escolhe adicionar até dois peões ou realizar dois movimentos no +2; adicionar uma dama ou realizar quatro movimentos no +4. Os movimentos usam peças diferentes. O +4 passa a ser uma exceção explícita ao limite anterior de três movimentos. A escolha é exclusiva e irreversível durante a carta. Sem espaço, permanece a opção de mover; somente a ausência das duas possibilidades encerra automaticamente. A ação `CHOOSE_EFFECT` seleciona `add` ou `move`; `SKIP_EFFECT` continua permitido antes da escolha e no modo de adição. No modo de movimento, não se pode ignorar. A compra continua invalidando en passant. Esta revisão substitui as descrições antigas abaixo que limitavam +2/+4 à adição ou passavam automaticamente por falta de espaço. Contratos executáveis e versão atual das regras estão em `src/core/tres`.

## 1. Regras consolidadas

### Requisitos recebidos

- Duas pessoas; posição inicial e 32 peças do xadrez tradicional; Jogador 1 controla brancas e Jogador 2 controla pretas inicialmente.
- A pessoa que joga e a cor controlada são conceitos diferentes. `playerColors[currentPlayer]` determina a cor em todas as ações.
- Movimentos tradicionais das seis peças, colisões, capturas, avanço inicial duplo de peões, promoção, roque e en passant.
- Não há obrigação de defender o rei. Reis podem ficar ameaçados, ficar adjacentes e capturar um ao outro. Capturar o rei adversário encerra imediatamente a partida e vence quem o capturou.
- Não há xeque-mate, afogamento, repetição, regra dos 50 movimentos ou outro empate tradicional.
- Uma carta por turno: 1, 2 ou 3 movimentos; Bloqueio; Reverse; +2; +4. Efeitos não se acumulam entre turnos.
- Bloqueio encerra o turno sem movimentação. Reverse troca o controle das cores e encerra o turno, mantendo todas as peças nas mesmas casas.
- +2 permite acrescentar de zero a dois peões em casas vazias da segunda fileira da cor atual: fileira 2 para brancas, 7 para pretas.
- +4 permite acrescentar zero ou uma dama em casas vazias da fileira inicial da cor atual: 1 para brancas, 8 para pretas.
- Nenhuma adição substitui peça ou conta como movimento de uma carta numérica. Não há movimento normal nos turnos +2/+4.
- Peças criadas são peças normais e continuam com sua cor após Reverse. Podem existir mais de oito peões ou várias damas por cor.
- Compra e descarte ficam na memória. Ao esgotar o monte, embaralha-se o descarte deterministicamente.
- Modo local permanente; modo online para duas pessoas, sem contas, histórico de partidas ou persistência de estado.

### Decisões aprovadas, incluindo a alteração posterior de Luis

| Assunto | Proposta | Motivo/impacto |
| --- | --- | --- |
| Primeiro jogador | Jogador 1 começa; criador é P1 no online. | Convenção simples; configuração permite mudar o primeiro jogador antes da partida. |
| Repetir peça | Cada peça pode realizar no máximo um movimento na mesma carta. | Alteração explícita de Luis para evitar que uma dama decida a partida com três movimentos consecutivos. É uma regra obrigatória do MVP. |
| Roque e ameaças | Permitir roque mesmo com o rei ameaçado, atravessando ou terminando em casa ameaçada. | Mantém a regra geral de que ameaças ao rei não tornam movimentos ilegais. As outras condições de roque continuam obrigatórias. |
| En passant | Disponível somente no próximo movimento de xadrez executado, inclusive quando esse movimento ainda pertence à mesma carta. Uma carta não numérica invalida a oportunidade ao ser comprada. | Define uma janela curta e objetiva em um jogo que não alterna cores a cada movimento. Exemplos na seção 4. |
| Sem movimentos possíveis | Encerrar o turno numérico e informar quantos movimentos não puderam ser usados; não declarar empate. | Exceção necessária ao termo “exatamente”: evita travamento quando não existe ação válida. Não permite desistir de movimentos que sejam possíveis. |
| Promoção | Escolha obrigatória entre dama, torre, bispo e cavalo; integrada à ação de movimento. | Escolha explícita sem introduzir um estado parcial no tabuleiro. |
| Peão criado e avanço duplo | Pode avançar duas casas a partir de sua fileira inicial se nunca se moveu e ambas as casas estão livres. | “Peça normal” inclui o direito ao avanço inicial. |
| Compra | Botão “Comprar carta” inicia o turno e revela a carta imediatamente. | Não é permitido passar sem comprar; separa turnos e permite ler Bloqueio/Reverse sem cadeias automáticas de efeitos. |

Estas propostas não removem nenhum movimento especial solicitado. A exceção por ausência de movimentos e a interpretação de roque/en passant precisam ficar visíveis também nas regras apresentadas aos jogadores.

## 2. Fluxo completo e máquina de estados

`status` separa partida ativa de terminada. `phase` especifica a interação disponível durante a partida. Estados de conexão são separados e não alteram as regras.

```text
criar partida(seed, regras)
  -> posição inicial -> awaiting-draw

awaiting-draw -- DRAW_CARD do jogador atual -->
  1/2/3 -> moving(n)
  Bloqueio -> efeito + descarte + próximo jogador -> awaiting-draw
  Reverse -> troca de cores + descarte + próximo jogador -> awaiting-draw
  +2 -> adding-pawns(até 2), ou encerramento automático se não há espaço
  +4 -> adding-queen(1), ou encerramento automático se não há espaço

moving -- MOVE válido -->
  rei capturado -> finished
  movimentos restantes > 0 e há movimento válido -> moving
  movimentos restantes = 0 -> encerrar turno
  não há movimento válido -> evento explicativo + encerrar turno

adding-pawns -- ADD_PAWN --> reduzir saldo; encerrar em 0 ou sem casas livres
adding-pawns -- SKIP_EFFECT --> encerrar com 0 ou 1 peão colocado
adding-queen -- ADD_QUEEN / SKIP_EFFECT --> encerrar turno

encerrar turno -> descartar carta -> alternar pessoa -> awaiting-draw
finished -> não aceita ações de jogo
```

1. A criação produz exatamente uma configuração, seed, posição inicial e ordem inicial de baralho.
2. Apenas `currentPlayer` compra e age. A cor é consultada no estado atual, nunca derivada do identificador da pessoa.
3. Ao comprar carta numérica, verificar imediatamente se existe movimento válido. Se não existir, encerrar por impossibilidade.
4. Cada movimento válido custa uma unidade, inclusive roque, en passant e movimento com promoção. Ações inválidas não consomem nada, inclusive RNG e revisão.
   Registrar o ID da peça em `movedPieceIds`. No roque, registrar rei e torre. Promoção preserva a identidade e não libera um novo movimento. Ao procurar movimentos restantes, excluir peças já utilizadas. Limpar esse conjunto somente ao encerrar a carta.
5. Verificar captura do rei antes de continuar a carta, procurar novos movimentos ou trocar jogador. Na vitória, conservar a carta final para exibição; não comprar outra.
6. Nos efeitos +2/+4, oferecer as casas livres da fileira correta e a opção de ignorar/encerrar. Se não há nenhuma, emitir mensagem e encerrar automaticamente.
7. O encerramento não é um comando livre do jogador. É consequência das regras; somente `SKIP_EFFECT` encerra antecipadamente +2/+4.
8. Trocar P1 por P2 ou P2 por P1 exatamente uma vez. Reverse não causa uma segunda alternância nem concede movimento a quem comprou a carta.
9. O próximo jogador compra sua carta por uma ação explícita. Não há temporizador, compra recorrente automática ou recursão de turnos especiais.

Exemplo de Reverse: P1/brancas compra Reverse; passa a controlar pretas. P2 passa a controlar brancas, recebe o próximo turno e compra outra carta. As brancas podem, portanto, agir em turnos consecutivos de pessoas diferentes.

## 3. Estado, entidades e contratos

Os contratos completos estão em [contracts.ts](./contracts.ts). São uma proposta de tipos, sem implementação executável do jogo.

| Elemento | Responsabilidade/invariante |
| --- | --- |
| `board` | 64 casas; cada casa contém um identificador de peça ou `null`. |
| `pieces` | Catálogo de peças vivas, por identidade. A cor é permanente durante a vida da peça. |
| `Piece.id` | Único e determinístico. Promoção preserva ID; captura remove do catálogo e do tabuleiro. |
| `currentPlayer` | Pessoa autorizada a executar a próxima ação. |
| `playerColors` | Mapeamento bijetivo: sempre uma pessoa por cor. Reverse apenas inverte esse mapeamento. |
| `phase` | União discriminada; somente `moving` possui saldo de movimentos e somente efeitos de adição possuem seu saldo. |
| `currentCard` | Carta ativa, ou `null` entre turnos. Na vitória, permanece para mostrar o contexto final. |
| `deck`, `discardPile` | Instâncias de cartas com IDs únicos; ordem de compra é explícita. |
| `rngState` | Estado inteiro de 32 bits do gerador determinístico. |
| `lastMove` | Último movimento real, com IDs, captura, promoção e/ou roque. Adições não o sobrescrevem. |
| `enPassant` | Alvo de passagem, ID/casa do peão vulnerável, cor autorizada e número do movimento que criou a oportunidade. Independente de `lastMove`. |
| `castlingRights` | Direitos associados ao rei e às torres originais, com IDs e permissão de cada lado. |
| `status`, `winner` | União discriminada impede vencedor durante partida ativa; término exige vencedor e captura do rei. |
| `turnNumber`, `moveNumber`, `revision` | Contadores distintos de turnos, movimentos de xadrez e ações aceitas. Não usar tempo de relógio. |
| `nextPieceId` | Contador para IDs de peças adicionadas; compartilhado entre os clientes. |
| `rules` | Configuração completa e versionada, imutável durante a partida. |

`controlledColor` é um valor derivado por `getControlledColor(state, playerId)`. Não se mantém uma segunda cópia desse dado que possa divergir de `playerColors`.

Peças capturadas não precisam de armazenamento histórico. Os detalhes necessários ao último movimento e os eventos recentes bastam. O feed visual pode manter somente os últimos 30 eventos na memória; ele não compõe o estado canônico nem o hash.

### Invariantes verificáveis

- Cada peça viva aparece em exatamente uma casa, e todo ID no tabuleiro existe no catálogo.
- Uma partida ativa tem exatamente um rei branco e um preto. Uma partida terminada por captura tem somente o rei da cor vencedora.
- Nenhuma criação ou promoção gera um rei.
- `currentCard = null` em `awaiting-draw`; fases de movimento/adição possuem carta correspondente.
- A carta ativa, o monte e o descarte formam uma partição das instâncias do baralho configurado, sem perdas ou duplicatas.
- Todo peão em uma fileira final já foi promovido na mesma ação; não há estado intermediário com peão aguardando decisão.
- Saldos das fases ativas são positivos e respeitam os limites da carta.
- `finished` rejeita toda ação e conserva o vencedor original.
- Uma ação rejeitada conserva integralmente o estado anterior.

## 4. Chess Core: regras especiais

### Movimentação e ameaças

Implementar um núcleo próprio pequeno, sem filtragem por segurança do rei. Validar limites, geometria, direção de peões, ocupação, colisões, captura de cor oposta e movimentos especiais. Não usar um validador convencional que proíba captura do rei ou obrigue a resolver xeque.

Ataques e movimentos são consultas distintas: peões atacam diagonais mesmo vazias; reis atacam casas adjacentes; peças deslizantes não atacam através de bloqueios. Uma eventual indicação visual de rei ameaçado é informativa. Não altera a lista de movimentos válidos.

O núcleo recebe a cor autorizada explicitamente. Não armazena um turno próprio alternando brancas/pretas a cada movimento; essa alternância seria incompatível com cartas numéricas e Reverse.

### Roque

- Rei original em e1/e8 e torre original em a1/h1/a8/h8, vivos, sem terem se movido; todas as casas entre eles vazias.
- Destinos tradicionais: rei g1/g8 e torre f1/f8; ou rei c1/c8 e torre d1/d8. No roque grande, b1/b8 também precisa estar vazia.
- Mover as duas peças atomicamente; consumir um movimento.
- Mover o rei remove os dois direitos. Mover ou capturar uma torre original remove seu direito específico. Voltar à casa original não restaura direitos.
- Torre promovida não pode substituir a original para habilitar roque. Adições não criam torres.
- Reverse preserva os direitos das peças/cores; nunca os transfere por identidade do jogador.
- Proposta desta variante: casas ameaçadas não impedem roque. Não confundir isso com a regra tradicional de proteção do rei durante roque.

### En passant

O avanço duplo cria um registro explícito. Só um peão da cor oposta, adjacente ao peão vulnerável e na fileira correta, pode capturá-lo movendo-se para a casa atravessada, que precisa estar vazia. A captura remove o ID do peão vulnerável de sua casa real e consome um movimento.

Janela proposta, em detalhes:

1. Todo `MOVE` aceito usa, quando aplicável, a oportunidade anterior e depois a elimina. Se esse movimento é um novo avanço duplo, cria uma nova oportunidade.
2. Se o avanço duplo foi o último movimento de uma carta numérica, a oportunidade atravessa a fronteira de turno e a compra da próxima carta numérica.
3. Se ainda há movimentos na mesma carta e o jogador executa outro, a oportunidade anterior termina; ela não aguarda o adversário.
4. Comprar Bloqueio, Reverse, +2 ou +4 elimina a oportunidade imediatamente, mesmo se o efeito for ignorado ou não tiver espaço. Encerrar por ausência de movimentos também elimina a oportunidade.
5. Ações inválidas, seleção visual e tempo decorrido não a eliminam.

Exemplos: e2–e4 como último movimento pode permitir d4xe3 no primeiro movimento preto seguinte. Se brancas ainda jogarem g1–f3 na mesma carta, d4xe3 deixa de ser permitido. Se a próxima carta for Bloqueio, a oportunidade expira. A validação consulta esse registro, nunca apenas `lastMove`.

Esta é uma adaptação proposta ao Três, não uma afirmação de que o xadrez tradicional possui turnos de vários movimentos. Fica isolada em uma função de política de validade, para revisão futura sem misturá-la à UI ou ao transporte.

### Promoção, peças extras e repetição de peça

- Peão branco alcançando a fileira 8 ou preto alcançando a 1 exige `promotion` na ação `MOVE`; o campo é inválido nos demais movimentos.
- A UI consulta os movimentos possíveis e solicita a escolha antes de despachar a ação. Cancelar o seletor não modifica o estado.
- Mantêm-se ID e cor; altera-se o tipo. A peça promovida já foi utilizada e não pode agir novamente na mesma carta.
- Captura do rei em uma casa de promoção é resolvida atomicamente com a promoção e encerra a partida sem esperar outra interação.
- Novos peões começam com `hasMoved = false`; nova dama não possui direitos especiais. O limite é a disponibilidade das casas, sem teto arbitrário de peões/damas por cor.
- Um peão que avançou uma ou duas casas já foi utilizado e não pode mover novamente na mesma carta. Rei e torre que participaram de roque também ficam indisponíveis até outra carta.

## 5. Configuração e baralho determinístico

Proposta inicial experimental, sem validação de balanceamento:

| Carta | Quantidade |
| --- | ---: |
| 1 | 12 |
| 2 | 8 |
| 3 | 4 |
| Bloqueio | 3 |
| Reverse | 3 |
| +2 | 3 |
| +4 | 2 |
| **Total** | **35** |

Quantidades e primeiro jogador ficam em um objeto de configuração. Não é necessário criar uma tela de ajustes no MVP. Os efeitos das cartas, o máximo de três movimentos nas cartas numéricas (quatro na alternativa do +4) e a proibição de repetir peça são requisitos fixos.

- Validar quantidades inteiras não negativas, total maior que zero e um limite técnico de tamanho documentado antes de aceitar uma configuração remota. O perfil padrão inclui os sete tipos.
- Gerar IDs de cartas pela ordem fixa `1, 2, 3, block, reverse, +2, +4` e índice da cópia. IDs de peças iniciais derivam de cor, tipo e casa inicial; adições usam contador monotônico com prefixo separado.
- Usar Mulberry32 com aritmética de 32 bits e Fisher–Yates; documentar implementação e incluir vetores conhecidos. Seed zero é válida.
- Seed criada uma única vez com `crypto.getRandomValues`; ambos recebem a mesma seed e configuração. Depois disso, nenhuma regra usa `Math.random()`, relógio, locale ou informação de navegador.
- Representar a ordem do monte explicitamente: a compra remove o primeiro elemento. Embaralhar uma vez na criação; novamente apenas quando uma compra encontra o monte vazio.
- Na reciclagem, embaralhar todo o descarte, esvaziá-lo e continuar usando o estado atual do PRNG. Não reiniciar a seed.
- A carta atual só entra no descarte ao encerrar seu turno; após vitória permanece como carta final. Se não houver cartas em lugar algum, tratar como estado inválido, nunca inventar uma carta.
- Antes de conectar, comparar versões de protocolo, motor e regras; a configuração faz parte do estado/hash. Não tentar compatibilidade silenciosa.

## 6. Arquitetura e diretórios propostos

```text
docs/
  comite-1.md
  contracts.ts                 # proposta de interfaces, sem motor
src/
  core/chess/
    types.ts
    initial-position.ts
    moves.ts                   # geometria, colisões, movimentos especiais
    attacks.ts                 # consulta informativa
    apply-move.ts              # atualização atômica de uma posição
  core/tres/
    types.ts
    config.ts
    create-game.ts
    reducer.ts                 # valida fase/pessoa/cor e aplica ações
    selectors.ts               # cor, casas válidas, ações possíveis
    deck.ts
    rng.ts
    invariants.ts
  multiplayer/
    protocol.ts
    validation.ts
    canonical-state.ts
    peer-session.ts
    signaling.ts
  application/
    game-controller.ts         # mesmo motor para modo local e online
  ui/
    screens/
    components/
    styles/
tests/
  chess/
  tres/
  multiplayer/
  fixtures/
```

Dependências: UI → controller → Três Engine → Chess Core. Multiplayer liga-se ao controller por ações/resultados; não contém regras de movimento. Chess Core não importa Três, React ou WebRTC. Três não importa React, DOM, transporte ou relógio. A implementação real pode reunir arquivos pequenos para evitar fragmentação sem finalidade.

Stack proposta: React + TypeScript estrito + Vite; Vitest para testes de regras em Node. Não há necessidade inicial de Redux, ORM, framework de backend, biblioteca de xadrez com regras ortodoxas ou biblioteca pesada de tabuleiro. Versões e APIs serão verificadas quando houver instalação/implementação.

Contrato principal: `reduceGame(state, action)` retorna sucesso com novo estado e eventos, ou erro tipado. O estado anterior não é mutado. Consultas como `getLegalMoves` e `getEffectTargets` usam a mesma lógica que valida comandos, evitando regras duplicadas no frontend.

O Comitê 2 precisará de uma implementação mínima testada do motor e do controlador local após a aprovação do mockup para entregar modo local utilizável. Não deve simular regras nos componentes. O Comitê 3 completa cobertura, robustez e rede, revisando essa implementação. Essa divisão resolve a dependência entre “modo local funcional” no Comitê 2 e “finalizar o motor” no Comitê 3.

## 7. Ações, eventos e protocolo online

### Comandos aceitos pelo motor

| Ação | Dados | Quando aceita |
| --- | --- | --- |
| `DRAW_CARD` | pessoa | `awaiting-draw`, jogador atual |
| `MOVE` | pessoa, origem, destino, promoção quando exigida | `moving`, peça da cor controlada, movimento válido |
| `ADD_PAWN` | pessoa, casa | `adding-pawns`, alvo livre permitido |
| `ADD_QUEEN` | pessoa, casa | `adding-queen`, alvo livre permitido |
| `SKIP_EFFECT` | pessoa | somente efeitos +2/+4 |

`REVERSE`, `END_TURN` e `GAME_OVER` são **eventos derivados**, não comandos livres recebidos do adversário. Isso impede que uma mensagem isolada troque cores, termine um turno numérico ou declare vitória arbitrariamente.

Eventos principais: `CARD_DRAWN`, `PIECE_MOVED`, `PIECE_CAPTURED`, `PIECE_PROMOTED`, `COLORS_SWAPPED`, `PIECE_ADDED`, `EFFECT_SKIPPED`, `NO_SPACE`, `NO_LEGAL_MOVES`, `TURN_ENDED`, `GAME_OVER`. Usar códigos/dados; o frontend escreve as mensagens em português. Uma transição pode emitir vários eventos, mas incrementa a revisão apenas uma vez.

### Sessão, sinalização e transporte

- Online: P1 cria sala; P2 entra usando código ou convite. Os jogadores não fazem cadastro. A conta de quem hospeda infraestrutura, se necessária, não é uma conta dos jogadores.
- Sinalização apenas para presença e troca de SDP/ICE, com sala de duas vagas, expiração, reserva atômica de vagas e códigos gerados de forma criptograficamente aleatória. Exemplo visual de seis caracteres não obriga comprimento inseguro; comprimento, TTL e limites serão fechados na implementação.
- Não transmitir tabuleiro ou ações pelo signaling depois que o DataChannel estiver pronto. SDP e ICE são dados temporários de conexão, sem áudio/vídeo.
- DataChannel confiável e ordenado; mensagens pequenas em JSON. Protocolo separado e versionado.
- Criador envia `INIT` com identificador de sessão, seed, configuração, versões e hash inicial. O outro cria o estado localmente, verifica e responde `READY`; o criador confirma `START`. Sem jogo antes desse handshake.
- Mensagens de jogo: `ACTION`, `ACK`, `SYNC_CHECK`, `ERROR`; handshake usa `INIT`, `READY`, `START`. Desconexão é tratada pelo transporte.
- `ACTION` inclui sessão, revisão base, revisão seguinte, ação e hash antes/depois. Cada lado executa o mesmo reducer; o receptor recalcula o resultado e compara ambos os hashes antes de confirmar.
- Apenas uma ação fica em trânsito por vez. O remetente mostra “confirmando” e bloqueia novas ações até `ACK`. O receptor libera a interação somente depois de validar e confirmar. Retransmissão idêntica pode receber novamente o ACK sem executar a ação duas vezes.
- Revisão duplicada com conteúdo diferente, salto de revisão, ator diferente do peer associado, campo desconhecido, versão incompatível, payload excessivo ou jogada impossível são rejeitados. Mensagens inválidas nunca são aplicadas parcialmente.
- Definir limite inicial de 16 KiB por mensagem e validação de esquema em runtime. TypeScript não valida JSON recebido. Validar IDs, casas, inteiros, enums e configuração antes de acessar/aplicar dados.
- Em divergência, suspender entradas e informar falha de sincronização. Não sobrescrever silenciosamente um cliente com o estado do outro. Novo jogo é recuperação suficiente no MVP.

### Hash e determinismo

Serialização canônica com ordem explícita de campos, casas a1…h8, catálogo de peças ordenado por ID, cartas na ordem dos montes e configuração normalizada. Incluir todos os campos que afetam regras: RNG, contadores, direitos, en passant, fase/saldos, cores, jogador, carta, vencedor e IDs. Excluir seleção visual, orientação, animações, feed, tempo, conexão e texto de mensagens.

Calcular SHA-256 dessa representação na camada de sincronização; o reducer continua síncrono e testável em Node. Comparar hash na inicialização e em cada ação/ACK; um `SYNC_CHECK` também pode ocorrer após restabelecer transporte. A ordenação para IDs deve ser fixa, sem `localeCompare` dependente de locale.

A detecção encontra divergências e ações impossíveis; não é proteção competitiva contra navegador modificado. Seed compartilhada permite prever cartas ao inspecionar o cliente. Fairness criptográfica está fora do MVP.

### Falhas e ciclo de vida

| Situação | Comportamento proposto |
| --- | --- |
| Sala inválida/expirada | Mensagem específica; permitir corrigir código ou criar outra sala. |
| Sala cheia | Recusar terceiro participante; não substituir peer existente. |
| Negociação pendente | Mostrar progresso e permitir cancelar; timeout configurado na camada de rede. |
| P2P falhou | Explicar falha de conexão e oferecer nova tentativa; nunca abrir partida unilateral. |
| Desconexão transitória | Pausar novas ações; aguardar recuperação da mesma conexão por janela limitada (proposta: 20 s). |
| Canal recuperado | Reconciliar ACK pendente/revisões e hashes antes de liberar; se não for inequívoco, encerrar sessão com erro. |
| Falha definitiva | Encerrar sessão online sem declarar vitória por desconexão. Mostrar motivo e opção de nova partida. |
| Refresh/fechamento | Estado e identidade efêmera são perdidos; não prometer retomada. |
| Dois peers perdidos | Partida perdida, conforme permitido pelo escopo. |

Não há reconexão persistente, retomada em outro dispositivo, migração de host ou restauração por código no MVP. Um erro de rede encerra a sessão, mas não fabrica `GAME_OVER` por captura do rei no domínio.

## 8. Hospedagem, privacidade e custo

Frontend estático público por HTTPS; estados locais/online apenas na memória dos navegadores. Sem banco de partidas, usuários, cookies de identidade persistente, `localStorage`, IndexedDB ou analytics de partidas. Atualizar a página perde o jogo. Logs de aplicação não devem gravar estado, jogadas, códigos, SDP ou ICE; logs operacionais do provedor precisam ser avaliados separadamente e não podem ser prometidos como inexistentes.

**Nenhum provedor foi escolhido ou teve gratuidade validada nesta etapa.** A validação de preço, cartão obrigatório, cotas e condições atuais ocorrerá no Comitê 3, antes da decisão de deploy. Não há garantia de custo zero baseada em informação antiga.

Critérios de seleção: frontend gratuito para o uso inicial; signaling efêmero com duas vagas e TTL; ausência de histórico; sem cobrança automática; documentação de limites; possibilidade de implantação por quem mantém o projeto sem exigir conta dos jogadores. Preferir serviços gerenciados que cumpram isso; caso contrário, avaliar um pequeno serviço dedicado exclusivamente à sinalização, sem lógica de jogo.

STUN não garante conexão em todas as redes. TURN poderá ser necessário e retransmitirá o DataChannel, mesmo que as regras continuem executadas nos navegadores. Pesquisar free tier de TURN e suas cotas; credenciais temporárias exigem emissão segura, sem segredo administrativo no frontend. Se não houver opção gratuita adequada, apresentar a limitação e as alternativas antes de publicar; não trocar silenciosamente o modelo de rede nem ativar cobrança.

Não há bloqueio de infraestrutura para aprovar regras e arquitetura. O aceite final online exige demonstrar dois navegadores/dispositivos usando uma URL pública e informar se a conexão testada foi direta ou retransmitida. Um teste somente em localhost não satisfaz esse aceite.

## 9. Estratégia de testes e critérios de aceite

Regras devem ser testadas em Node sem React ou navegador. Fixtures usam posições mínimas explícitas, IDs, fase, configuração e seed conhecidas. Comparar estado completo em rejeições, evitando testes que apenas repitam a implementação.

| Grupo | Casos obrigatórios |
| --- | --- |
| Inicialização | 32 peças, casas corretas, IDs únicos, reis presentes, direitos de roque, cores distintas e primeiro jogador. |
| Seis peças | Geometria válida/inválida, limites, colisões, cavalo saltando, captura inimiga, proibição de captura própria. |
| Peões | Direção por cor, captura diagonal, avanço bloqueado, avanço duplo com casa intermediária ocupada, duplo só antes do primeiro movimento. |
| Rei e ameaça | Mover para ameaça, permanecer ameaçado, reis adjacentes, captura do rei mesmo com rei próprio ameaçado. |
| Vitória | Identidade do capturador após Reverse; termina no primeiro/segundo movimento de carta 3; rejeita ações posteriores. |
| Roque | Ambos os lados/cores, b1/b8 ocupada, rei/torre que saiu e voltou, torre capturada, torre promovida, casas ameaçadas permitidas, custo de uma ação. |
| En passant | Ambas as cores; remoção da peça correta; imediato entre turnos; expiração por movimento da mesma carta; expiração por cada carta especial; inválidas preservam janela. |
| Promoção | Quatro escolhas por cor, com/sem captura, escolha ausente ou indevida rejeitada, mesmo ID, proibição de repetir a promovida na carta, captura do rei na promoção. |
| Cartas numéricas | Exatamente 1/2/3 ações com peças distintas; inválida não consome saldo; não pode pular; sem peças elegíveis encerra com evento; roque utiliza os IDs de rei e torre. |
| Bloqueio/Reverse | Nenhum movimento, alternância única, troca bijetiva, dois Reverse restauram controle, peças/direitos preservados, EP expira conforme política. |
| +2 | Zero/uma/duas casas livres, ignorar, colocar uma e encerrar, máximo dois, ocupação proibida, cor após Reverse, peão criado com duplo/promoção. |
| +4 | Sem espaço, ignorar, qualquer casa inicial livre, apenas uma dama, múltiplas damas, cor após Reverse. |
| Combinações | Reverse após +2/+4; peças extras passam ao outro controlador; mesma cor age em turnos de pessoas diferentes. |
| Baralho | Quantidades e IDs, compra/descarte, reciclagem, seed zero, baralho de uma carta, sequência de especiais sem recursão automática. |
| Determinismo | Mesma seed/configuração/ações → mesmos estados e hashes; vetores fixos de RNG e shuffle; objeto com ordem de inserção diferente → mesmo hash. |
| Estado | Invariantes após cada ação de sequências longas válidas; posição anterior imutável; comandos inválidos deixam estado/RNG idênticos. |
| Protocolo | JSON malformado, payload excessivo, ator forjado, revisão duplicada/atrasada/futura, ACK perdido, versão/configuração incompatível, hash divergente. |
| Paridade | Reproduzir a mesma sequência em modo local e por duas sessões simuladas e comparar o estado após cada ação. |

Testes de interface, após mockup aprovado: teclado e foco; tabuleiro orientado por cor; promoção; casas válidas; saldo; mensagens compreensíveis; +2 parcial; +4 ignorado; Reverse; vitória; layout móvel; distinguir cor sem depender somente de cor visual. Online mantém orientação pela cor do jogador local; local acompanha a cor do jogador atual somente na fronteira de turno. Respeitar preferência de movimento reduzido.

No Comitê 3: validar em dois contextos de navegador e também em redes distintas, com falha de signaling, interrupção de canal e diagnóstico de TURN. A suíte automatizada deve cobrir o protocolo via transporte falso; a validação real de conectividade é complementar.

## 10. Revisão interna e handoff

### Problemas previstos e solução adotada

1. **Confundir pessoa e cor:** consultas centralizadas e testes após Reverse; proibir índices P1=brancas espalhados pelo código.
2. **Biblioteca tradicional bloquear captura do rei:** núcleo de movimentos próprio sem filtro de xeque.
3. **Turnos duplos após carta especial:** encerramento único no reducer; UI não despacha `END_TURN`.
4. **En passant durar por vários movimentos ou Reverse:** registro explícito e política de invalidação fechada.
5. **Roque reaparecer após promoção/retorno:** rastrear identidades originais e direitos monotônicos.
6. **Promoção deixar estado parcial na rede:** escolha faz parte da ação atômica.
7. **Carta exigir ação impossível:** fim automático justificado, sem declarar empate.
8. **RNG divergir:** somente transições válidas e embaralhamentos consomem RNG; revisão/hash incluem seu estado.
9. **Loop de Bloqueio/Reverse ou baralho especial:** cada compra é ação explícita, sem loop automático de turnos.
10. **Pessoas comprarem duas vezes ou agirem durante confirmação:** revisão global, uma ação pendente e autorização pelo peer.
11. **Perda de rede parecer vitória:** sessão e domínio separados; captura é a única vitória.
12. **Dependência entre frontend funcional e motor futuro:** Comitê 2 implementa regras necessárias em módulos puros após aprovar mockup; Comitê 3 finaliza/testa sem mover regras para componentes.

Revisão de escopo: sem login, banco, ranking, chat, relógio competitivo, IA adversária, espectador, replay, histórico, matchmaking ou anti-cheat competitivo. Sem persistência de partidas. Nenhuma dessas funções é necessária para o MVP.

### Aprovações e próximas etapas

- **Concluído:** Luis aprovou esta especificação, encerrando o Comitê 1.
- **Concluído:** Luis forneceu o mockup HTML e autorizou o início do Comitê 2; a revisão crítica consta em `comite-2.md`.
- **Comitê 2:** implementar frontend, controlador e modo local com regras fora do React; revisar visualmente e funcionalmente. Incluir as solicitações posteriores: animações, regras completas pelo botão ?, clique/toque e arraste.
- **Comitê 3:** revisar o handoff, completar motor e testes, implementar rede, verificar provedores atuais, realizar deploy e auditoria final.

As decisões de infraestrutura ficam pendentes de pesquisa pelo Comitê 3. A regra posterior de Luis proíbe repetir peça na mesma carta; as demais interpretações aprovadas permanecem válidas.

**Validação original do Comitê 1:** revisão documental de regras, transições, invariantes, contratos e dependências entre comitês. A implementação e os resultados posteriores estão registrados em `comite-2.md`.
