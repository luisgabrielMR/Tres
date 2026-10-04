import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => {
  class Emitter {
    listeners = new Map<string, ((...args: any[]) => void)[]>();
    on(event: string, callback: (...args: any[]) => void) { this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]); }
    emit(event: string, ...args: any[]) { for (const callback of this.listeners.get(event) ?? []) callback(...args); }
  }
  class Connection extends Emitter {
    open = true; serialization = 'raw'; closed = false; sent: string[] = [];
    dataChannel = { ordered: true, maxRetransmits: null, maxPacketLifeTime: null, bufferedAmount: 0 };
    peerConnection = { connectionState: 'connected', addEventListener: () => {}, getStats: async () => new Map() };
    send(raw: string) { this.sent.push(raw); }
    close() { this.closed = true; }
  }
  class Peer extends Emitter {
    static instances: Peer[] = [];
    destroyed = false; outgoing = new Connection();
    constructor(readonly id: string, readonly options: unknown) { super(); Peer.instances.push(this); }
    connect() { return this.outgoing; }
    destroy() { this.destroyed = true; }
  }
  return { Peer, Connection };
});
vi.mock('peerjs', () => ({ default: fakes.Peer, SerializationType: { None: 'raw' } }));
import { OnlineConnection, normalizeCode, roomCode, validCode } from '../src/multiplayer/connection';
import type { OnlineView } from '../src/multiplayer/connection';

const connections: OnlineConnection[] = [];
function connection(mode: 'create' | 'join', code = 'ABCDEFGH') {
  let view: OnlineView | null = null;
  const result = new OnlineConnection(mode, code, next => { view = next; }); connections.push(result);
  return { result, view: () => view!, peer: () => fakes.Peer.instances.at(-1)! };
}
beforeEach(() => { vi.stubEnv('VITE_ICE_SERVERS_URL', ''); vi.useFakeTimers(); fakes.Peer.instances = []; });
afterEach(() => { connections.splice(0).forEach(c => c.close()); vi.useRealTimers(); vi.unstubAllEnvs(); });

it('códigos criptográficos são válidos e convites aceitam espaços/hífens', () => {
  for (let i = 0; i < 50; i++) expect(validCode(roomCode())).toBe(true);
  expect(normalizeCode(' abcd-efgh ')).toBe('ABCDEFGH'); expect(validCode('ABCD0IGH')).toBe(false);
});
it('código inválido falha antes de acessar sinalização', async () => {
  const c = connection('join', 'bad'); await c.result.start();
  expect(c.view().stage).toBe('failed'); expect(fakes.Peer.instances).toHaveLength(0);
});
it('expira espera de sinalização em 30 segundos e fecha recursos', async () => {
  const c = connection('create'); await c.result.start(); await vi.advanceTimersByTimeAsync(30_000);
  expect(c.view().stage).toBe('failed'); expect(c.peer().destroyed).toBe(true);
});
it('sala vazia expira em dez minutos, sem criar estado de partida', async () => {
  const c = connection('create'); await c.result.start(); c.peer().emit('open');
  await vi.advanceTimersByTimeAsync(599_999); expect(c.view().stage).toBe('waiting');
  await vi.advanceTimersByTimeAsync(1); expect(c.view().stage).toBe('failed'); expect(c.view().game).toBeNull();
});
it('reserva uma única vaga antes de abrir canal e recusa o terceiro participante', async () => {
  const c = connection('create'); await c.result.start(); c.peer().emit('open');
  const first = new fakes.Connection(), second = new fakes.Connection();
  c.peer().emit('connection', first); c.peer().emit('connection', second); second.emit('open');
  expect(second.sent).toEqual(['ROOM_FULL']); expect(second.closed).toBe(true);
  expect(first.closed).toBe(false); expect(c.view().stage).toBe('negotiating');
});
it('rejeita canal sem entrega ordenada, sem iniciar a partida', async () => {
  const c = connection('join'); await c.result.start(); c.peer().emit('open');
  c.peer().outgoing.dataChannel.ordered = false; c.peer().outgoing.emit('open');
  expect(c.view().stage).toBe('failed'); expect(c.view().game?.state ?? null).toBeNull();
});
it('cancelar remove todos os timers e não publica atualizações tardias', async () => {
  const c = connection('create'); await c.result.start(); const snapshot = c.view(); c.result.close();
  c.peer().emit('open'); await vi.advanceTimersByTimeAsync(600_000);
  expect(c.view()).toBe(snapshot); expect(c.peer().destroyed).toBe(true); expect(vi.getTimerCount()).toBe(0);
});
it('distingue falha ao conectar navegadores da demora em sincronizar uma partida já conectada', async () => {
  const disconnected = connection('join'); await disconnected.result.start(); disconnected.peer().emit('open');
  disconnected.peer().outgoing.open = false;
  await vi.advanceTimersByTimeAsync(30_000);
  expect(disconnected.view().message).toContain('A sala foi encontrada');
  expect(disconnected.view().message).not.toContain('TURN');
  const connected = connection('join'); await connected.result.start(); connected.peer().emit('open');
  connected.peer().outgoing.emit('open');
  await vi.advanceTimersByTimeAsync(30_000);
  expect(connected.view().message).toContain('Os navegadores se conectaram');
});
