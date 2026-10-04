import type { GameAction, GameState } from '../core/tres/types';
import { DEFAULT_RULES } from '../core/tres/deck';

export const PROTOCOL = 'tres-wire-1';
export const ENGINE = 'tres-engine-3';
export const MAX_MESSAGE_BYTES = 16 * 1024;
type Stamp = { session: string; revision: number; hash: string };
export type Message =
  | ({ type: 'INIT'; protocol: typeof PROTOCOL; engine: typeof ENGINE; seed: number; rules: typeof DEFAULT_RULES } & Stamp)
  | ({ type: 'READY' | 'START' | 'ACK' | 'SYNC_CHECK' | 'SYNC_OK' } & Stamp)
  | ({ type: 'ACTION'; base: number; before: string; action: GameAction } & Stamp)
  | { type: 'LEAVE'; session: string }
  | { type: 'ERROR'; session: string };

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, required: string[], optional: string[] = []) =>
  required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const square = (v: unknown) => typeof v === 'string' && /^[a-h][1-8]$/.test(v);
const integer = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);

export function validAction(v: unknown): v is GameAction {
  if (!object(v) || !['p1', 'p2'].includes(v.actor as string)) return false;
  const base = ['type', 'actor'];
  switch (v.type) {
    case 'DRAW_CARD': case 'SKIP_EFFECT': return keys(v, base);
    case 'CHOOSE_EFFECT': return keys(v, [...base, 'choice']) && ['add', 'move'].includes(v.choice as string);
    case 'ADD_PAWN': case 'ADD_QUEEN': return keys(v, [...base, 'square']) && square(v.square);
    case 'MOVE': return keys(v, [...base, 'from', 'to'], ['promotion']) && square(v.from) && square(v.to) &&
      (!Object.hasOwn(v, 'promotion') || ['queen', 'rook', 'bishop', 'knight'].includes(v.promotion as string));
    default: return false;
  }
}

// Ordem de chaves fixa, independente de locale ou da ordem de inserção dos objetos.
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).filter(k => record[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonical(record[k])).join(',') + '}';
}
export async function stateHash(state: GameState): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(state)));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
export function parseMessage(raw: unknown): Message {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES || new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) throw new Error('INVALID_MESSAGE');
  const v: unknown = JSON.parse(raw);
  if (!object(v) || typeof v.session !== 'string' || !/^[a-f0-9]{32}$/.test(v.session)) throw new Error('INVALID_SESSION');
  if (v.type === 'LEAVE' || v.type === 'ERROR') {
    if (keys(v, ['type', 'session'])) return v as Message;
  } else {
    const stamp = ['type', 'session', 'revision', 'hash'];
    if (!integer(v.revision) || !hash(v.hash)) throw new Error('INVALID_STAMP');
    if (v.type === 'INIT') {
      if (keys(v, [...stamp, 'protocol', 'engine', 'seed', 'rules']) && v.protocol === PROTOCOL && v.engine === ENGINE &&
        integer(v.seed) && (v.seed as number) <= 0xFFFFFFFF && v.revision === 0 && canonical(v.rules) === canonical(DEFAULT_RULES)) return v as Message;
    } else if (v.type === 'ACTION') {
      if (keys(v, [...stamp, 'base', 'before', 'action']) && integer(v.base) && v.revision === (v.base as number) + 1 && hash(v.before) && validAction(v.action)) return v as Message;
    } else if (['READY', 'START', 'ACK', 'SYNC_CHECK', 'SYNC_OK'].includes(v.type as string) && keys(v, stamp)) return v as Message;
  }
  throw new Error('INVALID_PROTOCOL');
}
