// Comitê 1: contratos aprovados; documentação histórica. Implementação em src/core.
export type PlayerId = 'p1' | 'p2';
export type Color = 'white' | 'black';
export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;
export type PieceId = string;
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type Promotion = Exclude<PieceType, 'pawn' | 'king'>;
export type CardType = '1' | '2' | '3' | 'block' | 'reverse' | '+2' | '+4';

export interface Piece {
  readonly id: PieceId;
  readonly color: Color;
  readonly type: PieceType;
  readonly hasMoved: boolean;
}

export interface Card {
  readonly id: string;
  readonly type: CardType;
}

export interface RulesConfig {
  readonly rulesVersion: 'tres-v3-effect-moves';
  readonly rngVersion: 'mulberry32-fisher-yates-v1';
  readonly deckCounts: Readonly<Record<CardType, number>>;
  readonly startingPlayer: PlayerId;
  readonly allowRepeatedPiece: false;
  // Políticas explícitas da variante v1, não configurações de UI.
  readonly castlingThreatPolicy: 'ignore-attacks';
  readonly enPassantPolicy: 'next-move-or-special-card';
}

export interface ColorCastlingRights {
  readonly kingId: PieceId;
  readonly kingSide: { readonly rookId: PieceId; readonly allowed: boolean };
  readonly queenSide: { readonly rookId: PieceId; readonly allowed: boolean };
}

export interface EnPassant {
  readonly target: Square;
  readonly vulnerablePawnId: PieceId;
  readonly vulnerablePawnSquare: Square;
  readonly eligibleColor: Color;
  readonly createdAtMove: number;
}

export interface LastMove {
  readonly pieceId: PieceId;
  readonly color: Color;
  readonly from: Square;
  readonly to: Square;
  readonly captured: {
    readonly piece: Piece;
    readonly square: Square; // Pode diferir de `to` em en passant.
  } | null;
  readonly promotion: Promotion | null;
  readonly rookMove: {
    readonly pieceId: PieceId;
    readonly from: Square;
    readonly to: Square;
  } | null;
}

export interface ChessPosition {
  readonly board: Readonly<Record<Square, PieceId | null>>;
  readonly pieces: Readonly<Record<PieceId, Piece>>;
  readonly castlingRights: Readonly<Record<Color, ColorCastlingRights>>;
  readonly enPassant: EnPassant | null;
  readonly lastMove: LastMove | null;
  readonly moveNumber: number;
}

interface StateBase extends ChessPosition {
  readonly rules: RulesConfig;
  readonly initialSeed: number;
  readonly rngState: number;
  readonly currentPlayer: PlayerId;
  readonly playerColors: Readonly<Record<PlayerId, Color>>;
  readonly deck: readonly Card[];
  readonly discardPile: readonly Card[];
  readonly turnNumber: number;
  readonly revision: number;
  readonly nextPieceId: number;
}

type ActiveTurn =
  | { readonly phase: 'awaiting-draw'; readonly currentCard: null }
  | { readonly phase: 'choosing-effect'; readonly currentCard: Card & { readonly type: '+2' | '+4' } }
  | {
      readonly phase: 'moving';
      readonly currentCard: Card & { readonly type: '1' | '2' | '3' | '+2' | '+4' };
      readonly movesRemaining: 1 | 2 | 3 | 4;
      readonly movedPieceIds: readonly PieceId[];
    }
  | {
      readonly phase: 'adding-pawns';
      readonly currentCard: Card & { readonly type: '+2' };
      readonly additionsRemaining: 1 | 2;
    }
  | {
      readonly phase: 'adding-queen';
      readonly currentCard: Card & { readonly type: '+4' };
      readonly additionsRemaining: 1;
    };

export type GameState = StateBase & (
  | ({ readonly status: 'active'; readonly winner: null } & ActiveTurn)
  | {
      readonly status: 'finished';
      readonly phase: 'finished';
      readonly currentCard: Card & { readonly type: '1' | '2' | '3' | '+2' | '+4' };
      readonly winner: PlayerId;
      readonly endReason: 'king-captured';
    }
);

