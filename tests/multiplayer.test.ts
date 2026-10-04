import { describe, expect, it } from 'vitest';
import { createGame, effectOptions, effectTargets, legalMoves, reduceGame } from '../src/core/tres/engine';
import { SQUARES } from '../src/core/chess/types';
import type { GameAction, GameState, PlayerId } from '../src/core/tres/types';
import { canonical, parseMessage, stateHash, validAction } from '../src/multiplayer/protocol';
import { GameSession } from '../src/multiplayer/session';

async function pair(seed = 19) {
  const toHost: string[] = [], toGuest: string[] = [];
  const host = new GameSession('p1', raw => toGuest.push(raw), () => {});
  const guest = new GameSession('p2', raw => toHost.push(raw), () => {});
  async function flush() {
    let count = 0;
    while (toHost.length || toGuest.length) {
      if (++count > 50) throw new Error('Message loop');
      if (toGuest.length) await guest.receive(toGuest.shift());
      if (toHost.length) await host.receive(toHost.shift());
    }
  }
  await host.start(seed, '1'.repeat(32)); await flush();
  return { host, guest, toHost, toGuest, flush };
}
function nextAction(state: GameState, step: number): GameAction {
  const actor = state.currentPlayer;
  switch (state.phase.type) {
    case 'awaiting-draw': return { type: 'DRAW_CARD', actor };
    case 'choosing-effect': { const options = effectOptions(state); return { type: 'CHOOSE_EFFECT', actor, choice: options.canAdd && (step % 2 === 0 || !options.canMove) ? 'add' : 'move' }; }
    case 'adding-pawns': case 'adding-queen': return step % 3 ? { type: state.phase.type === 'adding-pawns' ? 'ADD_PAWN' : 'ADD_QUEEN', actor, square: effectTargets(state)[0] } : { type: 'SKIP_EFFECT', actor };
    case 'moving': {
      const moves = SQUARES.flatMap(s => legalMoves(state, s));
      return { type: 'MOVE', actor, ...moves[(step * 17) % moves.length] };
    }
    default: throw new Error('Finished');
  }
}

describe('protocolo e hash', () => {
  it('ordem de chaves não altera hash; RNG, cor, roque, fase e IDs alteram', async () => {
    const state = createGame(12), reversed = Object.fromEntries(Object.entries(state).reverse()) as unknown as GameState;
    expect(await stateHash(state)).toBe(await stateHash(reversed));
    const base = await stateHash(state);
    for (const change of [
      (s: GameState) => { s.rngState++; }, (s: GameState) => { s.playerColors = { p1: 'black', p2: 'white' }; },
      (s: GameState) => { s.castlingRights.white.kingSide.allowed = false; },
      (s: GameState) => { s.phase = { type: 'moving', movesRemaining: 4, movedPieceIds: ['initial-e2'] }; },
      (s: GameState) => { s.nextPieceId++; },
    ]) { const copy = structuredClone(state); change(copy); expect(await stateHash(copy)).not.toBe(base); }
  });
  it.each([null, [], { type: 'REVERSE', actor: 'p1' }, { type: 'GAME_OVER', actor: 'p1' },
    { type: 'DRAW_CARD', actor: 'p3' }, { type: 'DRAW_CARD', actor: 'p1', admin: true },
    { type: 'MOVE', actor: 'p1', from: 'i1', to: 'e4' }, { type: 'MOVE', actor: 'p1', from: 'e2', to: 'e4', promotion: 'king' },
  ])('rejeita ação não autorizada por esquema: %j', action => expect(validAction(action)).toBe(false));
  it.each(['{', 'null', '[]', 'x'.repeat(16_385)])('rejeita payload inválido sem executar motor', raw => expect(() => parseMessage(raw)).toThrow());
});

