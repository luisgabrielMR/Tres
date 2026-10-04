import { describe, expect, it } from 'vitest';
import { applyChessMove, chessMoves, isKingThreatened } from '../src/core/chess/moves';
import { pieceAt, SQUARES } from '../src/core/chess/types';
import type { Color, PieceType, Square } from '../src/core/chess/types';
import { DEFAULT_RULES, randomStep } from '../src/core/tres/deck';
import { controlledColor, createGame, effectOptions, effectTargets, legalMoves, movementBudget, reduceGame } from '../src/core/tres/engine';
import type { CardType, GameAction, GameState, RulesConfig } from '../src/core/tres/types';

function act(state: GameState, action: Omit<GameAction, 'actor'> | { type: 'CHOOSE_EFFECT'; choice: 'add' | 'move' } | { type: 'MOVE'; from: Square; to: Square; promotion?: 'queen' | 'rook' | 'bishop' | 'knight' } | { type: 'ADD_PAWN' | 'ADD_QUEEN'; square: Square }): GameState {
  const result = reduceGame(state, { ...action, actor: state.currentPlayer } as GameAction);
  if (!result.ok) throw new Error(`Ação rejeitada: ${JSON.stringify(action)} (${result.error})`);
  return result.state;
}
function withCard(state: GameState, type: CardType): GameState {
  const card = state.deck.find(c => c.type === type)!;
  state.deck = [card, ...state.deck.filter(c => c.id !== card.id)];
  return act(state, { type: 'DRAW_CARD' });
}
function put(state: GameState, square: Square, type: PieceType, color: Color, hasMoved = false) {
  const id = `initial-${square}`;
  state.board[square] = id; state.pieces[id] = { id, type, color, hasMoved };
}
function remove(state: GameState, square: Square) {
  const id = state.board[square]; if (id) delete state.pieces[id]; state.board[square] = null;
}
function sparse(entries: [Square, PieceType, Color, boolean?][]): GameState {
  const state = createGame(1);
  for (const square of SQUARES) state.board[square] = null;
  state.pieces = {};
  for (const [square, type, color, moved] of entries) put(state, square, type, color, moved);
  return state;
}
const kings: [Square, PieceType, Color][] = [['e1', 'king', 'white'], ['e8', 'king', 'black']];

describe('posição e movimentos de xadrez', () => {
  it('inicia com 32 identidades únicas, posição tradicional e sem mutar configurações', () => {
    const state = createGame(0);
    expect(Object.keys(state.pieces)).toHaveLength(32);
    expect(new Set(Object.values(state.board).filter(Boolean)).size).toBe(32);
    expect(pieceAt(state, 'd1')?.type).toBe('queen');
    expect(pieceAt(state, 'e8')?.type).toBe('king');
    state.rules.deckCounts['1'] = 0;
    expect(DEFAULT_RULES.deckCounts['1']).toBe(12);
  });
  it.each([
    ['rook', 'd8', 'e5'], ['bishop', 'h8', 'd5'], ['queen', 'h4', 'e6'],
    ['knight', 'f5', 'e5'], ['king', 'e5', 'f5'],
  ] as const)('%s respeita geometria', (type, valid, invalid) => {
    const state = sparse([['d4', type, 'white']]);
    const targets = chessMoves(state, 'white', 'd4').map(m => m.to);
    expect(targets).toContain(valid); expect(targets).not.toContain(invalid);
  });
  it('bloqueia deslizantes, não permite captura própria, permite cavalo saltar', () => {
    const state = createGame(4);
    expect(chessMoves(state, 'white', 'a1')).toEqual([]);
    expect(chessMoves(state, 'white', 'c1')).toEqual([]);
    expect(chessMoves(state, 'white', 'b1').map(m => m.to).sort()).toEqual(['a3', 'c3']);
  });
  it('peão só captura na diagonal, avança na direção correta e não atravessa bloqueio', () => {
    const state = sparse([['e2', 'pawn', 'white'], ['d3', 'rook', 'black'], ['e3', 'knight', 'black'], ['e7', 'pawn', 'black']]);
    expect(chessMoves(state, 'white', 'e2').map(m => m.to)).toEqual(['d3']);
    expect(chessMoves(state, 'black', 'e7').map(m => m.to)).toEqual(['e5', 'e6']);
    remove(state, 'e3'); state.pieces[state.board.e2!].hasMoved = true;
    expect(chessMoves(state, 'white', 'e2').map(m => m.to)).not.toContain('e4');
  });
  it('ameaça é informativa; permite reis adjacentes e movimentos que expõem o rei', () => {
    const state = sparse([['e1', 'king', 'white'], ['e3', 'king', 'black'], ['a1', 'rook', 'black']]);
    expect(isKingThreatened(state, 'white')).toBe(true);
    expect(chessMoves(state, 'white', 'e1').map(m => m.to)).toContain('e2');
  });
});

