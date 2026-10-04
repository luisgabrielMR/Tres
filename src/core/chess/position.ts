import { SQUARES } from './types';
import type { ChessPosition, Color, PieceType, Square } from './types';

export function initialPosition(): ChessPosition {
  const position: ChessPosition = {
    board: Object.fromEntries(SQUARES.map(s => [s, null])) as ChessPosition['board'],
    pieces: {}, enPassant: null, lastMove: null, moveNumber: 0,
    castlingRights: {
      white: { kingId: 'initial-e1', kingSide: { rookId: 'initial-h1', allowed: true }, queenSide: { rookId: 'initial-a1', allowed: true } },
      black: { kingId: 'initial-e8', kingSide: { rookId: 'initial-h8', allowed: true }, queenSide: { rookId: 'initial-a8', allowed: true } },
    },
  };
  const back: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (const square of SQUARES) {
    const rank = Number(square[1]);
    if (![1, 2, 7, 8].includes(rank)) continue;
    const color: Color = rank < 3 ? 'white' : 'black';
    const type = rank === 2 || rank === 7 ? 'pawn' : back[square.charCodeAt(0) - 97];
    const id = `initial-${square}`;
    position.board[square as Square] = id;
    position.pieces[id] = { id, color, type, hasMoved: false };
  }
  return position;
}
