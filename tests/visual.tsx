// Bancada somente de desenvolvimento. Não integra o bundle de produção.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/noto-sans-symbols-2';
import '../src/ui/styles.css';
import { createGame, reduceGame } from '../src/core/tres/engine';
import type { CardType, GameAction, GameEvent, GameState } from '../src/core/tres/types';
import type { Color, PieceType, Square } from '../src/core/chess/types';
import { SQUARES } from '../src/core/chess/types';
import { Game } from '../src/ui/screens/Game';

function fixture(name: string): { state: GameState; events: GameEvent[] } {
  const state = createGame(1);
  const remove = (square: Square) => { const id = state.board[square]; if (id) delete state.pieces[id]; state.board[square] = null; };
  const put = (square: Square, type: PieceType, color: Color) => {
    const id = `fixture-${square}`; state.board[square] = id; state.pieces[id] = { id, type, color, hasMoved: true };
  };
  let card: CardType = '3';
  if (name === 'Peões') { remove('e2'); remove('h2'); card = '+2'; }
  if (name === 'Dama após Reverse') { remove('b8'); remove('g8'); card = '+4'; state.playerColors = { p1: 'black', p2: 'white' }; }
  if (name === 'Reverse') card = 'reverse';
  if (name === 'Bloqueio') card = 'block';
  if (name === 'Sem espaço') card = '+2';
  if (name === 'Promoção' || name === 'Vitória') {
    SQUARES.forEach(remove); put('e1', 'king', 'white'); put('e8', 'king', 'black');
    if (name === 'Promoção') { put('b7', 'pawn', 'white'); put('a1', 'rook', 'white'); }
    else put('e7', 'queen', 'white');
    state.castlingRights.white.kingSide.allowed = state.castlingRights.white.queenSide.allowed = false;
    state.castlingRights.black.kingSide.allowed = state.castlingRights.black.queenSide.allowed = false;
  }
  const draw = state.deck.find(c => c.type === card)!;
  state.deck = [draw, ...state.deck.filter(c => c.id !== draw.id)];
  const result = reduceGame(state, { type: 'DRAW_CARD', actor: 'p1' });
  if (!result.ok) throw new Error(result.error);
  return { state: result.state, events: result.events };
}
function Harness() {
  const [name, setName] = useState('Numérica');
  const [session, setSession] = useState(() => fixture('Numérica'));
  const [recent, setRecent] = useState(session.events);
  const change = (value: string) => { const next = fixture(value); setName(value); setSession(next); setRecent(next.events); };
  const dispatch = (action: GameAction) => {
    const result = reduceGame(session.state, action);
    if (!result.ok) throw new Error(result.error);
    setSession({ state: result.state, events: result.events }); setRecent([...recent, ...result.events]);
  };
  return <><div style={{ padding: 12, background: '#e2e7f8', textAlign: 'center' }}><label>Bancada visual — dados de teste <select aria-label="Cenário" value={name} onChange={event => change(event.target.value)}>{['Numérica', 'Peões', 'Dama após Reverse', 'Reverse', 'Bloqueio', 'Sem espaço', 'Promoção', 'Vitória'].map(value => <option key={value}>{value}</option>)}</select></label></div><Game key={name} state={session.state} recentEvents={recent} lastEvents={session.events} error={null} dispatch={dispatch} onExit={() => change('Numérica')} onRules={() => {}} /></>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
