'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { WalletButton,WalletProvider } from './wallet';
import Commands from './commands';
const items = [['/', 'Обзор', '◈'], ['/trade', 'Терминал', '↗'], ['/profile', 'Профиль', '◎'], ['/leaderboard', 'Сообщество', '≡'], ['/treasury', 'Treasury', '◇']] as const;
export default function Shell({ children }: { children: React.ReactNode }) {
  return <WalletProvider><ShellContent>{children}</ShellContent></WalletProvider>;
}
function ShellContent({children}:{children:React.ReactNode}) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  return <div className="app-shell">
    <a href="#main" className="skip">К содержимому</a>
    <aside className={`rail ${open ? 'is-open' : ''}`}>
      <Link href="/" className="wordmark" onClick={() => setOpen(false)}>paperclub<span>_</span></Link>
      <div className="network-label"><span className="status-dot" /> HyperEVM · 999</div>
      <nav aria-label="Основная навигация">{items.map(([href, label, icon]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} onClick={() => setOpen(false)}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav>
      <div className="rail-bottom"><p>Независимое комьюнити.<br />Мемкоин ещё не выпущен.</p><a href="https://docs.papertrade.xyz" target="_blank" rel="noreferrer">Документация ↗</a></div>
    </aside>
    <div className="workspace">
      <header className="app-header"><button className="menu-toggle" aria-label="Открыть меню" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button><span className="header-location">{items.find(([href]) => href === path)?.[1] ?? 'Paperclub'}</span><div className="header-actions"><Commands /><span className="tag">Локальная версия</span><WalletButton /></div></header>
      <main id="main">{children}</main>
      <footer><span>Paperclub · HyperEVM</span><span>Публичные данные. Реальные заявки отключены.</span><a href="https://papertrade.xyz" target="_blank" rel="noreferrer">Papertrade ↗</a></footer>
    </div>
  </div>;
}
