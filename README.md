# Três

Xadrez nos movimentos. Cartas a cada turno. Uma aplicação React + TypeScript + Vite, sem contas ou persistência de partidas.

**Jogar:** https://luisgabrielmr.github.io/Tres/

## Estado da entrega

Comitê 1 aprovado. Comitê 2 implementado a partir do mockup HTML fornecido por Luis, incluindo a alteração **cada peça pode mover no máximo uma vez por carta**. Modo local funcional, com todas as cartas e movimentos especiais. Comitê 3 em andamento: multiplayer WebRTC implementado e testado em duas sessões no navegador, com sinalização pública PeerJS. Site publicado no GitHub Pages em 04/10/2026, com convite e movimentos nos dois sentidos verificados na URL pública. TURN Metered validado em bancada com conexão obrigatoriamente relay/relay e resposta confirmada; testes em redes/dispositivos distintos continuam pendentes.

## Executar

Node compatível: 20.17+, 22 ou 24+. Preferir uma versão LTS mantida ao preparar o deploy.

```sh
npm ci
npm run dev
```

Abra a URL local informada pelo Vite. Para uma partida no mesmo dispositivo, escolha **Jogar localmente**. Para jogar online, escolha **Criar partida**, envie o código de oito caracteres ou copie o convite; o outro jogador escolhe **Entrar em partida**. Clique em uma peça e no destino ou arraste e solte. O botão **?** abre as regras completas, desde a movimentação das peças até cada carta. Pelo teclado, use setas no tabuleiro e Enter para selecionar.

```sh
npm test
npm run build
npm run preview
```

O build gera `dist/`, contendo apenas o site estático. Fontes são distribuídas localmente junto com a aplicação. Nenhuma fonte externa ou serviço de rede é necessário para o modo local depois de carregar a página.

## Regras implementadas

- Vitória exclusivamente por captura do rei; ameaça não torna um movimento ilegal.
- Cartas 1/2/3 exigem peças distintas. Tentativas inválidas não gastam movimentos.
- Roque gasta um movimento e marca rei e torre como utilizados. Promoção preserva o ID e não libera outro movimento na carta.
- Bloqueio, Reverse, +2, +4, descarte e reembaralhamento determinístico.
- +2/+4 oferecem escolha exclusiva: adicionar até dois peões ou fazer dois movimentos no +2; adicionar uma dama ou fazer quatro movimentos no +4, sempre com peças diferentes. A falta de espaço não elimina a opção de mover. Escolher um caminho impede usar o outro na mesma carta.
- Reverse altera o controle das cores, nunca a cor/posição das peças.
- Sem movimentos elegíveis, o turno termina com aviso e sem empate.
- En passant expira no próximo movimento, na compra de carta especial ou no encerramento por ausência de movimentos.
- Partidas apenas em memória; sair, fechar ou atualizar perde a partida.

## Organização

- `src/core/chess`: posição e movimentos, sem React ou alternância própria de turnos.
- `src/core/tres`: cartas, RNG, configuração e transições puras de estado.
- `src/application`: controladores das sessões local e online.
- `src/multiplayer`: validação JSON, protocolo, SHA-256, sessões e transporte WebRTC.
- `src/ui`: telas, componentes, animações, interação por clique/arraste e regras visíveis.
- `tests/*.test.ts`: regras, invariantes, paridade online/local, protocolo e ciclo de vida da conexão, executados sem navegador.
- `tests/visual.html`: bancada de cenários para revisão manual no servidor de desenvolvimento; não entra em `dist/`.
- `docs/comite-1.md`: especificação aprovada e alteração posterior de Luis.
- `docs/mockup-original.html`: cópia integral do material enviado, preservada como referência histórica; pode conter regras antigas.
- `docs/comite-2.md`: handoff da implementação local.
- `docs/comite-3.md`: auditoria, decisões de rede e limitações verificadas.
- `docs/deploy.md`: publicação e infraestrutura gratuita pesquisada.

Configuração experimental do baralho em `src/core/tres/deck.ts`. Não existe opção para permitir reutilização de peça no MVP. A proibição é uma regra do motor.

## Limites desta versão

Sem conta, banco, histórico, ranking, chat, analytics ou armazenamento de partidas no navegador. Salas aguardam por até dez minutos; cada uma recebe somente dois jogadores. O primeiro participante reserva a vaga no navegador criador. Estados nunca são enviados pelo signaling.

A publicação usa PeerJS Cloud para sinalização e o endpoint Metered configurado em `VITE_ICE_SERVERS_URL` para STUN/TURN, incluindo TLS na porta 443. O navegador escolhe conexão direta ou retransmissão conforme a rede. A chave é limitada à credencial TURN e explicitamente publicável; nenhum segredo administrativo entra no frontend. Sem essa variável, uma instalação nova usa somente Google STUN. Consulte `docs/deploy.md`.

A recuperação é limitada à mesma conexão WebRTC durante 20 segundos, com conferência de estado. Refresh perde a identidade e a partida; um código não recupera uma sessão. Não há garantia de disponibilidade do serviço gratuito. Logs operacionais dos provedores são independentes do aplicativo.

CI e deploy executados com sucesso no GitHub. Repositório tornado público com autorização explícita de Luis, usando GitHub Free e runners padrão. TURN configurado com a credencial fornecida por Luis; nenhum plano pago foi ativado pelo agente. A oferta Open Relay anuncia 20 GB/mês gratuitos, sujeitos às condições/cotas do provedor.
