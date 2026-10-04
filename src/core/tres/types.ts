import type { ChessPosition, Color, Move, Piece, Square } from '../chess/types';
export type PlayerId = 'p1' | 'p2';
export type CardType = '1' | '2' | '3' | 'block' | 'reverse' | '+2' | '+4';
export interface Card { id: string; type: CardType }
export interface RulesConfig {
  rulesVersion: 'tres-v3-effect-moves';
  deckCounts: Record<CardType, number>;
  startingPlayer: PlayerId;
}
export type Phase =
  | { type: 'awaiting-draw' }
  | { type: 'choosing-effect' }
  | { type: 'moving'; movesRemaining: number; movedPieceIds: string[] }
  | { type: 'adding-pawns'; additionsRemaining: number }
  | { type: 'adding-queen'; additionsRemaining: 1 }
  | { type: 'finished' };
export interface GameState extends ChessPosition {
  rules: RulesConfig;
  initialSeed: number;
  rngState: number;
  currentPlayer: PlayerId;
  playerColors: Record<PlayerId, Color>;
  currentCard: Card | null;
  deck: Card[];
  discardPile: Card[];
  phase: Phase;
  status: 'active' | 'finished';
  winner: PlayerId | null;
  turnNumber: number;
  revision: number;
  nextPieceId: number;
}
export type GameAction = { actor: PlayerId } & (
  | { type: 'DRAW_CARD' }
  | { type: 'CHOOSE_EFFECT'; choice: 'add' | 'move' }
  | ({ type: 'MOVE' } & Move)
  | { type: 'ADD_PAWN'; square: Square }
  | { type: 'ADD_QUEEN'; square: Square }
  | { type: 'SKIP_EFFECT' }
);
export type GameEvent =
  | { type: 'CARD_DRAWN'; actor: PlayerId; card: Card }
  | { type: 'EFFECT_CHOSEN'; actor: PlayerId; choice: 'add' | 'move' }
  | { type: 'PIECE_MOVED'; actor: PlayerId; from: Square; to: Square; capture: boolean; promotion?: string }
  | { type: 'COLORS_SWAPPED'; playerColors: Record<PlayerId, Color> }
  | { type: 'PIECE_ADDED'; actor: PlayerId; piece: Piece; square: Square }
  | { type: 'EFFECT_SKIPPED'; actor: PlayerId }
  | { type: 'NO_SPACE'; card: '+2' | '+4'; color: Color }
  | { type: 'NO_LEGAL_MOVES'; actor: PlayerId; unused: number }
  | { type: 'TURN_ENDED'; actor: PlayerId }
  | { type: 'GAME_OVER'; winner: PlayerId };
export type GameError = 'GAME_FINISHED' | 'WRONG_PLAYER' | 'WRONG_PHASE' | 'INVALID_MOVE' |
  'PIECE_ALREADY_MOVED' | 'INVALID_TARGET' | 'INVALID_STATE';
export type TransitionResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: GameError };
