import { useEffect, useState } from 'react';
import { isKingThreatened } from '../../core/chess/moves';
import { oppositeColor, pieceAt, SQUARES } from '../../core/chess/types';
import type { Color, Move, Promotion, Square } from '../../core/chess/types';
import { controlledColor, effectOptions, effectTargets, legalMoves, movementBudget } from '../../core/tres/engine';
import type { GameAction, GameError, GameEvent, GameState, PlayerId } from '../../core/tres/types';
import { Board } from '../components/Board';
import { TurnNotice } from '../components/TurnNotice';
import { Card, ColorChip, Logo, Modal } from '../components/primitives';
import { cardName, colorName, errors, eventText, pieceNames, playerName, symbols } from '../labels';

interface Props { state: GameState; recentEvents: GameEvent[]; lastEvents: GameEvent[]; error: GameError | null; dispatch: (action: GameAction) => void; onExit: () => void; onRules: () => void; localPlayer?: PlayerId; networkLocked?: boolean; networkNotice?: string; networkStatus?: 'handshake' | 'playing' | 'paused' | 'failed' }
export function Game({ state, recentEvents, lastEvents, error, dispatch, onExit, onRules, localPlayer, networkLocked = false, networkNotice, networkStatus }: Props) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<Move | null>(null);
  const [promotion, setPromotion] = useState<Promotion>('queen');
  const [feedback, setFeedback] = useState('');
  const [exitOpen, setExitOpen] = useState(false);
  const [dismissedVictory, setDismissedVictory] = useState(false);
  const color = controlledColor(state), orientation = localPlayer ? state.playerColors[localPlayer] : color;
  const canAct = !localPlayer || !networkLocked && state.currentPlayer === localPlayer;
  useEffect(() => { setSelected(null); setPendingPromotion(null); setFeedback(''); }, [state.revision, canAct]);
  const targets = canAct && selected ? legalMoves(state, selected).map(move => move.to) : [];
  const draggableSquares = canAct ? SQUARES.filter(square => legalMoves(state, square).length > 0) : [];
  const additions = canAct ? effectTargets(state) : [];
  const options = effectOptions(state);
  const lastDraw = [...recentEvents].reverse().find(e => e.type === 'CARD_DRAWN');
  const displayCard = state.currentCard ?? (lastDraw?.type === 'CARD_DRAWN' ? lastDraw.card : null);
  const justEnded = state.phase.type === 'awaiting-draw' && !!displayCard;
  const reverseEvent = [...recentEvents].reverse().find(e => e.type === 'COLORS_SWAPPED');
  const reverseVisible = justEnded && displayCard?.type === 'reverse' && reverseEvent?.type === 'COLORS_SWAPPED';
  const noSpace = lastEvents.find(e => e.type === 'NO_SPACE');
  const noMoves = lastEvents.find(e => e.type === 'NO_LEGAL_MOVES');
  const movedCount = state.phase.type === 'moving' ? movementBudget(state) - state.phase.movesRemaining : 0;
  const lastMove = state.lastMove;
  const activeThreatened = isKingThreatened(state, localPlayer ? orientation : color);

  function send(action: GameAction) { if (!canAct) return; setFeedback(''); setSelected(null); dispatch(action); }
  function attemptMove(from: Square, to: Square | null) {
    if (!canAct) return;
    if (!to || from === to) { setSelected(from); return; }
    const move = legalMoves(state, from).find(candidate => candidate.to === to);
    if (!move) { setSelected(from); setFeedback('Destino inválido. A peça voltou à origem; nenhum movimento foi gasto.'); return; }
    if (move.promotion) { setPendingPromotion({ from, to }); setPromotion('queen'); }
    else send({ type: 'MOVE', actor: state.currentPlayer, ...move });
  }
  function onSquare(square: Square) {
    if (!canAct || state.status === 'finished') return;
    if (state.phase.type === 'awaiting-draw') { setFeedback('Compre uma carta antes de escolher uma peça.'); return; }
    if (state.phase.type === 'choosing-effect') { setFeedback('Escolha primeiro: adicionar peças ou mover peças.'); return; }
    if (state.phase.type === 'adding-pawns' || state.phase.type === 'adding-queen') {
      if (!additions.includes(square)) { setFeedback('Escolha uma casa vazia com o símbolo +.'); return; }
      send({ type: state.phase.type === 'adding-pawns' ? 'ADD_PAWN' : 'ADD_QUEEN', actor: state.currentPlayer, square }); return;
    }
    if (selected && targets.includes(square)) {
      attemptMove(selected, square);
      return;
    }
    const piece = pieceAt(state, square);
    if (piece?.color === color) {
      if (state.phase.type === 'moving' && state.phase.movedPieceIds.includes(piece.id)) { setFeedback('Essa peça já foi usada nesta carta. Escolha outra peça.'); setSelected(null); return; }
      if (!legalMoves(state, square).length) { setFeedback('Esta peça não tem movimentos disponíveis. Escolha outra.'); setSelected(null); return; }
      setSelected(selected === square ? null : square); setFeedback('');
    } else { setFeedback(selected ? 'Destino inválido. Escolha uma casa destacada.' : `Escolha uma peça das ${colorName(color).toLowerCase()}.`); }
  }
  function strip(stripColor: Color) {
    const player: PlayerId = state.playerColors.p1 === stripColor ? 'p1' : 'p2';
    const turn = player === state.currentPlayer;
    return <div className={`player-strip ${turn ? 'active-player' : ''}`}><span className="avatar">{player === 'p1' ? 'J1' : 'J2'}</span>
      <strong>{playerName(player)}{player === localPlayer ? ' · Você' : ''}</strong><ColorChip color={stripColor} /><span className="player-status">{state.status === 'finished' ? state.winner === player ? 'Venceu' : 'Fim' : turn ? '▶ Na vez' : 'Aguardando'}</span></div>;
  }
  return <div className="game-shell page-enter">
    <header className="game-header"><Logo /><span className="mode-badge"><span aria-hidden="true">▣</span> {localPlayer ? 'Online' : 'Local'} <span className="desktop-only">{localPlayer ? '· dois navegadores' : '· mesmo dispositivo'}</span></span><div className="header-spacer" /><button className="help-button" onClick={onRules} aria-label="Abrir regras do jogo" title="Todas as regras do jogo">?</button><button className="button quiet small" onClick={() => setExitOpen(true)}>Sair</button></header>
    <div className="mobile-turn-summary"><strong>{playerName(state.currentPlayer)}</strong><span>{state.phase.type === 'choosing-effect' ? `${state.currentCard?.type} · escolha como jogar ↓` : state.phase.type === 'moving' ? `${state.currentCard ? cardName[state.currentCard.type] : ''} · ${state.phase.movesRemaining} movimento(s)` : state.phase.type === 'adding-pawns' ? `+2 · ${state.phase.additionsRemaining} peão(ões)` : state.phase.type === 'adding-queen' ? '+4 · adicionar dama' : state.phase.type === 'finished' ? 'Partida encerrada' : 'Comprar carta ↓'}</span></div>
    <main className="game-layout">
      <section className="board-column" aria-label="Área do tabuleiro">
        <div className="board-caption"><span className="eyebrow">A MESA É DE VOCÊS</span><span>Turno {state.turnNumber.toString().padStart(2, '0')}</span></div>
        {strip(oppositeColor(orientation))}
        <Board state={state} orientation={orientation} selected={selected} targets={targets} additions={additions} onSquare={onSquare} draggableSquares={draggableSquares} onPieceDragStart={from => { setSelected(from); setFeedback(''); }} onPieceDrop={attemptMove} />
        {strip(orientation)}
        <div className="board-legend"><span><i className="legend-selected" />Selecionada</span><span><i className="legend-target" />Destino</span><span><i className="legend-last" />Última jogada</span><span><i className="legend-used">✓</i>Já utilizada</span></div>
      </section>
      <aside className="game-panel" aria-label="Turno e carta">
        <div className="panel-heading"><p className="eyebrow">{state.status === 'finished' ? 'PARTIDA ENCERRADA' : 'AGORA É A VEZ DE'}</p><h1>{playerName(state.currentPlayer)}</h1><p>Controla as <strong>{colorName(color).toLowerCase()}</strong> neste turno.</p></div>
        <div className="card-box"><div className="card-animation" key={displayCard?.id ? `${displayCard.id}-${state.turnNumber - (justEnded ? 1 : 0)}` : 'back'}><Card card={displayCard} /></div>
          <div className="card-details"><p className="eyebrow">{justEnded ? 'CARTA ANTERIOR · RESOLVIDA' : displayCard ? localPlayer && state.currentPlayer !== localPlayer ? 'CARTA DO ADVERSÁRIO' : 'SUA CARTA' : 'O QUE VEM AGORA?'}</p><h2>{displayCard ? cardName[displayCard.type] : 'Sua vez de virar.'}</h2><p>{!displayCard ? 'Uma carta decide as possibilidades do seu turno.' : justEnded ? 'O próximo jogador já pode comprar.' : state.phase.type === 'choosing-effect' ? `Adicionar peças ou fazer ${movementBudget(state)} movimentos. Você escolhe.` : state.phase.type === 'moving' && (displayCard.type === '+2' || displayCard.type === '+4') ? `Você escolheu ${movementBudget(state)} movimentos com peças diferentes.` : displayCard.type === '+2' ? 'Até dois novos peões para a sua cor.' : displayCard.type === '+4' ? 'Uma nova dama. Mais possibilidades.' : 'Cada movimento, uma peça diferente.'}</p></div></div>
        <section className="turn-card" aria-label="Como jogar este turno">
        {localPlayer && <TurnNotice title={networkStatus === 'failed' ? 'Partida interrompida' : networkStatus === 'paused' ? 'Aguardando conexão' : networkLocked ? 'Confirmando jogada' : state.currentPlayer === localPlayer ? 'Sua vez' : 'Vez do adversário'} tone={networkLocked ? 'warning' : 'info'}><p>{networkNotice}</p></TurnNotice>}
        {networkStatus === 'failed' ? <button className="button primary full" onClick={onExit}>Voltar ao início</button> : <fieldset className="turn-actions action-fieldset" disabled={!canAct && state.status !== 'finished'} aria-live="polite">
          {state.phase.type === 'choosing-effect' && <><div><p className="eyebrow">DOIS CAMINHOS, UMA ESCOLHA</p><h2 className="action-title">Como você quer jogar?</h2></div><div className="effect-choices">
            <button className="effect-choice" disabled={!options.canAdd} onClick={() => send({ type: 'CHOOSE_EFFECT', actor: state.currentPlayer, choice: 'add' })}><span className="choice-symbol" aria-hidden="true">{state.currentCard?.type === '+2' ? '♟' : '♛'}</span><span><strong>{state.currentCard?.type === '+2' ? 'Adicionar até 2 peões' : 'Adicionar uma dama'}</strong><small>{options.canAdd ? 'Use as casas livres da sua cor.' : 'Não há espaço na fileira inicial.'}</small></span><span aria-hidden="true">↗</span></button>
            <button className="effect-choice" disabled={!options.canMove} onClick={() => send({ type: 'CHOOSE_EFFECT', actor: state.currentPlayer, choice: 'move' })}><span className="choice-symbol" aria-hidden="true">↝</span><span><strong>Fazer {movementBudget(state)} movimentos</strong><small>{options.canMove ? 'Use peças diferentes que já estão no tabuleiro.' : 'Nenhuma peça tem movimento disponível.'}</small></span><span aria-hidden="true">↗</span></button>
          </div><p className="choice-note">A escolha vale para toda a carta. Não é possível combinar os dois efeitos.</p><button className="button quiet small full" onClick={() => send({ type: 'SKIP_EFFECT', actor: state.currentPlayer })}>Ignorar carta e passar a vez</button></>}
          {state.phase.type === 'awaiting-draw' && <><p className="action-title">{localPlayer ? state.currentPlayer === localPlayer ? 'Sua vez de comprar a próxima carta.' : 'Aguardando o adversário comprar.' : justEnded ? 'Passe a vez. A próxima carta espera.' : 'Vamos começar?'}</p><button className="button primary full" onClick={() => send({ type: 'DRAW_CARD', actor: state.currentPlayer })}>Comprar carta <span aria-hidden="true">↗</span></button></>}
          {state.phase.type === 'moving' && <><div className="moves-count"><div className="pips">{Array.from({ length: movementBudget(state) }, (_, i) => <span key={i} className={i < movedCount ? 'used' : ''} aria-label={i < movedCount ? 'Movimento usado' : 'Movimento disponível'}>{i < movedCount ? '✓' : i + 1}</span>)}</div><h2>{state.phase.movesRemaining} movimento{state.phase.movesRemaining > 1 ? 's' : ''}<small>restante{state.phase.movesRemaining > 1 ? 's' : ''}</small></h2></div>
            <p className="selection-hint">{selected ? `${pieceNames[pieceAt(state, selected)!.type]} em ${selected}. Escolha um destino destacado.` : 'Clique na peça e no destino, ou arraste para jogar.'}</p>
            <p className="rule-reminder"><span aria-hidden="true">ⓘ</span> Cada peça só pode mover uma vez por carta.</p></>}
          {(state.phase.type === 'adding-pawns' || state.phase.type === 'adding-queen') && <><h2 className="action-title">{state.phase.type === 'adding-pawns' ? `${state.phase.additionsRemaining} peão${state.phase.additionsRemaining > 1 ? 's' : ''} disponíve${state.phase.additionsRemaining > 1 ? 'is' : 'l'}` : 'Uma nova dama para você.'}</h2><p>Toque em uma casa com <strong>+</strong> para adicionar {state.phase.type === 'adding-pawns' ? 'um peão' : 'a dama'} da sua cor.</p><button className="button full" onClick={() => send({ type: 'SKIP_EFFECT', actor: state.currentPlayer })}>{state.phase.type === 'adding-pawns' && state.phase.additionsRemaining === 1 ? 'Encerrar com 1 peão' : 'Ignorar carta'}</button></>}
          {state.status === 'finished' && <><p className="action-title">{playerName(state.winner!)} venceu!</p><button className="button primary full" onClick={onExit}>Voltar ao início</button></>}
        </fieldset>}
        {reverseVisible && <TurnNotice title="As cores trocaram de dono" tone="reverse" icon="⇄"><div className="swap-colors">{(['p1', 'p2'] as const).map(player => <div key={player}><span>{playerName(player)}</span><ColorChip color={state.playerColors[player]} /></div>)}</div><p>As peças continuam onde estavam. Agora é a vez do {playerName(state.currentPlayer)}.</p></TurnNotice>}
        {justEnded && displayCard?.type === 'block' && <TurnNotice title="Essa vez foi bloqueada" icon="⊘"><p>Nenhuma peça se moveu. {playerName(state.currentPlayer)}, compre sua carta para continuar.</p></TurnNotice>}
        {(noSpace || noMoves) && <TurnNotice title="A vez passou" tone="warning"><p>{noSpace && noMoves ? 'Não havia espaço para adicionar peças nem um movimento disponível. O próximo jogador pode comprar.' : 'Nenhuma outra peça pode mover nesta carta. O saldo não utilizado foi dispensado.'}</p></TurnNotice>}
        {(feedback || error) && <TurnNotice title="Vamos tentar de outro jeito" tone="warning" icon="!"><p>{feedback || (error ? errors[error] : '')}</p></TurnNotice>}
        {activeThreatened && state.status === 'active' && <TurnNotice title="Seu rei está ameaçado" tone="warning" icon="♚"><p>Você pode continuar jogando normalmente. Lembre-se: a captura do rei encerra a partida.</p></TurnNotice>}
        </section>
        <div className="last-move"><p className="eyebrow">ÚLTIMA JOGADA</p><p>{lastMove ? <><strong>{pieceNames[lastMove.pieceType]} {lastMove.from} <span aria-hidden="true">→</span> {lastMove.to}</strong><span className="muted"> · {colorName(lastMove.color)}</span></> : 'O tabuleiro está esperando por vocês.'}</p></div>
        <div className="events"><p className="eyebrow">NA MESA</p><ol>{recentEvents.filter(e => e.type !== 'TURN_ENDED').slice(-3).map((e, i) => <li key={`${state.revision}-${i}`}>{eventText(e)}</li>)}</ol>{!recentEvents.length && <p>Partida {localPlayer ? 'online' : 'local'} iniciada. Boa partida!</p>}</div>
        <p className="session-note">{localPlayer ? 'Apenas na memória dos dois navegadores.' : 'Só neste dispositivo.'} Ao fechar ou atualizar, a partida é perdida.</p>
      </aside>
    </main>
    {pendingPromotion && <Modal title="Uma nova peça, sua escolha." onClose={() => setPendingPromotion(null)}><p>Promover peão de {pendingPromotion.from} para {pendingPromotion.to}. A peça promovida só poderá mover em outra carta.</p><fieldset className="promotion-options"><legend>Escolha a peça</legend>{(['queen', 'rook', 'bishop', 'knight'] as const).map(type => <label key={type} className={promotion === type ? 'chosen' : ''}><input type="radio" name="promotion" value={type} checked={promotion === type} onChange={() => setPromotion(type)} /><span className={`promotion-piece ${color}`} aria-hidden="true">{symbols[type]}</span>{pieceNames[type]}</label>)}</fieldset><div className="modal-actions"><button className="button quiet" onClick={() => setPendingPromotion(null)}>Cancelar</button><button className="button primary" onClick={() => { send({ type: 'MOVE', actor: state.currentPlayer, ...pendingPromotion, promotion }); setPendingPromotion(null); }}>Confirmar promoção</button></div></Modal>}
    {exitOpen && <Modal title="Sair da partida?" onClose={() => setExitOpen(false)}><p>A partida fica apenas na memória deste dispositivo. Ao sair, ela será perdida.</p><div className="modal-actions"><button className="button quiet" onClick={() => setExitOpen(false)}>Continuar jogando</button><button className="button primary" onClick={onExit}>Sair da partida</button></div></Modal>}
    {state.status === 'finished' && !dismissedVictory && <Modal title={`${playerName(state.winner!)} venceu!`} onClose={() => setDismissedVictory(true)} className="victory-modal"><div className="victory-crown" aria-hidden="true">♛</div><p>Rei adversário capturado.</p><ColorChip color={state.playerColors[state.winner!]} /><p className="muted">A cor do vencedor no momento da captura.</p><button className="button primary full" onClick={onExit}>Voltar ao início</button></Modal>}
  </div>;
}
