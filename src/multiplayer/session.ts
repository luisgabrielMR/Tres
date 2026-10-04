import { createGame, reduceGame } from '../core/tres/engine';
import { DEFAULT_RULES } from '../core/tres/deck';
import type { GameAction, GameError, GameEvent, GameState, PlayerId } from '../core/tres/types';
import { canonical, ENGINE, parseMessage, PROTOCOL, stateHash, validAction } from './protocol';
import type { Message } from './protocol';

export interface SessionView {
  state: GameState | null; recentEvents: GameEvent[]; lastEvents: GameEvent[]; error: GameError | null;
  status: 'handshake' | 'playing' | 'paused' | 'failed'; busy: boolean; notice: string;
}
// Transport-independent: the same class is exercised with two in-memory peers in tests.
export class GameSession {
  view: SessionView = { state: null, recentEvents: [], lastEvents: [], error: null, status: 'handshake', busy: true, notice: 'Conferindo as regras e o baralho…' };
  private id = '';
  private hash = '';
  private stage = 'new';
  private pending: Extract<Message, { type: 'ACTION' }> | null = null;
  private lastRemote = '';
  private lastAck = '';
  private queue = Promise.resolve();
  private queued = 0;
  private operation = false;
  constructor(readonly player: PlayerId, private transmit: (raw: string) => void, private changed: (view: SessionView) => void) {}
  private publish() { this.changed({ ...this.view }); }
  private emit(message: Message) { this.transmit(JSON.stringify(message)); }
  private stamp() { return { session: this.id, revision: this.view.state!.revision, hash: this.hash }; }
  private commit(state: GameState, events: GameEvent[]) {
    this.view = { ...this.view, state, error: null, lastEvents: events, recentEvents: [...this.view.recentEvents, ...events].slice(-30) };
  }
  private live() { return this.view.status !== 'failed'; }
  async start(seed: number, id: string) {
    if (this.player !== 'p1' || this.stage !== 'new') return;
    this.stage = 'preparing'; this.id = id;
    const state = createGame(seed);
    const hash = await stateHash(state);
    if (!this.live()) return;
    this.hash = hash; this.view.state = state; this.stage = 'init';
    this.emit({ type: 'INIT', ...this.stamp(), seed, protocol: PROTOCOL, engine: ENGINE, rules: DEFAULT_RULES });
    this.publish();
  }
  receive(raw: unknown): Promise<void> {
    if (!this.live()) return Promise.resolve();
    // Bound pending work before async hashing; reject binary data and malformed JSON early.
    let message: Message;
    try { message = parseMessage(raw); } catch { this.fail('Mensagem inválida ou versão incompatível. Crie uma nova partida.'); return Promise.resolve(); }
    if (++this.queued > 32) { this.queued--; this.fail('Muitas mensagens recebidas. A partida foi interrompida.'); return Promise.resolve(); }
    this.queue = this.queue.then(async () => {
      try { if (this.live()) await this.handle(message); }
      catch { this.fail('Os jogos perderam a sincronização. Nenhum estado remoto será imposto; iniciem uma nova partida.'); }
      finally { this.queued--; }
    });
    return this.queue;
  }
  private async handle(m: Message) {
    if (m.type === 'INIT') {
      if (this.player !== 'p2' || this.stage !== 'new') throw new Error();
      this.stage = 'preparing';
      const state = createGame(m.seed), hash = await stateHash(state);
      if (!this.live()) return;
      if (hash !== m.hash) throw new Error();
      this.id = m.session; this.hash = hash; this.view.state = state; this.stage = 'ready';
      this.emit({ type: 'READY', ...this.stamp() }); this.publish(); return;
    }
    if (m.session !== this.id) throw new Error();
    if (m.type === 'LEAVE') { this.fail('O adversário saiu. A partida terminou sem declarar vencedor.', false); return; }
    if (m.type === 'ERROR') { this.fail('O outro navegador detectou uma falha. Iniciem uma nova partida.', false); return; }
    const matches = () => m.revision === this.view.state?.revision && m.hash === this.hash;
    if (m.type === 'READY' || m.type === 'START') {
      if (!matches() || (m.type === 'READY' ? this.player !== 'p1' || this.stage !== 'init' : this.player !== 'p2' || this.stage !== 'ready')) throw new Error();
      this.stage = 'started';
      if (m.type === 'READY') this.emit({ type: 'START', ...this.stamp() });
      this.view = { ...this.view, status: 'playing', busy: false, notice: 'Conectados. Boa partida!' }; this.publish(); return;
    }
    if (this.stage !== 'started' || !this.view.state) throw new Error();
    if (m.type === 'ACTION') {
      const signature = canonical(m);
      if (signature === this.lastRemote) { this.emit({ type: 'ACK', session: this.id, revision: m.revision, hash: m.hash }); return; }
      if (this.operation || this.pending || m.action.actor === this.player || m.base !== this.view.state.revision || m.before !== this.hash) throw new Error();
      const result = reduceGame(this.view.state, m.action);
      if (!result.ok) throw new Error();
      const hash = await stateHash(result.state);
      if (!this.live()) return;
      if (m.hash !== hash) throw new Error();
      this.hash = hash; this.lastRemote = signature; this.commit(result.state, result.events);
      this.emit({ type: 'ACK', ...this.stamp() }); this.publish(); return;
    }
    if (m.type === 'ACK') {
      if (!this.pending && canonical(m) === this.lastAck) return;
      if (!this.pending || !matches()) throw new Error();
      this.lastAck = canonical(m); this.pending = null;
      this.view.busy = this.view.status !== 'playing'; this.publish(); return;
    }
    if (m.type === 'SYNC_CHECK' || m.type === 'SYNC_OK') {
      if (!matches() || this.operation) throw new Error();
      if (m.type === 'SYNC_CHECK') this.emit({ type: 'SYNC_OK', ...this.stamp() });
      else if (this.view.status === 'paused') {
        this.pending = null; this.view = { ...this.view, status: 'playing', busy: false, notice: 'Conexão recuperada; estados conferidos.' }; this.publish();
      }
    }
  }
  async dispatch(action: GameAction) {
    if (this.view.status !== 'playing' || this.view.busy || this.operation || !this.view.state || action.actor !== this.player || !validAction(action)) return;
    const result = reduceGame(this.view.state, action);
    if (!result.ok) { this.view.error = result.error; this.publish(); return; }
    this.operation = true; this.view.busy = true; this.publish();
    try {
      const base = this.view.state.revision, before = this.hash;
      const hash = await stateHash(result.state);
      if (!this.live()) return;
      this.hash = hash; this.commit(result.state, result.events);
      this.pending = { type: 'ACTION', ...this.stamp(), base, before, action };
      this.emit(this.pending); this.publish();
    } catch { this.fail('Não foi possível enviar a jogada. A partida foi interrompida.'); }
    finally { this.operation = false; }
  }
  pause() {
    if (this.view.status !== 'playing') return;
    this.view = { ...this.view, status: 'paused', busy: true, notice: 'Conexão interrompida. Aguardando até 20 segundos para recuperar…' }; this.publish();
  }
  resume() { if (this.view.status === 'paused' && !this.operation) this.emit({ type: 'SYNC_CHECK', ...this.stamp() }); }
  fail(notice: string, notify = true) {
    if (!this.live()) return;
    this.view = { ...this.view, status: 'failed', busy: true, notice };
    if (notify && this.id) { try { this.emit({ type: 'ERROR', session: this.id }); } catch { /* Canal já indisponível. */ } }
    this.publish();
  }
  leave() { if (this.id && this.live()) { try { this.emit({ type: 'LEAVE', session: this.id }); } catch { /* Saída local sempre funciona. */ } } this.fail('Você saiu da partida.', false); }
}
