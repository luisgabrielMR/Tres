import { applyChessMove, castleRook, chessMoves } from '../chess/moves';
import { initialPosition } from '../chess/position';
import { pieceAt, SQUARES } from '../chess/types';
import type { Move, Square } from '../chess/types';
import { DEFAULT_RULES, makeDeck, shuffle, validateRules } from './deck';
import type { GameAction, GameEvent, GameState, PlayerId, RulesConfig, TransitionResult } from './types';

export const otherPlayer = (player: PlayerId): PlayerId => player === 'p1' ? 'p2' : 'p1';
export const controlledColor = (state: GameState, player = state.currentPlayer) => state.playerColors[player];

export function createGame(seed: number, rules: RulesConfig = DEFAULT_RULES): GameState {
  validateRules(rules);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) throw new Error('Seed inválida.');
  const deck = shuffle(makeDeck(rules), seed);
  return { ...initialPosition(), rules: structuredClone(rules), initialSeed: seed, rngState: deck.rngState,
    currentPlayer: rules.startingPlayer, playerColors: { p1: 'white', p2: 'black' }, currentCard: null,
    deck: deck.items, discardPile: [], phase: { type: 'awaiting-draw' }, status: 'active', winner: null,
    turnNumber: 1, revision: 0, nextPieceId: 1 };
}

export function legalMoves(state: GameState, from: Square): Move[] {
  if (state.status !== 'active' || state.phase.type !== 'moving') return [];
  const used = state.phase.movedPieceIds;
  const id = state.board[from];
  if (!id || used.includes(id)) return [];
  return chessMoves(state, controlledColor(state), from).filter(move => {
    const rook = castleRook(state, move.from, move.to);
    return !rook || !used.includes(rook.pieceId);
  });
}

export function effectTargets(state: GameState): Square[] {
  if (state.status !== 'active' || !['adding-pawns', 'adding-queen'].includes(state.phase.type)) return [];
  const white = controlledColor(state) === 'white';
  const rank = state.phase.type === 'adding-pawns' ? (white ? '2' : '7') : (white ? '1' : '8');
  return SQUARES.filter(square => square[1] === rank && !state.board[square]);
}

export function effectOptions(state: GameState): { canAdd: boolean; canMove: boolean } {
  if (state.phase.type !== 'choosing-effect' || state.status !== 'active' ||
    (state.currentCard?.type !== '+2' && state.currentCard?.type !== '+4')) return { canAdd: false, canMove: false };
  const adding: GameState = { ...state, phase: state.currentCard.type === '+2'
    ? { type: 'adding-pawns', additionsRemaining: 2 } : { type: 'adding-queen', additionsRemaining: 1 } };
  const moving: GameState = { ...state, phase: { type: 'moving', movesRemaining: movementBudget(state), movedPieceIds: [] } };
  return { canAdd: effectTargets(adding).length > 0, canMove: SQUARES.some(square => legalMoves(moving, square).length > 0) };
}

export function movementBudget(state: GameState): number {
  switch (state.currentCard?.type) {
    case '+4': return 4;
    case '3': return 3;
    case '2':
    case '+2': return 2;
    default: return 1;
  }
}

function finishTurn(state: GameState, events: GameEvent[]): GameState {
  events.push({ type: 'TURN_ENDED', actor: state.currentPlayer });
  return { ...state, discardPile: [...state.discardPile, ...(state.currentCard ? [state.currentCard] : [])],
    currentCard: null, currentPlayer: otherPlayer(state.currentPlayer), turnNumber: state.turnNumber + 1,
    phase: { type: 'awaiting-draw' } };
}
function finishIfNoMoves(state: GameState, events: GameEvent[]): GameState {
  if (state.phase.type === 'moving' && !SQUARES.some(square => legalMoves(state, square).length > 0)) {
    events.push({ type: 'NO_LEGAL_MOVES', actor: state.currentPlayer, unused: state.phase.movesRemaining });
    return finishTurn({ ...state, enPassant: null }, events);
  }
  return state;
}

