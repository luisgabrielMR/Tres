import { useLayoutEffect, useState } from 'react';
import { useLocalGame } from './application/use-local-game';
import { useOnlineGame } from './application/use-online-game';
import { RulesDialog } from './ui/components/RulesDialog';
import { Game } from './ui/screens/Game';
import { Home } from './ui/screens/Home';
import { OnlineLobby } from './ui/screens/OnlineLobby';

export default function App() {
  const game = useLocalGame();
  const online = useOnlineGame();
  const [invite] = useState(() => new URLSearchParams(location.hash.slice(1)).get('sala') ?? '');
  const [screen, setScreen] = useState<'home' | 'create' | 'join'>(invite ? 'join' : 'home');
  const [rulesOpen, setRulesOpen] = useState(false);
  const onlineGame = online.view?.game;
  const isPlaying = game.session !== null || !!onlineGame?.state && onlineGame.status !== 'handshake';
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [screen, isPlaying]);
  const goHome = () => { game.reset(); online.reset(); history.replaceState(null, '', location.pathname + location.search); setScreen('home'); };
  const openOnline = (mode: 'create' | 'join') => { setScreen(mode); if (mode === 'create') online.start(mode); };
  return <>
    {onlineGame?.state && onlineGame.status !== 'handshake' ? <Game {...onlineGame} state={onlineGame.state} dispatch={online.dispatch} onExit={goHome} onRules={() => setRulesOpen(true)}
      localPlayer={online.view!.player} networkStatus={onlineGame.status} networkLocked={onlineGame.busy || onlineGame.status !== 'playing'} networkNotice={online.view?.stage === 'failed' ? online.view.message : onlineGame.status === 'paused' ? onlineGame.notice : onlineGame.busy ? 'Confirmando a jogada com o adversário…' : online.view?.route === 'relay' ? 'Conectados via relay TURN.' : online.view?.route === 'direct' ? 'Conexão direta entre os jogadores.' : 'Conectados. Conferindo a rota…'} />
      : game.session ? <Game {...game.session} dispatch={game.dispatch} onExit={goHome} onRules={() => setRulesOpen(true)} />
      : screen === 'home' ? <Home onLocal={game.start} onOnline={openOnline} onRules={() => setRulesOpen(true)} />
      : <OnlineLobby mode={screen} view={online.view} initialCode={invite} onBack={goHome} onStart={code => online.start(screen, code)} />}
    {rulesOpen && <RulesDialog onClose={() => setRulesOpen(false)} />}
  </>;
}