describe('uma peça por carta (regressão solicitada por Luis)', () => {
  it('impede a mesma dama de fazer o segundo movimento da carta 3 e preserva o estado', () => {
    let state = withCard(sparse([...kings, ['d1', 'queen', 'white']]), '3');
    state = act(state, { type: 'MOVE', from: 'd1', to: 'd4' });
    const before = structuredClone(state);
    expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'd4', to: 'h4' })).toEqual({ ok: false, error: 'PIECE_ALREADY_MOVED' });
    expect(state).toEqual(before); expect(legalMoves(state, 'd4')).toEqual([]);
    expect(state.phase).toMatchObject({ type: 'moving', movesRemaining: 2 });
  });
  it('três peças distintas usam os três movimentos e alternam apenas uma vez', () => {
    let state = withCard(createGame(3), '3');
    state = act(state, { type: 'MOVE', from: 'e2', to: 'e4' });
    state = act(state, { type: 'MOVE', from: 'g1', to: 'f3' });
    state = act(state, { type: 'MOVE', from: 'd2', to: 'd4' });
    expect(state.currentPlayer).toBe('p2'); expect(state.turnNumber).toBe(2);
    expect(state.phase.type).toBe('awaiting-draw'); expect(state.discardPile).toHaveLength(1);
    expect(state.currentCard).toBeNull();
  });
  it('promoção mantém ID e não libera novo movimento', () => {
    let state = withCard(sparse([...kings, ['b7', 'pawn', 'white']]), '3');
    const id = state.board.b7;
    expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'b7', to: 'b8' }).ok).toBe(false);
    state = act(state, { type: 'MOVE', from: 'b7', to: 'b8', promotion: 'queen' });
    expect(pieceAt(state, 'b8')).toMatchObject({ id, type: 'queen' });
    expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'b8', to: 'b6' })).toEqual({ ok: false, error: 'PIECE_ALREADY_MOVED' });
  });
  it('roque consome um movimento, mas utiliza rei e torre', () => {
    let state = withCard(sparse([...kings, ['h1', 'rook', 'white']]), '3');
    state = act(state, { type: 'MOVE', from: 'e1', to: 'g1' });
    // Sem outras peças elegíveis, a carta termina mesmo tendo saldo.
    expect(state.phase.type).toBe('awaiting-draw');
    expect(pieceAt(state, 'g1')?.type).toBe('king'); expect(pieceAt(state, 'f1')?.type).toBe('rook');
    let more = withCard(sparse([...kings, ['h1', 'rook', 'white'], ['a2', 'pawn', 'white']]), '3');
    more = act(more, { type: 'MOVE', from: 'e1', to: 'g1' });
    expect(more.phase).toMatchObject({ type: 'moving', movesRemaining: 2, movedPieceIds: ['initial-e1', 'initial-h1'] });
    expect(legalMoves(more, 'f1')).toEqual([]); expect(legalMoves(more, 'g1')).toEqual([]);
  });
  it('encerramento por falta de peças elegíveis não vira empate', () => {
    let state = withCard(sparse(kings), '3');
    const result = reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'e1', to: 'd1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;
    expect(state.status).toBe('active'); expect(state.winner).toBeNull();
    expect(result.events).toContainEqual({ type: 'NO_LEGAL_MOVES', actor: 'p1', unused: 2 });
  });
  it('libera a peça em uma nova carta', () => {
    let state = withCard(createGame(7), '1');
    state = act(state, { type: 'MOVE', from: 'e2', to: 'e4' });
    state = withCard(state, 'block');
    state = withCard(state, '2');
    expect(legalMoves(state, 'e4').map(m => m.to)).toContain('e5');
  });
});

