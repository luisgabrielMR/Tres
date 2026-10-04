import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Color } from '../../core/chess/types';
import type { Card as GameCard } from '../../core/tres/types';
import { cardName, colorName } from '../labels';

export function Logo({ large = false }: { large?: boolean }) {
  return <span className={`logo ${large ? 'large' : ''}`}><svg viewBox="0 0 58 58" aria-hidden="true">
    <rect x="6" y="12" width="24" height="34" rx="4" transform="rotate(-14 18 29)" fill="#FFFDF8" stroke="currentColor" strokeWidth="2.5" />
    <rect x="17" y="9" width="24" height="34" rx="4" fill="#FFFDF8" stroke="currentColor" strokeWidth="2.5" />
    <rect x="28" y="12" width="24" height="34" rx="4" transform="rotate(14 40 29)" fill="#2742B0" stroke="#1A2D7C" strokeWidth="2.5" />
  </svg>Três<span className="logo-dot">.</span></span>;
}
export function ColorChip({ color }: { color: Color }) {
  return <span className={`color-chip ${color}`}><span aria-hidden="true">♚</span>{colorName(color)}</span>;
}
export function Card({ card, large = false }: { card: GameCard | null; large?: boolean }) {
  const value = !card ? 'Três' : card.type === 'reverse' ? '⇄' : card.type === 'block' ? '⊘' : card.type;
  return <div className={`playing-card ${!card ? 'card-back' : ''} ${large ? 'card-large' : ''}`} aria-label={card ? cardName[card.type] : 'Monte de cartas'} role="img">
    {card && <span className="corner">{value}</span>}
    <span className="card-symbol" aria-hidden="true">{value}</span>
    {(card?.type === '+2' || card?.type === '+4') && <span className="card-piece" aria-hidden="true">{card.type === '+2' ? '♟♟' : '♛'}</span>}
    <span className="card-title">{card ? cardName[card.type] : 'UMA CARTA. SUA VEZ.'}</span>
    {card && <span className="corner bottom">{value}</span>}
  </div>;
}
export function Modal({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar">×</button></div>
    {children}
  </dialog>;
}
