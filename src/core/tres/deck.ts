import type { Card, CardType, RulesConfig } from './types';
export const CARD_TYPES: CardType[] = ['1', '2', '3', 'block', 'reverse', '+2', '+4'];
export const DEFAULT_RULES: RulesConfig = {
  rulesVersion: 'tres-v3-effect-moves', startingPlayer: 'p1',
  deckCounts: { '1': 12, '2': 8, '3': 4, block: 3, reverse: 3, '+2': 3, '+4': 2 },
};
export function validateRules(rules: RulesConfig): void {
  if (rules.rulesVersion !== 'tres-v3-effect-moves' || !['p1', 'p2'].includes(rules.startingPlayer) ||
    Object.keys(rules.deckCounts).length !== CARD_TYPES.length ||
    CARD_TYPES.some(type => !Number.isInteger(rules.deckCounts[type]) || rules.deckCounts[type] < 0)) throw new Error('Configuração de regras inválida.');
  const total = CARD_TYPES.reduce((sum, type) => sum + rules.deckCounts[type], 0);
  if (total < 1 || total > 512) throw new Error('O baralho precisa conter entre 1 e 512 cartas.');
}
export function randomStep(state: number): { value: number; state: number } {
  const next = (state + 0x6D2B79F5) >>> 0;
  let t = Math.imul(next ^ (next >>> 15), next | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}
export function shuffle<T>(source: readonly T[], rngState: number): { items: T[]; rngState: number } {
  const items = [...source];
  for (let i = items.length - 1; i > 0; i--) {
    const step = randomStep(rngState); rngState = step.state;
    const j = Math.floor(step.value * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return { items, rngState };
}
export function makeDeck(rules: RulesConfig): Card[] {
  return CARD_TYPES.flatMap(type => Array.from({ length: rules.deckCounts[type] }, (_, i) => ({ id: `${type}-${i}`, type })));
}
