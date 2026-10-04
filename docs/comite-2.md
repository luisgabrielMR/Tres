# Comitê 2 — implementação local e handoff

## Autorização e revisão do trabalho recebido

Luis aprovou o Comitê 1, enviou o primeiro mockup HTML e autorizou o início da implementação. Pediu animações, alterou a regra para peças distintas por carta e, durante a implementação, solicitou um botão de interrogação com todas as regras e interação tanto por clique como por arraste.

O mockup original foi preservado em `mockup-original.html`. A implementação mantém papel quente, madeira, azul, tipografia e peças de aparência equivalente. Foram encontradas e corrigidas estas divergências:

1. A dica antiga permitia repetir peça. O motor, a marcação ✓ e o card de regras agora proíbem repetição.
2. O mockup sugeria restauração automática de estado a partir da sala em caso de divergência. Isso não foi implementado: o Comitê 1 exige pausar e detectar divergência, sem uma sala armazenando a partida.
3. A demonstração de promoção usava o mesmo peão novamente na carta. O jogo agora mantém a identidade da peça promovida e a marca como utilizada.
4. O HTML trazia somente a tela principal efetivamente exibida e dados fictícios. As telas inicial e de entrada foram construídas no mesmo estilo; criar/entrar indicam claramente que a conexão online ainda não existe, sem inventar códigos ou convites ativos.

## Implementado

Revisão posterior de Luis: +2 oferece até dois peões **ou dois movimentos**; +4 oferece uma dama **ou quatro movimentos**, sempre com peças diferentes. A escolha é exclusiva, sem troca depois de escolhida. Falta de espaço apenas desabilita a adição; ausência de ambas as possibilidades encerra o turno. Avisos e ações foram reunidos em cards, com título, ícone e instrução contextual. Regras versionadas como `tres-v3-effect-moves`.

- React/TypeScript/Vite; componentes de tabuleiro, cartas, cores, modais e regras reutilizáveis.
- Modo local com baralho determinístico e todos os efeitos das cartas.
- Chess Core sem restrição de xeque, com promoção, roque e en passant.
- Cada peça pode mover no máximo uma vez por carta, incluindo promoção e ambas as peças do roque.
- Tabuleiro orientado pela cor controlada pelo jogador atual, coordenadas, seleção, destinos, últimas jogadas e peças utilizadas.
- Clique/toque em origem e destino ou arraste com Pointer Events; cancelamento e soltura inválida não alteram o estado. Os dois caminhos usam os mesmos seletores e reducer.
- Botão **?** na tela inicial e na partida; card com movimentos das seis peças, capturas, turnos, cartas, movimentos especiais, vitória, exceções e distribuição do baralho.
- Animações de peças, compra de carta, Reverse, entrada de telas e vitória. A preferência `prefers-reduced-motion` desativa animações e transições.
- Navegação por setas no tabuleiro, foco visível, nomes acessíveis, diálogos nativos com foco contido, avisos de ações inválidas e confirmação ao sair.
- Layout responsivo; resumo de jogador/carta/saldo acima do tabuleiro no celular.
- Fontes empacotadas no site. Nenhuma partida é gravada no navegador ou servidor.

## Validação

- 51 testes de regras, incluindo escolha exclusiva em +2/+4, dois/quatro movimentos com peças distintas, saldo sem peças elegíveis, movimento alternativo sem espaço, impossibilidade das duas opções, captura imediata do rei e preservação de estado em ações inválidas.
- Sequências determinísticas de até 180 ações em quatro seeds verificam imutabilidade, correspondência tabuleiro/catálogo, reis, cores e conservação das 35 cartas.
- Verificação TypeScript estrita e build de produção.
- Revisão manual no navegador: início, compra, movimento, tentativa de repetir peça, teclado, regras, +2 parcial, +4 preto após Reverse, troca de cores, promoção para cavalo, vitória, Bloqueio e ausência de espaço.
- Arraste e clique verificados no navegador: e2 → e4 por arraste; d2 → d5 rejeitado sem gastar saldo; g1 → f3 por clique continuou funcionando.
- Revisão da alternativa de movimentos: +2 encerra após duas jogadas; +4 após quatro jogadas com pretas após Reverse. Contador de quatro movimentos revisado no celular, sem transbordamento horizontal. Capturas em `previews/escolha-carta.png` e `previews/quatro-movimentos-celular.png`.
- Viewports desktop e celular, incluindo 390 px e 320 px; sem transbordamento horizontal nos estados inspecionados. Isso não substitui teste em aparelhos físicos.

Os testes não comprovam implementação de multiplayer. A bancada visual é exclusiva de desenvolvimento e não é um modo de jogo publicado.

## Próximo comitê

O Comitê 3 deve revisar criticamente o motor e o handoff antes de implementar rede. Pendentes: validação JSON remota, protocolo/revisões/ACK, representação canônica e hash, signaling efêmero, DataChannel, falhas/reconexão, testes de paridade online/local, pesquisa atual de infraestrutura gratuita e deploy público.

Validar provedores, cotas e necessidade de cartão na data da decisão. STUN não garante conexão; avaliar TURN sem inserir segredo administrativo no frontend. Nenhum serviço foi contratado ou apresentado como gratuito sem essa verificação.

Referências de compatibilidade consultadas antes da instalação: [Vite 6](https://v6.vite.dev/guide/) e [migração do Vitest](https://vitest.dev/guide/migration.html). As versões efetivas e seus requisitos foram conferidos nos pacotes instalados e estão fixados no lockfile.