describe('regras especiais e vitória', () => {
  it.each(['white', 'black'] as const)('roque dos dois lados com %s move as duas peças e impede repetição', color => {
    const rank = color === 'white' ? '1' : '8';
    for (const side of ['kingSide', 'queenSide'] as const) {
      const from = `e${rank}` as Square, to = `${side === 'kingSide' ? 'g' : 'c'}${rank}` as Square;
      const rookFrom = `${side === 'kingSide' ? 'h' : 'a'}${rank}` as Square, rookTo = `${side === 'kingSide' ? 'f' : 'd'}${rank}` as Square;
      let state = sparse([...kings, [rookFrom, 'rook', color]]);
      state.playerColors = color === 'white' ? { p1: 'white', p2: 'black' } : { p1: 'black', p2: 'white' };
      state = withCard(state, '3'); const kingId = state.board[from], rookId = state.board[rookFrom];
      state = act(state, { type: 'MOVE', from, to });
      expect(state.board[to]).toBe(kingId); expect(state.board[rookTo]).toBe(rookId);
      expect(state.board[from]).toBeNull(); expect(state.board[rookFrom]).toBeNull();
      expect(state.castlingRights[color].kingSide.allowed).toBe(false);
      expect(state.castlingRights[color].queenSide.allowed).toBe(false);
      expect(legalMoves(state, to)).toEqual([]); expect(legalMoves(state, rookTo)).toEqual([]);
    }
  });
  it('en passant branco preserva janela em tentativa inválida e remove somente o peão vulnerável', () => {
    let state = sparse([...kings, ['e7', 'pawn', 'black'], ['d5', 'pawn', 'white']]);
    state.currentPlayer = 'p2'; state = withCard(state, '1');
    state = act(state, { type: 'MOVE', from: 'e7', to: 'e5' }); state = withCard(state, '2');
    const before = structuredClone(state), capturedId = state.board.e5!;
    expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'd5', to: 'f6' }).ok).toBe(false);
    expect(state).toEqual(before);
    state = act(state, { type: 'MOVE', from: 'd5', to: 'e6' });
    expect(state.board.e5).toBeNull(); expect(state.pieces[capturedId]).toBeUndefined();
    expect(pieceAt(state, 'e6')?.color).toBe('white'); expect(state.enPassant).toBeNull();
  });
  it('captura do rei com promoção vence antes do restante do +4 e exige escolha válida', () => {
    let state = sparse([['e1', 'king', 'white'], ['b8', 'king', 'black'], ['a7', 'pawn', 'white']]);
    state = withCard(state, '+4'); state = act(state, { type: 'CHOOSE_EFFECT', choice: 'move' });
    expect(reduceGame(state, { type: 'MOVE', actor: 'p1', from: 'a7', to: 'b8' }).ok).toBe(false);
    const id = state.board.a7;
    state = act(state, { type: 'MOVE', from: 'a7', to: 'b8', promotion: 'knight' });
    expect(state.status).toBe('finished'); expect(state.winner).toBe('p1');
    expect(state.board.b8).toBe(id); expect(pieceAt(state, 'b8')?.type).toBe('knight');
  });
  it.each(['queen', 'rook', 'bishop', 'knight'] as const)('promove a %s nas duas cores', promotion => {
    for (const color of ['white', 'black'] as const) {
      const from = color === 'white' ? 'b7' : 'b2', to = color === 'white' ? 'b8' : 'b1';
      const state = sparse([...kings, [from, 'pawn', color]]);
      expect(chessMoves(state, color, from)).toContainEqual({ from, to, promotion });
      expect(pieceAt(applyChessMove(state, { from, to, promotion }), to)?.type).toBe(promotion);
    }
  });
  it('roque permite ameaça, exige caminho inteiro livre e identidades originais', () => {
    const state = sparse([...kings, ['a1', 'rook', 'white'], ['h1', 'rook', 'white'], ['f8', 'rook', 'black']]);
    expect(chessMoves(state, 'white', 'e1').map(m => m.to)).toEqual(expect.arrayContaining(['c1', 'g1']));
    put(state, 'b1', 'knight', 'white');
    expect(chessMoves(state, 'white', 'e1').map(m => m.to)).not.toContain('c1');
    state.pieces[state.board.h1!].hasMoved = true;
    expect(chessMoves(state, 'white', 'e1').map(m => m.to)).not.toContain('g1');
    state.pieces[state.board.h1!].hasMoved = false; state.castlingRights.white.kingSide.rookId = 'old-rook';
    expect(chessMoves(state, 'white', 'e1').map(m => m.to)).not.toContain('g1');
  });
  it('capturar torre original revoga seu roque', () => {
    const state = sparse([...kings, ['h1', 'rook', 'white'], ['h8', 'rook', 'black']]);
    const result = applyChessMove(state, { from: 'h8', to: 'h1' });
    expect(result.castlingRights.white.kingSide.allowed).toBe(false);
  });
  it('en passant remove o peão da casa correta', () => {
    let state = withCard(sparse([...kings, ['e2', 'pawn', 'white'], ['d4', 'pawn', 'black']]), '1');
    state = act(state, { type: 'MOVE', from: 'e2', to: 'e4' });
    state = withCard(state, '2');
    expect(legalMoves(state, 'd4')).toContainEqual({ from: 'd4', to: 'e3' });
    state = act(state, { type: 'MOVE', from: 'd4', to: 'e3' });
    expect(state.board.e4).toBeNull(); expect(pieceAt(state, 'e3')?.color).toBe('black');
    expect(state.enPassant).toBeNull();
  });
  it('en passant expira com outro movimento da mesma carta', () => {
    let state = withCard(sparse([...kings, ['e2', 'pawn', 'white'], ['d4', 'pawn', 'black']]), '2');
    state = act(state, { type: 'MOVE', from: 'e2', to: 'e4' });
    expect(state.enPassant?.target).toBe('e3');
    state = act(state, { type: 'MOVE', from: 'e1', to: 'f1' });
    expect(state.enPassant).toBeNull();
  });
  it.each(['block', 'reverse', '+2', '+4'] as const)('carta %s elimina en passant', type => {
    let state = withCard(sparse([...kings, ['e2', 'pawn', 'white'], ['d4', 'pawn', 'black']]), '1');
    state = act(state, { type: 'MOVE', from: 'e2', to: 'e4' });
    state = withCard(state, type);
    expect(state.enPassant).toBeNull();
  });
  it('vitória por captura após Reverse pertence à pessoa e interrompe a carta', () => {
    let state = sparse([...kings, ['e7', 'queen', 'black']]);
    state = withCard(state, 'reverse'); // P2/brancas; bloquear devolve a P1/pretas.
    state = withCard(state, 'block'); state = withCard(state, '3');
    state = act(state, { type: 'MOVE', from: 'e7', to: 'e1' });
    expect(state).toMatchObject({ status: 'finished', winner: 'p1', currentPlayer: 'p1', phase: { type: 'finished' } });
    expect(state.currentCard?.type).toBe('3');
    expect(reduceGame(state, { type: 'DRAW_CARD', actor: 'p1' })).toEqual({ ok: false, error: 'GAME_FINISHED' });
  });
});

