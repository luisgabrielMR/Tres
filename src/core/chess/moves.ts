import { coords, oppositeColor, pieceAt, squareAt, SQUARES } from './types';
import type { ChessPosition, Color, LastMove, Move, Promotion, Square } from './types';

const PROMOTIONS: Promotion[] = ['queen', 'rook', 'bishop', 'knight'];

function clearPath(position: ChessPosition, from: Square, to: Square): boolean {
  const [x, y] = coords(from), [tx, ty] = coords(to);
  const dx = Math.sign(tx - x), dy = Math.sign(ty - y);
  for (let nx = x + dx, ny = y + dy; nx !== tx || ny !== ty; nx += dx, ny += dy) {
    const square = squareAt(nx, ny);
    if (!square || position.board[square]) return false;
  }
  return true;
}

export function castleRook(position: ChessPosition, from: Square, to: Square): LastMove['rookMove'] {
  const king = pieceAt(position, from);
  if (!king || king.type !== 'king') return null;
  const rank = king.color === 'white' ? '1' : '8';
  const side = to === `g${rank}` ? 'kingSide' : to === `c${rank}` ? 'queenSide' : null;
  if (from !== `e${rank}` || !side) return null;
  const rights = position.castlingRights[king.color];
  const rookFrom = `${side === 'kingSide' ? 'h' : 'a'}${rank}` as Square;
  const rook = pieceAt(position, rookFrom);
  if (king.id !== rights.kingId || king.hasMoved || !rights[side].allowed ||
      !rook || rook.type !== 'rook' || rook.color !== king.color || rook.hasMoved || rook.id !== rights[side].rookId ||
      !clearPath(position, from, rookFrom)) return null;
  // Ameaças não restringem o roque nesta variante aprovada.
  return { pieceId: rook.id, from: rookFrom, to: `${side === 'kingSide' ? 'f' : 'd'}${rank}` as Square };
}

export function attacksSquare(position: ChessPosition, from: Square, to: Square): boolean {
  const piece = pieceAt(position, from);
  if (!piece || from === to) return false;
  const [x, y] = coords(from), [tx, ty] = coords(to);
  const dx = Math.abs(tx - x), dy = Math.abs(ty - y);
  switch (piece.type) {
    case 'pawn': return dx === 1 && ty - y === (piece.color === 'white' ? 1 : -1);
    case 'knight': return dx * dy === 2;
    case 'king': return Math.max(dx, dy) === 1;
    case 'bishop': return dx === dy && clearPath(position, from, to);
    case 'rook': return (dx === 0 || dy === 0) && clearPath(position, from, to);
    case 'queen': return (dx === dy || dx === 0 || dy === 0) && clearPath(position, from, to);
  }
}

function canMove(position: ChessPosition, from: Square, to: Square): boolean {
  const piece = pieceAt(position, from), target = pieceAt(position, to);
  if (!piece || from === to || target?.color === piece.color) return false;
  if (piece.type === 'king' && castleRook(position, from, to)) return true;
  if (piece.type !== 'pawn') return attacksSquare(position, from, to);
  const [x, y] = coords(from), [tx, ty] = coords(to);
  const direction = piece.color === 'white' ? 1 : -1;
  if (tx === x && !target) {
    if (ty - y === direction) return true;
    const home = piece.color === 'white' ? 1 : 6;
    const middle = squareAt(x, y + direction)!;
    return y === home && !piece.hasMoved && ty - y === 2 * direction && !position.board[middle];
  }
  if (Math.abs(tx - x) !== 1 || ty - y !== direction) return false;
  if (target) return true;
  const ep = position.enPassant;
  const vulnerable = ep ? pieceAt(position, ep.vulnerablePawnSquare) : undefined;
  return !!ep && ep.target === to && ep.eligibleColor === piece.color && ep.createdAtMove === position.moveNumber &&
    vulnerable?.id === ep.vulnerablePawnId && vulnerable.type === 'pawn' && vulnerable.color !== piece.color &&
    ep.vulnerablePawnSquare === squareAt(tx, y);
}

export function chessMoves(position: ChessPosition, color: Color, from: Square): Move[] {
  const piece = pieceAt(position, from);
  if (!piece || piece.color !== color) return [];
  return SQUARES.filter(to => canMove(position, from, to)).flatMap(to =>
    piece.type === 'pawn' && (to[1] === '1' || to[1] === '8')
      ? PROMOTIONS.map(promotion => ({ from, to, promotion })) : [{ from, to }]);
}

// Recebe um movimento já validado. Não altera a posição de entrada.
export function applyChessMove(position: ChessPosition, move: Move): ChessPosition {
  const next = structuredClone(position);
  const piece = next.pieces[next.board[move.from]!];
  const rookMove = castleRook(position, move.from, move.to);
  const target = pieceAt(position, move.to);
  const epCapture = piece.type === 'pawn' && !target && move.from[0] !== move.to[0];
  const captureSquare = epCapture ? position.enPassant!.vulnerablePawnSquare : move.to;
  const capturedPiece = pieceAt(position, captureSquare);
  next.lastMove = { ...move, pieceId: piece.id, pieceType: piece.type, color: piece.color,
    captured: capturedPiece ? { piece: { ...capturedPiece }, square: captureSquare } : null, rookMove };
  if (capturedPiece) { next.board[captureSquare] = null; delete next.pieces[capturedPiece.id]; }
  next.board[move.from] = null;
  next.board[move.to] = piece.id;
  piece.hasMoved = true;
  if (move.promotion) piece.type = move.promotion;
  if (rookMove) {
    next.board[rookMove.from] = null;
    next.board[rookMove.to] = rookMove.pieceId;
    next.pieces[rookMove.pieceId].hasMoved = true;
  }
  for (const rights of Object.values(next.castlingRights)) {
    if (piece.id === rights.kingId) { rights.kingSide.allowed = false; rights.queenSide.allowed = false; }
    for (const side of [rights.kingSide, rights.queenSide]) {
      if (side.rookId === piece.id || side.rookId === capturedPiece?.id) side.allowed = false;
    }
  }
  next.moveNumber++;
  next.enPassant = null;
  if (next.lastMove.pieceType === 'pawn' && Math.abs(Number(move.to[1]) - Number(move.from[1])) === 2) {
    next.enPassant = { target: `${move.from[0]}${(Number(move.to[1]) + Number(move.from[1])) / 2}` as Square,
      vulnerablePawnId: piece.id, vulnerablePawnSquare: move.to, eligibleColor: oppositeColor(piece.color), createdAtMove: next.moveNumber };
  }
  return next;
}

export function isKingThreatened(position: ChessPosition, color: Color): boolean {
  const kingSquare = SQUARES.find(s => { const p = pieceAt(position, s); return p?.type === 'king' && p.color === color; });
  return !!kingSquare && SQUARES.some(s => pieceAt(position, s)?.color === oppositeColor(color) && attacksSquare(position, s, kingSquare));
}
