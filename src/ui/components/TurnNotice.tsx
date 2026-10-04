import type { ReactNode } from 'react';

export function TurnNotice({ title, children, tone = 'info', icon = 'i' }: {
  title: string; children: ReactNode; tone?: 'info' | 'warning' | 'reverse'; icon?: string;
}) {
  return <div className={`turn-notice ${tone}`} role={tone === 'warning' ? 'alert' : 'status'}>
    <span className="turn-notice-icon" aria-hidden="true">{icon}</span>
    <div className="turn-notice-copy"><h3>{title}</h3><div>{children}</div></div>
  </div>;
}
