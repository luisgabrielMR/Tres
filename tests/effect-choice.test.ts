import { expect, it } from 'vitest';
import { createGame, effectOptions, reduceGame } from '../src/core/tres/engine';
import type { CardType, GameAction, GameState } from '../src/core/tres/types';
import { SQUARES } from '../src/core/chess/types';

function apply(state: GameState, action: GameAction): GameState {
  const result = reduceGame(state, action);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
function draw(type: CardType, state = createGame(9)): GameState {
  const card = state.deck.find(c => c.type === type)!;
  state.deck = [card, ...state.deck.filter(c => c.id !== card.id)];
  return apply(state, { type: 'DRAW_CARD', actor: state.currentPlayer });
}
function openBoard(): GameState {
  const state = createGame(9);
  for (const square of SQUARES) {
    const id = state.board[square];
    if (id && !['king', 'queen'].includes(state.pieces[id].type)) { delete state.pieces[id]; state.board[square] = null; }
  }
  return state;
}

it.each(['+2', '+4'] as const)('%s exige escolher antes de mover ou adicionar', card => {
  const state = draw(card, openBoard()), before = structuredClone(state);
  expect(state.phase.type).toBe('choosing-effect');
  expect(effectOptions(state)).toEqual({ canAdd: true, canMove: true });
  expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'd1', to: 'd4' }).ok).toBe(false);
  expect(reduceGame(state, { type: card === '+2' ? 'ADD_PAWN' : 'ADD_QUEEN', actor: 'p1', square: card === '+2' ? 'a2' : 'a1' }).ok).toBe(false);
  expect(reduceGame(state, { type: 'CHOOSE_EFFECT', actor: 'p2', choice: 'move' }).ok).toBe(false);
  expect(state).toEqual(before);
});
it.each(['+2', '+4'] as const)('%s não combina adição com movimento ou permite trocar a escolha', card => {
  let state = draw(card, openBoard());
  state = apply(state, { type: 'CHOOSE_EFFECT', actor: 'p1', choice: 'add' });
  expect(reduceGame(state, { type: 'CHOOSE_EFFECT', actor: 'p1', choice: 'move' }).ok).toBe(false);
  expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'd1', to: 'd4' }).ok).toBe(false);
  state = apply(state, { type: card === '+2' ? 'ADD_PAWN' : 'ADD_QUEEN', actor: 'p1', square: card === '+2' ? 'a2' : 'a1' });
  expect(reduceGame(state, { type: 'CHOOSE_EFFECT', actor: state.currentPlayer, choice: 'move' }).ok).toBe(false);
});
it.each([['+2', 2], ['+4', 4]] as const)('%s dá exatamente %i movimentos distintos, sem adição nem desistência', (card, budget) => {
  let state = apply(draw(card), { type: 'CHOOSE_EFFECT', actor: 'p1', choice: 'move' });
  expect(state.phase).toMatchObject({ type: 'moving', movesRemaining: budget });
  expect(reduceGame(state, { type: 'ADD_PAWN', actor: 'p1', square: 'a2' }).ok).toBe(false);
  expect(reduceGame(state, { type: 'ADD_QUEEN', actor: 'p1', square: 'a1' }).ok).toBe(false);
  expect(reduceGame(state, { type: 'SKIP_EFFECT', actor: 'p1' }).ok).toBe(false);
  const before = structuredClone(state);
  expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'e2', to: 'e5' }).ok).toBe(false);
  expect(state).toEqual(before);
  const moves = [['e2', 'e4'], ['g1', 'f3'], ['d2', 'd4'], ['b1', 'c3']] as const;
  for (let i = 0; i < budget; i++) {
    state = apply(state, { type: 'MOVE', actor: 'p1', from: moves[i][0], to: moves[i][1] });
    if (i < budget - 1) {
      expect(state.currentPlayer).toBe('p1');
      expect(state.phase).toMatchObject({ type: 'moving', movesRemaining: budget - i - 1 });
      const snapshot = structuredClone(state);
      expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'e4', to: 'e5' })).toEqual({ ok: false, error: 'PIECE_ALREADY_MOVED' });
      expect(state).toEqual(snapshot);
    }
  }
  expect(state.currentPlayer).toBe('p2'); expect(state.phase.type).toBe('awaiting-draw');
  expect(state.discardPile.at(-1)?.type).toBe(card);
  expect(Object.keys(state.pieces)).toHaveLength(32);
  expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'a2', to: 'a4' }).ok).toBe(false);
});
it('+4 dispensa apenas o saldo sem peças elegíveis, sem declarar empate', () => {
  let state = apply(draw('+4', openBoard()), { type: 'CHOOSE_EFFECT', actor: 'p1', choice: 'move' });
  state = apply(state, { type: 'MOVE', actor: 'p1', from: 'd1', to: 'd4' });
  const result = reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'e1', to: 'f1' });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  expect(result.events).toContainEqual({ type: 'NO_LEGAL_MOVES', actor: 'p1', unused: 2 });
  expect(result.state).toMatchObject({ currentPlayer: 'p2', phase: { type: 'awaiting-draw' }, status: 'active', winner: null });
});
it('o movimento alternativo respeita as cores após Reverse e pode capturar o rei', () => {
  let state = draw('reverse', openBoard()); // P2 controla brancas.
  state = draw('+4', state);
  state = apply(state, { type: 'CHOOSE_EFFECT', actor: 'p2', choice: 'move' });
  // Dama branca captura rei preto pela diagonal d1–e2 após posicionar fixture.
  const king = state.board.e8!; state.board.e8 = null; state.board.e2 = king;
  state = apply(state, { type: 'MOVE', actor: 'p2', from: 'd1', to: 'e2' });
  expect(state.status).toBe('finished'); expect(state.winner).toBe('p2');
});
it('quando nem adição nem movimento são possíveis, encerra sem empate', () => {
  const state = createGame(2);
  state.pieces = {};
  for (const square of SQUARES) {
    const id = `full-${square}`; state.board[square] = id;
    state.pieces[id] = { id, type: 'pawn', color: 'white', hasMoved: true };
  }
  state.pieces[state.board.a1!].type = 'king';
  state.pieces[state.board.h8!] = { id: state.board.h8!, type: 'king', color: 'black', hasMoved: true };
  state.pieces[state.board.g7!].type = 'rook'; state.pieces[state.board.h7!].type = 'bishop';
  const next = draw('+2', state);
  expect(next.phase.type).toBe('awaiting-draw'); expect(next.currentPlayer).toBe('p2');
  expect(next.status).toBe('active'); expect(next.winner).toBeNull();
});