export type Move = {
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: Promotion;
};

export type GameAction = { readonly actor: PlayerId } & (
  | { readonly type: 'DRAW_CARD' }
  | { readonly type: 'CHOOSE_EFFECT'; readonly choice: 'add' | 'move' }
  | ({ readonly type: 'MOVE' } & Move)
  | { readonly type: 'ADD_PAWN'; readonly square: Square }
  | { readonly type: 'ADD_QUEEN'; readonly square: Square }
  | { readonly type: 'SKIP_EFFECT' }
);

export type GameEvent =
  | { readonly type: 'CARD_DRAWN'; readonly actor: PlayerId; readonly card: Card }
  | { readonly type: 'PIECE_MOVED'; readonly move: LastMove }
  | { readonly type: 'PIECE_CAPTURED'; readonly piece: Piece; readonly square: Square }
  | { readonly type: 'PIECE_PROMOTED'; readonly pieceId: PieceId; readonly to: Promotion }
  | { readonly type: 'COLORS_SWAPPED'; readonly playerColors: Readonly<Record<PlayerId, Color>> }
  | { readonly type: 'PIECE_ADDED'; readonly piece: Piece; readonly square: Square }
  | { readonly type: 'EFFECT_SKIPPED'; readonly actor: PlayerId; readonly unused: number }
  | { readonly type: 'NO_SPACE'; readonly card: '+2' | '+4'; readonly color: Color }
  | { readonly type: 'NO_LEGAL_MOVES'; readonly actor: PlayerId; readonly unused: number }
  | { readonly type: 'TURN_ENDED'; readonly actor: PlayerId }
  | { readonly type: 'GAME_OVER'; readonly winner: PlayerId; readonly capturedKingId: PieceId };

export type GameError =
  | 'GAME_FINISHED' | 'WRONG_PLAYER' | 'WRONG_PHASE' | 'WRONG_COLOR'
  | 'INVALID_MOVE' | 'INVALID_PROMOTION' | 'INVALID_TARGET'
  | 'PIECE_ALREADY_MOVED' | 'INVALID_STATE';

export type TransitionResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: GameError };

// Contratos funcionais: implementação futura sem dependência de React/DOM/rede.
export interface GameEngine {
  createGame(seed: number, rules: RulesConfig): GameState;
  reduceGame(state: GameState, action: GameAction): TransitionResult;
  getControlledColor(state: GameState, player: PlayerId): Color;
  getLegalMoves(state: GameState, from: Square): readonly Move[];
  getEffectTargets(state: GameState): readonly Square[];
}

export interface WireEnvelope {
  readonly protocolVersion: 1;
  readonly sessionId: string;
}

export type WireMessage = WireEnvelope & (
  | {
      readonly type: 'INIT';
      readonly engineVersion: string;
      readonly seed: number;
      readonly rules: RulesConfig;
      readonly initialHash: string;
    }
  | { readonly type: 'READY' | 'START'; readonly initialHash: string }
  | {
      readonly type: 'ACTION';
      readonly baseRevision: number;
      readonly revision: number;
      readonly previousHash: string;
      readonly nextHash: string;
      readonly action: GameAction;
    }
  | { readonly type: 'ACK' | 'SYNC_CHECK'; readonly revision: number; readonly stateHash: string }
  | { readonly type: 'ERROR'; readonly code: 'INVALID_MESSAGE' | 'VERSION_MISMATCH' | 'DESYNC' }
);

// Fora do GameState/hash; controla disponibilidade de interação online.
export type ConnectionStatus =
  | 'idle' | 'creating-room' | 'waiting-peer' | 'joining-room'
  | 'connecting' | 'handshaking' | 'connected' | 'confirming-action'
  | 'reconnecting' | 'failed' | 'closed';
