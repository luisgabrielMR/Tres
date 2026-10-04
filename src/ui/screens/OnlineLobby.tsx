import { useState } from 'react';
import { Logo } from '../components/primitives';
import { TurnNotice } from '../components/TurnNotice';
import type { OnlineView } from '../../multiplayer/connection';
import { normalizeCode, validCode } from '../../multiplayer/connection';

export function OnlineLobby({ mode, view, initialCode, onStart, onBack }: {
  mode: 'create' | 'join'; view: OnlineView | null; initialCode: string;
  onStart: (code: string) => void; onBack: () => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [copyMessage, setCopyMessage] = useState('');
  const busy = view !== null && view.stage !== 'failed';
  async function copy() {
    if (!view) return;
    const url = new URL(location.href); url.hash = `sala=${view.code}`;
    try { await navigator.clipboard.writeText(url.href); setCopyMessage('Convite copiado! Envie para seu amigo.'); }
    catch { setCopyMessage('Não foi possível copiar. Compartilhe o código exibido acima.'); }
  }
  return <main className="lobby page-enter"><Logo /><div className="lobby-box">
    <p className="eyebrow">JOGAR À DISTÂNCIA</p><h1>{mode === 'create' ? 'Uma mesa para dois.' : 'Encontre sua mesa.'}</h1>
    {mode === 'create' ? <><p>Compartilhe o convite e mantenha esta página aberta.</p>
      {view && view.stage !== 'connecting' && view.stage !== 'failed' && <><div className="room-code" aria-label="Código da partida">{view.code}</div><button className="button full" onClick={() => void copy()}>Copiar convite</button><p role="status">{copyMessage}</p></>}
      {!busy && <button className="button primary full" onClick={() => onStart('')}>{view ? 'Criar outra partida' : 'Gerar convite'}</button>}</>
      : <form onSubmit={e => { e.preventDefault(); if (validCode(normalizeCode(code)) && !busy) onStart(code); }}>
        <label className="code-label">Código da partida<input value={code} onChange={e => setCode(normalizeCode(e.target.value))} disabled={busy} placeholder="Ex.: K7P4X2AB" maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false} /></label>
        <button className="button primary full" disabled={busy || !validCode(normalizeCode(code))}>Entrar em partida</button>
      </form>}
    {view && <div role="status"><TurnNotice title={view.stage === 'failed' ? 'Não foi possível continuar' : view.stage === 'waiting' ? 'A mesa está pronta' : 'Preparando sua partida'} tone={view.stage === 'failed' ? 'warning' : 'info'}><p>{view.message}</p></TurnNotice></div>}
    <p className="session-note">Sem conta e sem histórico. Ao sair ou atualizar, a sessão é perdida. Mantenham as duas páginas abertas durante a conexão e a partida.</p>
    <button className="button quiet full" onClick={onBack}>{busy ? 'Cancelar e voltar' : 'Voltar ao início'}</button>
  </div></main>;
}
