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

Publicação configurada com o endpoint Metered fornecido por Luis, incluindo TURN/TLS. Instalações sem `VITE_ICE_SERVERS_URL` continuam usando somente Google STUN. A configuração substitui explicitamente os TURN antigos incluídos no PeerJS: o projeto [anunciou o encerramento desse serviço gratuito](https://github.com/orgs/peers/discussions/1172). A presença de endereços no pacote não comprova que o serviço funcione.

Alternativa pesquisada: [Open Relay/Metered](https://www.metered.ca/tools/openrelay/) anuncia 20 GB/mês gratuitos e requer conta para obter acesso pela API. A [página de sinalização do mesmo provedor](https://www.metered.ca/tools/openrelay/webrtc-signaling-server/) anuncia a oferta gratuita sem cartão e sem excedentes para sua plataforma, incluindo relay. **Luis criou a conta e a credencial; o agente não contratou plano pago. O painel de cotas/cobrança não foi acessado pelo agente.** Reconfirmar as condições na ativação; não habilitar plano pago ou cobrança automática.

O cliente aceita `VITE_ICE_SERVERS_URL`: endpoint HTTPS que devolve um `RTCIceServer[]` com credenciais de TURN temporárias. Exemplo estrutural, não funcional:

```json
[{"urls":["turns:turn.example.org:443?transport=tcp"],"username":"temporario","credential":"credencial-temporaria"}]
```

A chave administrativa da API do provedor, caso utilizada, deve ficar em um emissor serverless seguro e nunca em `VITE_*`, Git, URL do convite ou código do navegador. A emissão deve limitar duração e uso segundo o plano gratuito contratado. Nenhum emissor foi publicado: depende da conta autorizada e do mecanismo de credenciais escolhido. Configurar somente a URL pública do emissor na variável de repositório `VITE_ICE_SERVERS_URL`; o workflow a passa ao Vite. A variável vazia mantém o modo direto/STUN.

Se o endpoint configurado falhar, o aplicativo informa erro; não esconde a perda do relay. A validação final de TURN exige uma conexão com política `relay` em bancada ou redes em que o candidato selecionado seja `relay`, mais conferência da cota real do provedor. Os testes confirmaram rota direta na mesma máquina e, após ativação, ping/pong real com política obrigatória relay e par relay/relay na bancada localhost (imagem `previews/turn-validado.png`). Não garantem conectividade entre NATs restritos, redes corporativas ou operadoras móveis.

## Aceite ainda pendente

- Concluído: acesso autorizado, commit/push, visibilidade pública e publicação HTTPS verificada.
- Confirmação da cota real e ausência de cobrança no painel da conta criada por Luis; a integração não contrata nem altera planos.
- Teste usando URL pública e dois dispositivos/redes. Teste de relay separado concluído em bancada.
- A publicação e o relay foram verificados separadamente; testes em uma única máquina não substituem o aceite entre redes.

## Investigação de conexão — 04/10/2026

Luis relatou falha no mesmo PC/Wi-Fi entre uma janela normal e outra anônima. O erro anterior associava qualquer timeout de negociação a TURN, sem evidência. Agora diferencia indisponibilidade do serviço de salas, falha na conexão dos navegadores e timeout de preparação depois de abrir o canal. Não foi confirmada a causa no navegador de Luis.

Repetição na URL pública: duas abas do navegador integrado conectaram diretamente. Isso não reproduz nem valida o perfil anônimo do navegador do usuário. Bancada local com dois RTCPeerConnections trocou ping/pong pela rota host/host. Teste isolado com política relay no endpoint público `staticauth.openrelay.metered.ca` (portas UDP 80/TCP 443 e autenticação pública documentada) não gerou candidatos relay, recebeu erro ICE 701 e expirou em 35 segundos. Isso prova a falha nessa bancada, não a indisponibilidade global do provedor. O endpoint não foi incorporado ao jogo.

### Ativar Open Relay sem backend adicional

A [documentação atual do Metered](https://www.metered.ca/docs/turn-server-service/quickstart/) distingue a chave pública limitada a **uma credencial TURN** da **Secret key administrativa** da conta. A primeira pode ser usada no frontend para buscar ICE; a segunda jamais deve ser publicada. Isso permite usar o endpoint do provedor diretamente, sem criar um emissor próprio, quando a credencial/plano escolhido permitir.

1. O proprietário cria a conta no plano gratuito Open Relay. Reconfirmar no painel a cota de 20 GB/mês e ausência de cobrança/cartão; não contratar upgrades.
2. Em TURN Server & SFU → Credentials, criar credencial para Três. Aguardar até dois minutos pela propagação.
3. Get credential → Show API Key: chave limitada àquela credencial. Obter o domínio em Developers, sem copiar a Secret key dessa página.
4. Configurar a URL de Get TURN Credential em `.env.local` e na variável GitHub `VITE_ICE_SERVERS_URL`. O valor é incorporado ao JavaScript público; somente chave explicitamente publicável pode estar nessa URL.
5. Reiniciar Vite, abrir `http://127.0.0.1:5173/tests/connectivity.html` e clicar **Testar TURN configurado**. A bancada usa a mesma configuração do jogo, força `iceTransportPolicy: relay`, exige ping/pong e mostra os tipos de candidatos do par selecionado, sem IPs/credenciais. Essa página não entra no build público.
6. Só considerar TURN ativado após confirmar rota relay e troca de mensagens, publicar e testar em dispositivos/redes diferentes. O plano gratuito tem limites; nenhum serviço garante qualquer navegador/rede.

Luis criou a conta/credencial e preencheu os dados locais. A API aceitou a chave restrita à credencial (HTTP 200, cinco entradas, TURN e TURN/TLS, CORS *). A bancada confirmou relay/relay e ping/pong; configuração registrada na variável GitHub para publicação. O arquivo .env.local é ignorado pelo Git; o bundle público incorpora somente a URL com chave publicável, conforme documentação do provedor. Não foi alterado plano/cobrança pelo agente. Evidência: previews/turn-validado.png.
