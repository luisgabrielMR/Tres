import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { coords, pieceAt, SQUARES } from '../../core/chess/types';
import type { Color, Square } from '../../core/chess/types';
import type { GameState } from '../../core/tres/types';
import { pieceLabel, symbols } from '../labels';

interface Props {
  state: GameState; orientation: Color; selected: Square | null;
  targets: Square[]; additions: Square[]; onSquare: (square: Square) => void;
  draggableSquares: Square[];
  onPieceDragStart: (from: Square) => void;
  onPieceDrop: (from: Square, to: Square | null) => void;
}
export function Board({ state, orientation, selected, targets, additions, onSquare, draggableSquares, onPieceDragStart, onPieceDrop }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusSquare, setFocusSquare] = useState<Square>('e2');
  const pointer = useRef<{ from: Square; startX: number; startY: number; pointerId: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<{ from: Square; x: number; y: number; cell: number } | null>(null);
  const flipped = orientation === 'black';
  const squares = [...SQUARES].sort((a, b) => {
    const [ax, ay] = coords(a), [bx, by] = coords(b);
    return flipped ? ay - by || bx - ax : by - ay || ax - bx;
  });
  const used = state.phase.type === 'moving' ? state.phase.movedPieceIds : [];
  function pointerDown(event: PointerEvent<HTMLButtonElement>, square: Square) {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    if (!draggableSquares.includes(square)) return;
    pointer.current = { from: square, startX: event.clientX, startY: event.clientY, pointerId: event.pointerId, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = pointer.current, rect = ref.current?.getBoundingClientRect();
    if (!current || event.pointerId !== current.pointerId || !rect) return;
    if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6) return;
    if (!current.moved) { current.moved = true; onPieceDragStart(current.from); }
    event.preventDefault();
    setDrag({ from: current.from, x: event.clientX - rect.left, y: event.clientY - rect.top, cell: rect.width / 8 });
  }
  function endPointer(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = pointer.current;
    if (!current || event.pointerId !== current.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
    if (!current.moved) return;
    suppressClick.current = true;
    if (cancelled) { onPieceDrop(current.from, null); return; }
    const rect = ref.current!.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / (rect.width / 8));
    const row = Math.floor((event.clientY - rect.top) / (rect.height / 8));
    onPieceDrop(current.from, col >= 0 && col < 8 && row >= 0 && row < 8 ? squares[row * 8 + col] : null);
  }
  function handleKey(event: KeyboardEvent<HTMLButtonElement>, square: Square) {
    const offsets: Record<string, number> = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1, Home: -(squares.indexOf(square) % 8), End: 7 - squares.indexOf(square) % 8 };
    const offset = offsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const current = squares.indexOf(square), next = current + offset;
    if (next < 0 || next > 63 || (event.key === 'ArrowLeft' && current % 8 === 0) || (event.key === 'ArrowRight' && current % 8 === 7)) return;
    const target = squares[next];
    setFocusSquare(target);
    ref.current?.querySelector<HTMLButtonElement>(`[data-square="${target}"]`)?.focus();
  }
  return <div className="board-frame"><div className="board-surface" ref={ref}>
    <div className="board-grid" role="grid" aria-label={`Tabuleiro, ${flipped ? 'pretas' : 'brancas'} embaixo. Use as setas e Enter para jogar.`}>
      {Array.from({ length: 8 }, (_, row) => <div role="row" key={row}>
        {squares.slice(row * 8, row * 8 + 8).map((square, col) => {
          const [x, y] = coords(square), piece = pieceAt(state, square);
          const last = state.lastMove?.from === square || state.lastMove?.to === square;
          const target = targets.includes(square), add = additions.includes(square), played = !!piece && used.includes(piece.id);
          const label = [square, piece ? pieceLabel(piece) : 'vazia', played ? 'já utilizada nesta carta' : '', target ? 'destino válido' : '', add ? 'adicionar peça' : '', last ? 'última jogada' : ''].filter(Boolean).join(', ');
          return <button role="gridcell" key={square} data-square={square} aria-label={label} aria-selected={selected === square}
            tabIndex={focusSquare === square ? 0 : -1} onFocus={() => setFocusSquare(square)} onKeyDown={event => handleKey(event, square)}
            onPointerDown={event => pointerDown(event, square)} onPointerMove={pointerMove} onPointerUp={event => endPointer(event)} onPointerCancel={event => endPointer(event, true)}
            onLostPointerCapture={event => { if (pointer.current) endPointer(event, true); }}
            onClick={event => { if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; } onSquare(square); }}
            className={`square ${draggableSquares.includes(square) ? 'draggable-square' : ''} ${(x + y) % 2 === 0 ? 'dark' : ''} ${last ? 'last-square' : ''} ${selected === square ? 'selected-square' : ''}`}>
            {col === 0 && <span className="coordinate rank" aria-hidden="true">{square[1]}</span>}
            {row === 7 && <span className="coordinate file" aria-hidden="true">{square[0]}</span>}
            {target && <span className={piece ? 'capture-target' : 'move-target'} aria-hidden="true" />}
            {add && <span className="add-target" aria-hidden="true">+</span>}
          </button>;
        })}
      </div>)}
    </div>
    <div className="pieces-layer" aria-hidden="true">
      {SQUARES.flatMap(square => {
        const piece = pieceAt(state, square);
        if (!piece) return [];
        const [x, y] = coords(square), col = flipped ? 7 - x : x, row = flipped ? y : 7 - y;
        const dragging = drag?.from === square;
        return <div key={piece.id} className={`piece-cell ${piece.color} ${selected === square ? 'piece-selected' : ''} ${used.includes(piece.id) ? 'piece-used' : ''} ${dragging ? 'piece-dragging' : ''}`}
          style={{ transform: dragging ? `translate(${drag.x - drag.cell / 2}px, ${drag.y - drag.cell / 2}px)` : `translate(${col * 100}%, ${row * 100}%)` }}>
          <span className="piece-glyph">{symbols[piece.type]}&#xFE0E;</span>
          {used.includes(piece.id) && <span className="used-mark">✓</span>}
        </div>;
      })}
    </div>
  </div></div>;
}