describe('cartas de efeito', () => {
  it('Reverse muda somente controle/turno, preservando posição e roque', () => {
    const before = createGame(10), after = withCard(structuredClone(before), 'reverse');
    expect(after.playerColors).toEqual({ p1: 'black', p2: 'white' });
    expect(after.currentPlayer).toBe('p2'); expect(after.board).toEqual(before.board);
    expect(after.pieces).toEqual(before.pieces); expect(after.castlingRights).toEqual(before.castlingRights);
  });
  it.each([['+2', 2], ['+4', 4]] as const)('%s sem espaço mantém a opção de %i movimentos', (type, budget) => {
    let state = withCard(createGame(1), type);
    expect(state.currentPlayer).toBe('p1'); expect(state.phase.type).toBe('choosing-effect');
    expect(effectOptions(state)).toEqual({ canAdd: false, canMove: true });
    expect(reduceGame(state, { actor: 'p1', type: 'CHOOSE_EFFECT', choice: 'add' }).ok).toBe(false);
    state = act(state, { type: 'CHOOSE_EFFECT', choice: 'move' });
    expect(state.phase).toMatchObject({ type: 'moving', movesRemaining: budget });
    expect(movementBudget(state)).toBe(budget);
    state = act(state, { type: 'MOVE', from: 'e2', to: 'e4' });
    expect(state.currentPlayer).toBe('p1'); expect(state.phase).toMatchObject({ type: 'moving', movesRemaining: budget - 1 });
    expect(Object.keys(state.pieces)).toHaveLength(32);
  });
  it('permite um peão quando só há uma casa; o peão criado tem avanço duplo', () => {
    let state = createGame(1); remove(state, 'd2');
    state = withCard(state, '+2'); state = act(state, { type: 'CHOOSE_EFFECT', choice: 'add' }); expect(effectTargets(state)).toEqual(['d2']);
    state = act(state, { type: 'ADD_PAWN', square: 'd2' });
    expect(state.currentPlayer).toBe('p2'); expect(pieceAt(state, 'd2')).toMatchObject({ type: 'pawn', hasMoved: false });
    expect(chessMoves(state, 'white', 'd2')).toContainEqual({ from: 'd2', to: 'd4' });
  });
  it('+2 permite adicionar duas peças diferentes ou encerrar após uma', () => {
    let state = createGame(2); remove(state, 'a2'); remove(state, 'h2');
    state = withCard(state, '+2');
    state = act(state, { type: 'CHOOSE_EFFECT', choice: 'add' });
    const before = structuredClone(state);
    expect(reduceGame(state, { type: 'ADD_PAWN', actor: 'p1', square: 'b2' }).ok).toBe(false);
    expect(state).toEqual(before);
    state = act(state, { type: 'ADD_PAWN', square: 'a2' });
    expect(state.phase).toEqual({ type: 'adding-pawns', additionsRemaining: 1 });
    const skipped = act(state, { type: 'SKIP_EFFECT' });
    expect(skipped.board.h2).toBeNull(); expect(skipped.currentPlayer).toBe('p2');
    state = act(state, { type: 'ADD_PAWN', square: 'h2' });
    expect(state.board.a2).not.toBe(state.board.h2); expect(state.currentPlayer).toBe('p2');
  });
  it.each(['+2', '+4'] as const)('%s pode ser ignorado completamente', type => {
    let state = withCard(sparse(kings), type);
    const before = structuredClone(state.board);
    state = act(state, { type: 'SKIP_EFFECT' });
    expect(state.board).toEqual(before); expect(state.currentPlayer).toBe('p2');
  });
  it('+4 após Reverse adiciona dama preta e um novo Reverse transfere seu controle', () => {
    let state = sparse([...kings, ['d8', 'queen', 'black']]);
    state = withCard(state, 'reverse'); state = withCard(state, 'block'); state = withCard(state, '+4');
    state = act(state, { type: 'CHOOSE_EFFECT', choice: 'add' });
    expect(effectTargets(state)).toContain('a8'); expect(effectTargets(state)).not.toContain('a1');
    state = act(state, { type: 'ADD_QUEEN', square: 'a8' });
    const extraId = state.board.a8;
    expect(Object.values(state.pieces).filter(p => p.type === 'queen' && p.color === 'black')).toHaveLength(2);
    state = withCard(state, 'reverse');
    expect(state.board.a8).toBe(extraId); expect(pieceAt(state, 'a8')?.color).toBe('black');
    expect(state.playerColors.p2).toBe('black');
  });
  it('Reverse após +2 preserva o peão e transfere controle', () => {
    let state = withCard(sparse(kings), '+2'); state = act(state, { type: 'CHOOSE_EFFECT', choice: 'add' }); state = act(state, { type: 'ADD_PAWN', square: 'a2' });
    state = act(state, { type: 'SKIP_EFFECT' }); const id = state.board.a2;
    state = withCard(state, 'reverse');
    expect(state.board.a2).toBe(id); expect(state.playerColors.p2).toBe('white');
  });
  it('não permite passar carta numérica nem agir fora da vez', () => {
    const state = withCard(createGame(2), '3');
    expect(reduceGame(state, { type: 'SKIP_EFFECT', actor: 'p1' })).toEqual({ ok: false, error: 'WRONG_PHASE' });
    expect(reduceGame(state, { type: 'MOVE', actor: 'p2', from: 'e7', to: 'e5' })).toEqual({ ok: false, error: 'WRONG_PLAYER' });
  });
});