describe('duas sessões independentes', () => {
  it('faz handshake com seed comum e bloqueia cliques repetidos até ACK', async () => {
    const p = await pair();
    expect(p.host.view.status).toBe('playing'); expect(p.guest.view.state).toEqual(p.host.view.state);
    await p.guest.dispatch({ type: 'DRAW_CARD', actor: 'p1' }); expect(p.toHost).toHaveLength(0);
    await p.host.dispatch({ type: 'DRAW_CARD', actor: 'p1' });
    await p.host.dispatch({ type: 'DRAW_CARD', actor: 'p1' });
    expect(p.toGuest).toHaveLength(1); expect(p.host.view.busy).toBe(true);
    await p.flush(); expect(p.host.view.busy).toBe(false); expect(p.guest.view.state).toEqual(p.host.view.state);
  });
  it('ACK e ACTION duplicados não executam a ação novamente', async () => {
    const p = await pair(); await p.host.dispatch({ type: 'DRAW_CARD', actor: 'p1' });
    const packet = p.toGuest.shift()!;
    await p.guest.receive(packet); const ack = p.toHost.shift()!;
    await p.host.receive(ack); await p.guest.receive(packet); await p.host.receive(p.toHost.shift()!);
    expect(p.guest.view.state?.revision).toBe(1); expect(p.host.view.status).toBe('playing');
    expect(p.guest.view.state).toEqual(p.host.view.state);
  });
  it.each(['hash', 'before', 'session', 'base', 'actor', 'action'] as const)('rejeita %s adulterado sem mutar estado', async field => {
    const p = await pair(); await p.host.dispatch({ type: 'DRAW_CARD', actor: 'p1' });
    const message = JSON.parse(p.toGuest.shift()!);
    if (field === 'actor') message.action.actor = 'p2';
    else if (field === 'action') message.action = { type: 'MOVE', actor: 'p1', from: 'e2', to: 'e5' };
    else if (field === 'base') { message.base = 8; message.revision = 9; }
    else message[field] = '0'.repeat(field === 'session' ? 32 : 64);
    const before = structuredClone(p.guest.view.state);
    await p.guest.receive(JSON.stringify(message));
    expect(p.guest.view.status).toBe('failed'); expect(p.guest.view.state).toEqual(before);
  });
  it('rejeita versão/configuração incompatível antes de iniciar', async () => {
    const packets: string[] = [], host = new GameSession('p1', raw => packets.push(raw), () => {});
    await host.start(9, 'a'.repeat(32)); const init = JSON.parse(packets[0]); init.rules.deckCounts['+4']++;
    const guest = new GameSession('p2', () => {}, () => {}); await guest.receive(JSON.stringify(init));
    expect(guest.view.status).toBe('failed'); expect(guest.view.state).toBeNull();
  });
  it.each([1, 29, 207])('seed %i mantém paridade com modo local em até 240 ações', async seed => {
    const p = await pair(seed); let local = createGame(seed);
    for (let step = 0; step < 240 && local.status === 'active'; step++) {
      const action = nextAction(local, step), result = reduceGame(local, action);
      if (!result.ok) throw new Error(result.error); local = result.state;
      await (action.actor === 'p1' ? p.host : p.guest).dispatch(action); await p.flush();
      expect(p.host.view.status).toBe('playing'); expect(p.guest.view.status).toBe('playing');
      expect(p.host.view.state).toEqual(local); expect(p.guest.view.state).toEqual(local);
    }
  });
  it('pausa e recupera a mesma conexão apenas após comparar estados', async () => {
    const p = await pair(); p.host.pause(); p.guest.pause();
    await p.host.dispatch({ type: 'DRAW_CARD', actor: 'p1' }); expect(p.toGuest).toHaveLength(0);
    p.host.resume(); p.guest.resume(); await p.flush();
    expect(p.host.view.status).toBe('playing'); expect(p.guest.view.status).toBe('playing');
  });
  it('fecha com erro, sem vitória, se a recuperação não é inequívoca', async () => {
    const p = await pair(); await p.host.dispatch({ type: 'DRAW_CARD', actor: 'p1' }); p.toGuest.length = 0;
    p.host.pause(); p.guest.pause(); p.host.resume(); await p.flush();
    expect(p.guest.view.status).toBe('failed'); expect(p.guest.view.state?.winner).toBeNull();
  });
  it('saída interrompe e ignora mensagens posteriores sem declarar vencedor', async () => {
    const p = await pair(); const before = canonical(p.guest.view.state); p.host.leave(); await p.flush();
    await p.guest.dispatch({ type: 'DRAW_CARD', actor: 'p2' as PlayerId });
    expect(p.guest.view.status).toBe('failed'); expect(canonical(p.guest.view.state)).toBe(before);
  });
});
