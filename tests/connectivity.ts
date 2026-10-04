import { rtcConfig } from '../src/multiplayer/ice';
// Development-only diagnostic; this page is not included in the production build.
const output = document.querySelector<HTMLPreElement>('#result')!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>('button')];
async function run(relay: boolean) {
  buttons.forEach(b => { b.disabled = true; });
  output.textContent = 'Preparando…\n';
  const log = (value: string) => { output.textContent += `${value}\n`; };
  const peers: RTCPeerConnection[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const config = await rtcConfig();
    if (relay) {
      if (!config.iceServers?.some(server => [server.urls].flat().some(url => /^turns?:/.test(url)))) throw new Error('TURN não configurado. Defina VITE_ICE_SERVERS_URL e reinicie o Vite.');
      config.iceTransportPolicy = 'relay';
    }
    const a = new RTCPeerConnection(config), b = new RTCPeerConnection(config);
    peers.push(a, b);
    const queues: RTCIceCandidateInit[][] = [[], []];
    for (const [index, peer] of peers.entries()) {
      const other = peers[1 - index];
      peer.onicecandidate = event => {
        if (!event.candidate) return;
        log(`Navegador ${index + 1}: candidato ${event.candidate.type}`);
        if (other.remoteDescription) void other.addIceCandidate(event.candidate).catch(() => log('Falha ao aplicar candidato.'));
        else queues[1 - index].push(event.candidate.toJSON());
      };
      peer.onicecandidateerror = event => log(`Servidor ICE: código ${event.errorCode}`);
      peer.onconnectionstatechange = () => log(`Navegador ${index + 1}: ${peer.connectionState}`);
    }
    const done = new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Tempo de conexão esgotado (35 s).')), 35_000);
      b.ondatachannel = ({ channel }) => {
        channel.onmessage = event => { if (event.data === 'tres-ping') channel.send('tres-pong'); };
      };
      const channel = a.createDataChannel('tres-connectivity');
      channel.onopen = () => channel.send('tres-ping');
      channel.onmessage = event => { if (event.data === 'tres-pong') resolve(); };
    });
    // Attach rejection handling before the asynchronous SDP exchange.
    const completion = done.then(() => true, error => { log(String(error)); return false; });
    await a.setLocalDescription(await a.createOffer());
    await b.setRemoteDescription(a.localDescription!);
    for (const candidate of queues[1].splice(0)) await b.addIceCandidate(candidate);
    await b.setLocalDescription(await b.createAnswer());
    await a.setRemoteDescription(b.localDescription!);
    for (const candidate of queues[0].splice(0)) await a.addIceCandidate(candidate);
    if (await completion) {
      const stats = await a.getStats();
      stats.forEach(report => {
        if (report.type !== 'transport' || !report.selectedCandidatePairId) return;
        const pair = stats.get(report.selectedCandidatePairId);
        log(`Rota: ${stats.get(pair.localCandidateId)?.candidateType} / ${stats.get(pair.remoteCandidateId)?.candidateType}`);
      });
      log('SUCESSO: mensagem recebida e resposta confirmada.');
    } else log('FALHA: nenhuma mensagem recebida.');
  } catch (error) { log(String(error)); }
  finally { clearTimeout(timer); peers.forEach(peer => peer.close()); buttons.forEach(b => { b.disabled = false; }); }
}
document.querySelector('#direct')!.addEventListener('click', () => { void run(false); });
document.querySelector('#relay')!.addEventListener('click', () => { void run(true); });