export function reduceGame(state: GameState, action: GameAction): TransitionResult {
  if (state.status === 'finished') return { ok: false, error: 'GAME_FINISHED' };
  if (action.actor !== state.currentPlayer) return { ok: false, error: 'WRONG_PLAYER' };
  const events: GameEvent[] = [];
  let next: GameState;
  switch (action.type) {
    case 'DRAW_CARD': {
      if (state.phase.type !== 'awaiting-draw') return { ok: false, error: 'WRONG_PHASE' };
      next = structuredClone(state);
      if (!next.deck.length) {
        if (!next.discardPile.length) return { ok: false, error: 'INVALID_STATE' };
        const shuffled = shuffle(next.discardPile, next.rngState);
        next.deck = shuffled.items; next.rngState = shuffled.rngState; next.discardPile = [];
      }
      const card = next.deck.shift()!;
      next.currentCard = card;
      events.push({ type: 'CARD_DRAWN', actor: action.actor, card });
      if (card.type === '1' || card.type === '2' || card.type === '3') {
        next.phase = { type: 'moving', movesRemaining: Number(card.type), movedPieceIds: [] };
        next = finishIfNoMoves(next, events);
      } else {
        next.enPassant = null;
        if (card.type === 'reverse') {
          next.playerColors = { p1: state.playerColors.p2, p2: state.playerColors.p1 };
          events.push({ type: 'COLORS_SWAPPED', playerColors: { ...next.playerColors } });
          next = finishTurn(next, events);
        } else if (card.type === 'block') next = finishTurn(next, events);
        else {
          next.phase = { type: 'choosing-effect' };
          const options = effectOptions(next);
          if (!options.canAdd && !options.canMove) {
            events.push({ type: 'NO_SPACE', card: card.type, color: controlledColor(next) });
            events.push({ type: 'NO_LEGAL_MOVES', actor: action.actor, unused: movementBudget(next) });
            next = finishTurn(next, events);
          }
        }
      }
      break;
    }
    case 'CHOOSE_EFFECT': {
      if (state.phase.type !== 'choosing-effect') return { ok: false, error: 'WRONG_PHASE' };
      const options = effectOptions(state);
      if (action.choice === 'move' && options.canMove) {
        next = { ...state, phase: { type: 'moving', movesRemaining: movementBudget(state), movedPieceIds: [] } };
      } else if (action.choice === 'add' && options.canAdd) {
        next = { ...state, phase: state.currentCard?.type === '+2'
          ? { type: 'adding-pawns', additionsRemaining: 2 } : { type: 'adding-queen', additionsRemaining: 1 } };
      } else return { ok: false, error: 'INVALID_TARGET' };
      events.push({ type: 'EFFECT_CHOSEN', actor: action.actor, choice: action.choice });
      break;
    }
    case 'MOVE': {
      if (state.phase.type !== 'moving') return { ok: false, error: 'WRONG_PHASE' };
      const piece = pieceAt(state, action.from);
      if (piece && state.phase.movedPieceIds.includes(piece.id)) return { ok: false, error: 'PIECE_ALREADY_MOVED' };
      const move = legalMoves(state, action.from).find(m => m.to === action.to && m.promotion === action.promotion);
      if (!move) return { ok: false, error: 'INVALID_MOVE' };
      const position = applyChessMove(state, move);
      const last = position.lastMove!;
      events.push({ type: 'PIECE_MOVED', actor: action.actor, from: move.from, to: move.to, capture: !!last.captured, promotion: move.promotion });
      const movedPieceIds = [...state.phase.movedPieceIds, last.pieceId, ...(last.rookMove ? [last.rookMove.pieceId] : [])];
      next = { ...state, ...position, phase: { type: 'moving', movesRemaining: state.phase.movesRemaining - 1, movedPieceIds } };
      if (last.captured?.piece.type === 'king') {
        next = { ...next, status: 'finished', winner: action.actor, phase: { type: 'finished' } };
        events.push({ type: 'GAME_OVER', winner: action.actor });
      } else if (next.phase.type === 'moving' && next.phase.movesRemaining === 0) next = finishTurn(next, events);
      else next = finishIfNoMoves(next, events);
      break;
    }
    case 'ADD_PAWN':
    case 'ADD_QUEEN': {
      const pawn = action.type === 'ADD_PAWN';
      if ((pawn && state.phase.type !== 'adding-pawns') || (!pawn && state.phase.type !== 'adding-queen')) return { ok: false, error: 'WRONG_PHASE' };
      if (!effectTargets(state).includes(action.square)) return { ok: false, error: 'INVALID_TARGET' };
      next = structuredClone(state);
      const piece = { id: `added-${next.nextPieceId++}`, color: controlledColor(state), type: pawn ? 'pawn' as const : 'queen' as const, hasMoved: false };
      next.board[action.square] = piece.id; next.pieces[piece.id] = piece;
      events.push({ type: 'PIECE_ADDED', actor: action.actor, piece: { ...piece }, square: action.square });
      if (next.phase.type === 'adding-pawns') {
        next.phase.additionsRemaining--;
        if (!next.phase.additionsRemaining || !effectTargets(next).length) next = finishTurn(next, events);
      } else next = finishTurn(next, events);
      break;
    }
    case 'SKIP_EFFECT':
      if (state.phase.type !== 'choosing-effect' && state.phase.type !== 'adding-pawns' && state.phase.type !== 'adding-queen') return { ok: false, error: 'WRONG_PHASE' };
      events.push({ type: 'EFFECT_SKIPPED', actor: action.actor });
      next = finishTurn(state, events);
      break;
    default: return { ok: false, error: 'INVALID_STATE' };
  }
  return { ok: true, state: { ...next, revision: state.revision + 1 }, events };
}
