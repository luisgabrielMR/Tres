import type { Color, Piece, PieceType } from '../core/chess/types';
import type { CardType, GameError, GameEvent, PlayerId } from '../core/tres/types';
export const playerName = (player: PlayerId) => player === 'p1' ? 'Jogador 1' : 'Jogador 2';
export const colorName = (color: Color) => color === 'white' ? 'Brancas' : 'Pretas';
export const pieceNames: Record<PieceType, string> = { pawn: 'Peão', rook: 'Torre', knight: 'Cavalo', bishop: 'Bispo', queen: 'Dama', king: 'Rei' };
export const symbols: Record<PieceType, string> = { pawn: '♟', rook: '♜', knight: '♞', bishop: '♝', queen: '♛', king: '♚' };
export const pieceLabel = (piece: Piece) => `${pieceNames[piece.type]}, ${colorName(piece.color).toLowerCase()}`;
export const cardName: Record<CardType, string> = { '1': 'Carta 1', '2': 'Carta 2', '3': 'Carta 3', block: 'Bloqueio', reverse: 'Reverse', '+2': '+2 Peões', '+4': '+4 Dama' };
export const errors: Record<GameError, string> = {
  GAME_FINISHED: 'Esta partida já terminou.', WRONG_PLAYER: 'Aguarde sua vez.', WRONG_PHASE: 'Essa ação não está disponível nesta carta.',
  INVALID_MOVE: 'Essa peça não pode ir para essa casa. Escolha um destino destacado.',
  PIECE_ALREADY_MOVED: 'Essa peça já foi usada nesta carta. Escolha outra peça.',
  INVALID_TARGET: 'Escolha uma casa vazia destacada.', INVALID_STATE: 'Não foi possível continuar esta partida. Volte ao início.',
};
export function eventText(event: GameEvent): string {
  switch (event.type) {
    case 'CARD_DRAWN': return `${playerName(event.actor)} comprou ${cardName[event.card.type]}.`;
    case 'EFFECT_CHOSEN': return `${playerName(event.actor)} escolheu ${event.choice === 'move' ? 'mover peças' : 'adicionar peças'}.`;
    case 'PIECE_MOVED': return `${playerName(event.actor)}: ${event.from} → ${event.to}${event.capture ? ', captura' : ''}${event.promotion ? ', promoção' : ''}.`;
    case 'COLORS_SWAPPED': return 'As cores trocaram de dono. As peças continuam nas mesmas casas.';
    case 'PIECE_ADDED': return `${playerName(event.actor)} adicionou ${event.piece.type === 'pawn' ? 'um peão' : 'uma dama'} em ${event.square}.`;
    case 'EFFECT_SKIPPED': return `${playerName(event.actor)} encerrou o efeito da carta.`;
    case 'NO_SPACE': return `Sem espaço para adicionar ${event.card === '+2' ? 'peões' : 'uma dama'} ${colorName(event.color).toLowerCase() === 'brancas' ? 'da cor branca' : 'da cor preta'}. A vez passou.`;
    case 'NO_LEGAL_MOVES': return `Sem outras peças com movimentos disponíveis. ${event.unused} movimento(s) não utilizado(s).`;
    case 'TURN_ENDED': return `${playerName(event.actor)} encerrou o turno.`;
    case 'GAME_OVER': return `${playerName(event.winner)} venceu! Rei adversário capturado.`;
  }
}
