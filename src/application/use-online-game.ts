import { useEffect, useRef, useState } from 'react';
import { OnlineConnection } from '../multiplayer/connection';
import type { OnlineView } from '../multiplayer/connection';
import type { GameAction } from '../core/tres/types';

export function useOnlineGame() {
  const connection = useRef<OnlineConnection | null>(null);
  const [view, setView] = useState<OnlineView | null>(null);
  useEffect(() => () => { connection.current?.close(); }, []);
  function reset() { connection.current?.close(); connection.current = null; setView(null); }
  function start(mode: 'create' | 'join', code = '') {
    reset();
    const next = new OnlineConnection(mode, code, setView);
    connection.current = next; void next.start();
  }
  return { view, start, reset, dispatch: (action: GameAction) => connection.current?.dispatch(action) };
}
