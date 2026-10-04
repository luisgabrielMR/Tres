# Comitê 3 — implementação e auditoria

Iniciado por autorização de Luis em 04/10/2026. **Em andamento: deploy e validação externa pendentes.** As regras atuais incluem a alternativa de dois movimentos no +2 e quatro no +4, sem repetir peças.

## Revisão crítica do handoff

- Motor puro já cobria as seis peças e cartas. A revisão acrescentou casos de roque dos dois lados/nas duas cores, en passant branco com tentativa inválida e captura de rei por promoção na alternativa do +4.
- O frontend anterior alternava a orientação pela pessoa da vez e não distinguia usuário local. No online, a orientação acompanha `playerColors[localPlayer]`; mudar de turno não vira o tabuleiro, mas Reverse vira. Ações do outro jogador ficam bloqueadas na UI e no protocolo.
- A versão online usa o mesmo reducer, baralho, seed e política de en passant da versão local. Não há regras copiadas para componentes ou transporte.
- O aviso de ameaça no online deve se referir ao rei controlado pelo usuário local, e não ao jogador ativo remoto; isso foi ajustado.
- A documentação do PeerJS citava serialização `none`, mas o pacote 1.5.5 usa o enum `SerializationType.None`, cujo valor real é `raw`. O primeiro teste real revelou o erro; a integração foi corrigida usando o enum do pacote.
- O pacote inclui TURN comunitários desativados. A configuração foi substituída por STUN e suporte explícito a endpoint de credenciais TURN. Ver pesquisa e condições em `deploy.md`.

## Implementado

- Criar convite com código criptográfico de oito símbolos, copiar link, entrar pelo código/link, expiração, cancelamento, sala inexistente, sala cheia e falha de negociação.
- PeerJS apenas como adaptador de WebRTC/sinalização; DataChannel confiável e ordenado. Sem mídia, banco ou persistência.
- Handshake INIT → READY → START com seed, versões de protocolo/motor/regras, configuração e hash inicial. Cada pessoa constrói o próprio tabuleiro/baralho.
- JSON estrito: enums, casas, ator, campos obrigatórios/desconhecidos, limites de tamanho, sessão, revisão anterior/seguinte e hash SHA-256.
- ACTION executada pelo reducer dos dois lados; estado remoto completo nunca é aceito. Somente uma ação pendente de ACK; cliques adicionais ficam bloqueados. Duplicatas idênticas são confirmadas sem reaplicar.
- Hash canônico inclui estado completo de regras, inclusive catálogo de peças, direitos, en passant, RNG, carta, montes, saldos, identidade do jogador e cores; ignora somente campos `undefined`, sem dependência de locale.
- Mensagem inválida ou divergência interrompe a sessão, sem substituir estado local e sem conceder vitória por desconexão.
- Desconexão transitória da mesma PeerConnection pausa entradas por até 20 segundos. Ao recuperar, SYNC_CHECK/SYNC_OK exige igualdade de revisão e hash. Diferença não inequívoca encerra. Fechamento definitivo do canal encerra sem retomada; atualizar perde identidade.
- Limites: 16 KiB por mensagem, 32 mensagens enfileiradas, buffer de envio de 64 KiB, ACK de 20 segundos, convite vazio de dez minutos e negociação de trinta segundos.
- CI e publicação manual de site estático preparados; `.env.example` documenta configuração sem segredo administrativo.

## Evidência de validação

- 90 testes em Node aprovados: regras, protocolo, ciclo de vida e paridade de duas sessões independentes com motor local em três seeds e até 240 ações cada. A quantidade de ações depende de captura do rei.
- Testes de mensagens adulteradas, ação de ator errado, revisão/hash inválidos, ação impossível, configuração incompatível, duplicação, envio antes de ACK, pausa, recuperação, saída e estado preservado na rejeição.
- Temporizadores testados com relógio virtual para 30 segundos/10 minutos, slot único antes da abertura do canal e limpeza ao cancelar. Transportes simulados testam o controlador, não comprovam WebRTC real.
- Navegador real, build de produção em localhost: duas sessões conectaram ao PeerJS Cloud, rota indicada como **direta**; compra de cartas e movimentos nos dois sentidos foram sincronizados; terceiro jogador recebeu sala cheia; sair interrompeu o outro cliente e bloqueou novas ações. Captura visual: `previews/online-desktop.png`.
- Modo local continua disponível depois de sair do online. Revisão responsiva do online a 390 px (375 px úteis com barra de rolagem) confirmou ausência de transbordamento após corrigir o mínimo intrínseco da coluna do grid e a quebra da faixa de jogadores. Evidência em `previews/online-celular.png`. Essa revisão não equivale a testar todos os celulares/navegadores físicos.
- Build TypeScript/Vite e auditoria npm registrados na entrega. Nenhum teste comprovou ainda uma URL pública nem relay TURN.

## Decisões que refinam a proposta original

A vaga é reservada no navegador criador, enquanto o servidor somente reserva seu ID de sinalização. Isso atende duas pessoas sem desenvolver um serviço de salas. A limitação é explícita: não há retomada após perda do criador nem resistência a ocupação maliciosa da vaga.

Hashes são comparados em toda ação e na recuperação; não há timer periódico de comparação em estado ocioso. O transporte ordenado mais revisão/ACK é suficiente para este MVP. Há detecção de erros, não proteção competitiva: quem modifica o cliente consegue ler a seed e prever cartas.

A configuração de regras online precisa ser exatamente a mesma do build local. Ajustes de baralho continuam isolados em `deck.ts`, mas não existe edição arbitrária remota da configuração durante o handshake.

## Pendências para encerrar

Seguir `deploy.md`: verificação em redes/dispositivos distintos e definição/validação de TURN. Luis autorizou commit/push e uso da autenticação existente, condicionado a custo zero. A API confirmou repositório privado e conta Free; foi solicitada confirmação específica para tornar o código público antes de habilitar Pages.
