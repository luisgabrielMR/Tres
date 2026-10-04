import Peer, { SerializationType } from 'peerjs';
import type { DataConnection } from 'peerjs';
import { GameSession } from './session';
import type { SessionView } from './session';
import type { GameAction, PlayerId } from '../core/tres/types';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, '');
export const validCode = (code: string) => /^[A-HJ-NP-Z2-9]{8}$/.test(code);
export function roomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  // 32 symbols: every character gets exactly eight byte values.
  return Array.from(bytes, byte => ALPHABET[byte % 32]).join('');
}
const id = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
export interface OnlineView {
  stage: 'connecting' | 'waiting' | 'negotiating' | 'playing' | 'failed';
  code: string; player: PlayerId; message: string; game: SessionView | null;
  route: 'checking' | 'direct' | 'relay';
}

// Only short-lived ICE credentials may be returned by this endpoint. Never a provider API key.
async function rtcConfig(): Promise<RTCConfiguration> {
  const url = import.meta.env.VITE_ICE_SERVERS_URL;
  const config: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  if (url) {
    const parsed = new URL(url, location.href);
    if (parsed.protocol !== 'https:' && parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') throw new Error('ICE_CONFIG');
    const response = await fetch(parsed, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('ICE_CONFIG');
    const raw = await response.text();
    if (raw.length > 16_384) throw new Error('ICE_CONFIG');
    const servers: unknown = JSON.parse(raw);
    if (!Array.isArray(servers) || servers.length > 8 || servers.length < 1 || servers.some(s =>
      !s || typeof s !== 'object' || !Array.isArray(s.urls) && typeof s.urls !== 'string' ||
      ![s.urls].flat().every((u: unknown) => typeof u === 'string' && /^(stun|turn|turns):/.test(u)) ||
      s.username !== undefined && typeof s.username !== 'string' || s.credential !== undefined && typeof s.credential !== 'string')) throw new Error('ICE_CONFIG');
    config.iceServers = servers;
  }
  return config;
}

export class OnlineConnection {
  view: OnlineView;
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private session: GameSession | null = null;
  private stopped = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private connectionTimer?: ReturnType<typeof setTimeout>;
  private roomTimer?: ReturnType<typeof setTimeout>;
  private recoveryTimer?: ReturnType<typeof setTimeout>;
  private ackTimer?: ReturnType<typeof setTimeout>;
  private rejects = new Set<DataConnection>();
  constructor(private mode: 'create' | 'join', code: string, private changed: (view: OnlineView) => void) {
    this.view = { stage: 'connecting', code: mode === 'create' ? roomCode() : normalizeCode(code), player: mode === 'create' ? 'p1' : 'p2', message: 'Conectando ao serviço de sinalização…', game: null, route: 'checking' };
  }
  private publish() { if (!this.stopped) this.changed({ ...this.view }); }
  private later(fn: () => void, ms: number) { const timer = setTimeout(() => { this.timers.delete(timer); if (!this.stopped) fn(); }, ms); this.timers.add(timer); return timer; }
  private clear(timer?: ReturnType<typeof setTimeout>) { if (timer) { clearTimeout(timer); this.timers.delete(timer); } }
  async start() {
    this.publish();
    if (this.mode === 'join' && !validCode(this.view.code)) { this.fail('Use o código de 8 letras e números do convite.'); return; }
    try {
      const config = await rtcConfig();
      if (this.stopped) return;
      this.peer = new Peer(this.mode === 'create' ? `tres3-${this.view.code}` : `tres3-guest-${id()}`, { debug: 0, config, secure: true });
      this.connectionTimer = this.later(() => this.fail('A conexão demorou demais. Tente novamente; esta rede pode precisar de TURN.'), 30_000);
      this.peer.on('open', () => {
        if (this.stopped || this.view.stage === 'failed') return;
        if (this.mode === 'create') {
          this.clear(this.connectionTimer);
          this.view.stage = 'waiting'; this.view.message = 'Aguardando seu adversário. O convite expira em 10 minutos.';
          this.roomTimer = this.later(() => this.fail('O convite expirou. Crie uma nova partida.'), 600_000);
        } else {
          this.accept(this.peer!.connect(`tres3-${this.view.code}`, { reliable: true, serialization: SerializationType.None, label: 'tres-v1' }));
        }
        this.publish();
      });
      this.peer.on('connection', connection => {
        // First arrival reserves the only guest slot synchronously, before any await.
        if (this.mode !== 'create' || this.connection || this.view.stage !== 'waiting') { this.reject(connection); return; }
        this.accept(connection);
      });
      this.peer.on('call', call => call.close());
      this.peer.on('error', error => {
        if (this.session?.view.status === 'playing' || this.session?.view.status === 'paused') return;
        this.fail(error.type === 'peer-unavailable' ? 'Sala não encontrada ou expirada. Confira o código com seu amigo.' : error.type === 'unavailable-id' ? 'Este código já está em uso. Crie uma nova partida para gerar outro.' : 'Não foi possível conectar. Tente outra rede ou confira o serviço de conexão.');
      });
      this.peer.on('disconnected', () => { if (!this.connection?.open) this.fail('A sinalização foi interrompida. Crie ou entre novamente.'); });
    } catch { this.fail('Não foi possível preparar a conexão. Confira a rede e a configuração de TURN.'); }
  }
  private reject(connection: DataConnection) {
    if (this.rejects.size >= 3 || connection.serialization !== SerializationType.None) { connection.close(); return; }
    this.rejects.add(connection);
    const timer = this.later(() => { connection.close(); this.rejects.delete(connection); }, 5000);
    connection.on('error', () => { connection.close(); });
    connection.on('close', () => { this.clear(timer); this.rejects.delete(connection); });
    connection.on('open', () => { void connection.send('ROOM_FULL'); connection.close({ flush: true }); });
  }
  private accept(connection: DataConnection) {
    this.connection = connection;
    this.clear(this.roomTimer); this.clear(this.connectionTimer);
    this.view.stage = 'negotiating'; this.view.message = 'Encontramos a mesa. Estabelecendo conexão entre os navegadores…'; this.publish();
    this.connectionTimer = this.later(() => this.fail('Não foi possível estabelecer P2P. Tentem outra rede; algumas redes exigem um servidor TURN.'), 30_000);
    this.session = new GameSession(this.view.player, raw => {
      if (!connection.open || connection.dataChannel.bufferedAmount > 65_536) throw new Error('CONNECTION_LOST');
      void connection.send(raw);
    }, game => {
      if (this.stopped) return;
      this.view.game = game;
      if (game.status === 'playing' || game.status === 'paused') {
        this.view.stage = 'playing'; this.clear(this.connectionTimer);
        if (game.status === 'playing') { this.clear(this.recoveryTimer); this.recoveryTimer = undefined; }
        if (game.busy && game.status === 'playing' && !this.ackTimer) this.ackTimer = this.later(() => this.fail('A jogada não foi confirmada em 20 segundos. A partida foi interrompida.'), 20_000);
        if (!game.busy) { this.clear(this.ackTimer); this.ackTimer = undefined; }
      }
      if (game.status === 'failed') { this.fail(game.notice); return; }
      this.publish();
    });
    connection.on('data', data => {
      if (data === 'ROOM_FULL' && this.mode === 'join' && this.session?.view.status === 'handshake') { this.fail('Essa sala já tem dois jogadores. Peça outro convite.'); return; }
      void this.session?.receive(data);
    });
    connection.on('open', () => {
      if (this.stopped || this.view.stage === 'failed') { connection.close(); return; }
      if (connection.serialization !== SerializationType.None || !connection.dataChannel.ordered || connection.dataChannel.maxRetransmits !== null || connection.dataChannel.maxPacketLifeTime !== null) { this.fail('Canal incompatível. Atualizem a página e criem outra partida.'); return; }
      connection.peerConnection.addEventListener('connectionstatechange', () => this.connectionState());
      if (this.mode === 'create') void this.session!.start(crypto.getRandomValues(new Uint32Array(1))[0], id()).catch(() => this.fail('Falha ao iniciar a partida.'));
      void this.inspectRoute();
    });
    connection.on('close', () => this.fail('O adversário desconectou. A partida não pode ser retomada por código.'));
    connection.on('error', () => this.fail('O canal entre os jogadores falhou. Iniciem uma nova partida.'));
  }
  private connectionState() {
    const state = this.connection?.peerConnection.connectionState;
    if (state === 'disconnected') {
      this.session?.pause(); this.clear(this.ackTimer); this.ackTimer = undefined;
      if (!this.recoveryTimer) this.recoveryTimer = this.later(() => this.fail('A conexão não voltou em 20 segundos. Iniciem uma nova partida.'), 20_000);
    } else if (state === 'connected') { this.session?.resume(); void this.inspectRoute(); }
    else if (state === 'failed' || state === 'closed') this.fail('Conexão perdida. A partida foi interrompida, sem declarar vencedor.');
  }
  private async inspectRoute() {
    try {
      const stats = await this.connection?.peerConnection.getStats();
      if (!stats) return;
      stats.forEach(report => {
        if (report.type === 'transport' && report.selectedCandidatePairId) {
          const pair = stats.get(report.selectedCandidatePairId);
          if (pair) this.view.route = stats.get(pair.localCandidateId)?.candidateType === 'relay' || stats.get(pair.remoteCandidateId)?.candidateType === 'relay' ? 'relay' : 'direct';
        }
      });
      this.publish();
    } catch { /* Rota desconhecida não altera regras nem estado. */ }
  }
  dispatch(action: GameAction) { void this.session?.dispatch(action); }
  private fail(message: string) {
    if (this.stopped || this.view.stage === 'failed') return;
    this.view.stage = 'failed'; this.view.message = message;
    this.session?.fail(message, false);
    for (const timer of this.timers) clearTimeout(timer); this.timers.clear();
    this.publish(); this.peer?.destroy();
  }
  close() {
    if (this.stopped) return;
    this.stopped = true; this.session?.leave();
    for (const timer of this.timers) clearTimeout(timer); this.timers.clear();
    this.peer?.destroy();
  }
}