describe('baralho e consistência', () => {
  it('PRNG mantém vetor conhecido Mulberry32', () => {
    const first = randomStep(1), second = randomStep(first.state);
    expect(first.value).toBe(0.6270739405881613);
    expect(second.value).toBe(0.002735721180215478);
  });
  it('recicla baralho de uma carta sem recursão ou duplicação', () => {
    const rules: RulesConfig = { ...DEFAULT_RULES, deckCounts: { '1': 0, '2': 0, '3': 0, block: 1, reverse: 0, '+2': 0, '+4': 0 } };
    let state = createGame(0, rules);
    for (let i = 0; i < 20; i++) state = act(state, { type: 'DRAW_CARD' });
    expect(state.turnNumber).toBe(21); expect(state.deck).toEqual([]); expect(state.discardPile).toHaveLength(1);
    expect(state.currentPlayer).toBe('p1');
  });
  it('rejeita configurações inválidas', () => {
    expect(() => createGame(-1)).toThrow();
    expect(() => createGame(0, { ...DEFAULT_RULES, deckCounts: { ...DEFAULT_RULES.deckCounts, '1': -1 } })).toThrow();
  });
  it('mesma seed e ações conservam estados idênticos e invariantes em sequências longas', () => {
    for (const seed of [0, 1, 17, 1234]) {
      let a = createGame(seed), b = createGame(seed);
      for (let step = 0; step < 180 && a.status === 'active'; step++) {
        let action: GameAction;
        if (a.phase.type === 'awaiting-draw') action = { type: 'DRAW_CARD', actor: a.currentPlayer };
        else if (a.phase.type === 'choosing-effect') action = { type: 'CHOOSE_EFFECT', actor: a.currentPlayer, choice: effectOptions(a).canAdd ? 'add' : 'move' };
        else if (a.phase.type === 'moving') {
          const moves = SQUARES.flatMap(square => legalMoves(a, square));
          expect(moves.length).toBeGreaterThan(0);
          action = { type: 'MOVE', actor: a.currentPlayer, ...moves[step % moves.length] };
        } else {
          const targets = effectTargets(a);
          action = { type: a.phase.type === 'adding-pawns' ? 'ADD_PAWN' : 'ADD_QUEEN', actor: a.currentPlayer, square: targets[0] };
        }
        const old = structuredClone(a), ra = reduceGame(a, action), rb = reduceGame(b, action);
        expect(a).toEqual(old); expect(ra.ok && rb.ok).toBe(true);
        if (!ra.ok || !rb.ok) throw new Error('Transição válida rejeitada');
        a = ra.state; b = rb.state;
        expect(a).toEqual(b);
        const occupied = Object.values(a.board).filter(Boolean);
        expect(new Set(occupied).size).toBe(occupied.length);
        expect([...occupied].sort()).toEqual(Object.keys(a.pieces).sort());
        expect(a.playerColors.p1).not.toBe(a.playerColors.p2);
        expect(controlledColor(a)).toBe(a.playerColors[a.currentPlayer]);
        const cards = [...a.deck, ...a.discardPile, ...(a.currentCard ? [a.currentCard] : [])];
        expect(cards).toHaveLength(35); expect(new Set(cards.map(c => c.id)).size).toBe(35);
        expect(Object.values(a.pieces).filter(p => p.type === 'king')).toHaveLength(a.status === 'active' ? 2 : 1);
      }
    }
  });
});
