import { Card, Logo } from '../components/primitives';

export function Home({ onLocal, onOnline, onRules }: { onLocal: () => void; onOnline: (mode: 'create' | 'join') => void; onRules: () => void }) {
  return <div className="home page-enter">
    <header className="home-header"><Logo /><button className="help-button" onClick={onRules} aria-label="Abrir regras do jogo" title="Todas as regras do jogo">?</button></header>
    <main className="home-main">
      <section className="home-copy">
        <p className="eyebrow">DUAS PESSOAS. UM TABULEIRO. UMA SURPRESA.</p>
        <h1>Uma nova carta.<br />Um outro <em>jogo.</em></h1>
        <p className="home-lead">Xadrez nos movimentos. Cartas a cada turno.<br className="desktop-only" /> Capture o rei — e cuidado: as cores podem trocar de dono.</p>
        <div className="home-actions"><button className="button primary" onClick={onLocal}>Jogar localmente <span aria-hidden="true">↗</span></button>
          <p>Duas pessoas, no mesmo dispositivo.</p></div>
        <div className="online-actions"><span className="eyebrow">À DISTÂNCIA</span>
          <div><button className="button" onClick={() => onOnline('create')}>Criar partida</button><button className="button quiet" onClick={() => onOnline('join')}>Entrar em partida</button></div></div>
      </section>
      <div className="home-art" aria-hidden="true">
        <div className="art-orbit" />
        <div className="mini-board">{Array.from({ length: 16 }, (_, i) => <i key={i} />)}<span className="hero-knight">♞</span></div>
        <div className="hero-card hero-card-back"><Card card={{ id: 'decor-3', type: '3' }} large /></div>
        <div className="hero-card hero-card-front"><Card card={{ id: 'decor-reverse', type: 'reverse' }} large /></div>
        <span className="art-note">Nada é seu para sempre.<svg viewBox="0 0 100 60"><path d="M10 10Q80 0 80 45m-12-8 12 9 8-13" /></svg></span>
        <span className="art-star star-one">✳</span><span className="art-star star-two">✦</span>
      </div>
    </main>
    <footer className="home-footer"><span>Sem contas. Sem histórico. Só a partida.</span><span>1, 2, 3… sua vez.</span></footer>
  </div>;
}
