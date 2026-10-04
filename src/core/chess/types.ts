export type Color = 'white' | 'black';
export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type Promotion = Exclude<PieceType, 'pawn' | 'king'>;
export interface Piece { id: string; color: Color; type: PieceType; hasMoved: boolean }
export interface Move { from: Square; to: Square; promotion?: Promotion }
export interface CastlingRight {
  kingId: string;
  kingSide: { rookId: string; allowed: boolean };
  queenSide: { rookId: string; allowed: boolean };
}
export interface LastMove extends Move {
  pieceId: string;
  pieceType: PieceType;
  color: Color;
  captured: { piece: Piece; square: Square } | null;
  rookMove: { pieceId: string; from: Square; to: Square } | null;
}
export interface ChessPosition {
  board: Record<Square, string | null>;
  pieces: Record<string, Piece>;
  castlingRights: Record<Color, CastlingRight>;
  enPassant: {
    target: Square; vulnerablePawnId: string; vulnerablePawnSquare: Square;
    eligibleColor: Color; createdAtMove: number;
  } | null;
  lastMove: LastMove | null;
  moveNumber: number;
}
export const FILES = 'abcdefgh';
export const SQUARES: Square[] = Array.from({ length: 64 }, (_, i) => `${FILES[i % 8]}${Math.floor(i / 8) + 1}` as Square);
export const oppositeColor = (color: Color): Color => color === 'white' ? 'black' : 'white';
export const coords = (square: Square): [number, number] => [FILES.indexOf(square[0]), Number(square[1]) - 1];
export function squareAt(x: number, y: number): Square | null {
  return x >= 0 && x < 8 && y >= 0 && y < 8 ? `${FILES[x]}${y + 1}` as Square : null;
}
export const pieceAt = (position: ChessPosition, square: Square): Piece | undefined => {
  const id = position.board[square];
  return id ? position.pieces[id] : undefined;
};
