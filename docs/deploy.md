# Publicação e infraestrutura — 04/10/2026

## Situação real

**Publicado:** https://luisgabrielmr.github.io/Tres/

Deploy do commit `90c1a71` concluído em 04/10/2026: [execução 37223280120](https://github.com/luisgabrielMR/Tres/actions/runs/37223280120). CI [37223264178](https://github.com/luisgabrielMR/Tres/actions/runs/37223264178) passou. Convite, cartas, cinco movimentos nos dois sentidos e saída foram verificados pela URL HTTPS em duas abas na mesma máquina; rota direta, sem erros no console do convidado. Evidência: `previews/publicado-online.png`.
O remoto é `https://github.com/luisgabrielMR/Tres.git`. Após autorização explícita de Luis, a API confirmou repositório privado, conta GitHub Free e acesso administrativo. A autenticação existente foi usada somente em memória, sem exibir ou salvar o token. Luis confirmou explicitamente tornar o repositório público; a mudança foi aplicada antes do push. Pages está com HTTPS obrigatório e build por workflow. Nenhuma contratação ou alteração de plano foi feita.

## Opção preparada: GitHub Pages

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) está disponível para repositórios públicos no GitHub Free. Os jogadores não precisam de conta; quem administra a publicação precisa de acesso ao repositório. Não alterar a visibilidade de um repositório privado sem decisão explícita do proprietário.

1. Autorizar o acesso ao repositório pelo conector GitHub ou usar uma sessão autenticada normal de administração. Não enviar tokens pelo chat.
2. Publicar o código revisado no repositório, depois de autorizado o commit/push.
3. Em Settings → Pages, escolher GitHub Actions como fonte. Se o serviço solicitar cartão, assinatura ou mudança de plano, parar e reavaliar o caminho gratuito.
4. Executar manualmente o workflow **Publicar no GitHub Pages**. Ele instala com lockfile, testa, compila para o subdiretório informado pelo próprio Pages e publica somente `dist/`.
5. Abrir a URL retornada pelo workflow. Ela ainda não deve ser apresentada como URL funcional antes desse passo.
6. Em duas redes/dispositivos diferentes, criar/entrar por convite, confirmar jogadas nos dois sentidos, Reverse, +2/+4 e saída. Registrar se a UI informa conexão direta ou relay TURN.

O [workflow oficial de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) exige permissões de publicação e ambiente `github-pages`. CI de teste/build tem somente leitura. Os jobs de CI/deploy são bloqueados enquanto o repositório for privado, evitando consumo de minutos privados. O workflow de deploy é manual; o artefato tem retenção de um dia. Runners Ubuntu padrão, sem serviços pagos.

GitHub informa que registra endereços IP de visitantes para segurança. O Três não grava partidas, mas não promete ausência de logs operacionais de terceiros.

## Sinalização

[PeerJS Cloud](https://peerjs.com/client/faq) oferece sinalização gratuita. Cliente PeerJS fixado em 1.5.5; nenhuma chave ou conta é exigida pelo código. A criação registra `tres3-<código aleatório>` e o convidado negocia WebRTC com esse ID. Ações e hashes passam exclusivamente pelo DataChannel.

O ID único é reservado no PeerServer. A única vaga de convidado é reservada sincronicamente no navegador criador; terceiros são recusados. Isso substitui a proposta de uma reserva central de sala, evitando um backend próprio: não há sala persistente nem lógica de jogo no servidor. A sala vazia expira após dez minutos, a negociação após trinta segundos e fechar a página perde a sala. Um candidato que ocupe a vaga e não conclua a conexão faz a tentativa expirar; o criador deve gerar outro convite. Não é um serviço resistente a ataques direcionados.

Não foi encontrada garantia contratual de disponibilidade/capacidade do serviço comunitário. O aplicativo limita mensagens a 16 KiB, fila a 32 e apenas uma jogada em trânsito. O serviço ainda recebe os identificadores de conexão e SDP/ICE; não recebe tabuleiro, cartas ou histórico pelo nosso protocolo. Logs do operador estão fora do controle deste repositório.

## STUN e TURN

Padrão atual: Google STUN, **sem TURN configurado**. A configuração substitui explicitamente os TURN antigos incluídos no PeerJS: o projeto [anunciou o encerramento desse serviço gratuito](https://github.com/orgs/peers/discussions/1172). A presença de endereços no pacote não comprova que o serviço funcione.

Alternativa pesquisada: [Open Relay/Metered](https://www.metered.ca/tools/openrelay/) anuncia 20 GB/mês gratuitos e requer conta para obter acesso pela API. A [página de sinalização do mesmo provedor](https://www.metered.ca/tools/openrelay/webrtc-signaling-server/) anuncia a oferta gratuita sem cartão e sem excedentes para sua plataforma, incluindo relay. **Não houve cadastro, aceitação de termos ou validação do painel/cotas neste projeto.** Reconfirmar as condições na ativação; não habilitar plano pago ou cobrança automática.

O cliente aceita `VITE_ICE_SERVERS_URL`: endpoint HTTPS que devolve um `RTCIceServer[]` com credenciais de TURN temporárias. Exemplo estrutural, não funcional:

```json
[{"urls":["turns:turn.example.org:443?transport=tcp"],"username":"temporario","credential":"credencial-temporaria"}]
```

A chave administrativa da API do provedor deve ficar em um emissor serverless seguro e nunca em `VITE_*`, Git, URL do convite ou código do navegador. A emissão deve limitar duração e uso segundo o plano gratuito contratado. Nenhum emissor foi publicado: depende da conta autorizada e do mecanismo de credenciais escolhido. Configurar somente a URL pública do emissor na variável de repositório `VITE_ICE_SERVERS_URL`; o workflow a passa ao Vite. A variável vazia mantém o modo direto/STUN.

Se o endpoint configurado falhar, o aplicativo informa erro; não esconde a perda do relay. A validação final de TURN exige uma conexão com política `relay` em bancada ou redes em que o candidato selecionado seja `relay`, mais conferência da cota real do provedor. Os testes atuais confirmaram rota direta na mesma máquina, tanto em localhost quanto na URL pública. Não garantem conectividade entre NATs restritos, redes corporativas ou operadoras móveis.

## Aceite ainda pendente

- Concluído: acesso autorizado, commit/push, visibilidade pública e publicação HTTPS verificada.
- Revisão das condições reais da conta/free tier de TURN e emissão segura de credenciais, se adotado.
- Teste usando URL pública e dois dispositivos/redes; teste de relay separado.
- A publicação foi verificada; testes em uma única máquina não substituem o aceite entre redes nem o teste de TURN.
