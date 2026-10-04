import { useState } from 'react';
import { createGame, reduceGame } from '../core/tres/engine';
import type { GameAction, GameError, GameEvent, GameState } from '../core/tres/types';

interface Session {
  state: GameState;
  recentEvents: GameEvent[];
  lastEvents: GameEvent[];
  error: GameError | null;
}
export function useLocalGame() {
  const [session, setSession] = useState<Session | null>(null);
  const start = () => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    setSession({ state: createGame(seed), recentEvents: [], lastEvents: [], error: null });
  };
  const dispatch = (action: GameAction) => setSession(previous => {
    if (!previous) return previous;
    const result = reduceGame(previous.state, action);
    if (!result.ok) return { ...previous, error: result.error };
    return { state: result.state, recentEvents: [...previous.recentEvents, ...result.events].slice(-30), lastEvents: result.events, error: null };
  });
  return { session, start, dispatch, reset: () => setSession(null) };
}
