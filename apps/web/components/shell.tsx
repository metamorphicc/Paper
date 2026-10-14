'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WalletButton, WalletProvider } from './wallet';
import Commands from './commands';
import { BrandMark, NavIcon } from './nav-icon';
const items = [
  ['/', 'Overview', '◈'],
  ['/trade', 'Terminal', '↗'],
  ['/profile', 'Profile', '◎'],
  ['/leaderboard', 'Community', '≡'],
  ['/rewards', 'Rewards', '◇'],
  ['/research', 'Research', '⌁'],
  ['/treasury', 'Treasury', '◇'],
] as const;
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <ShellContent>{children}</ShellContent>
    </WalletProvider>
  );
}
function ShellContent({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 70rem)');
    const resize = () => {
      if (desktop.matches) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    desktop.addEventListener('change', resize);
    window.addEventListener('keydown', escape);
    return () => {
      desktop.removeEventListener('change', resize);
      window.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <div className="app-shell">
      <a href="#main" className="skip">
        {' '}
        Skip to content{' '}
      </a>
      <header className="product-header">
        <div className="product-header-inner">
          <Link href="/" className="wordmark" onClick={() => setOpen(false)}>
            <BrandMark />
            <span className="brand-name">
              paperclub<span>_</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            {items.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Commands />
            <WalletButton />
            <button
              className="menu-toggle"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? '×' : '☰'}
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div className="mobile-navigation" id="mobile-navigation">
          <nav aria-label="Mobile navigation">
            {items.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <NavIcon name={label} />
                {label}
              </Link>
            ))}
          </nav>
          <p>HyperEVM · Independent community · Local preview</p>
        </div>
      )}
      <div className="workspace">
        <main id="main" inert={open}>
          {children}
        </main>
        <footer inert={open}>
          <span>Paperclub · HyperEVM</span>
          <span> Public data. Live intents disabled. </span>
          <a href="https://papertrade.xyz" target="_blank" rel="noreferrer">
            Papertrade ↗
          </a>
          <a href="https://docs.papertrade.xyz" target="_blank" rel="noreferrer">
            Documentation ↗
          </a>
        </footer>
      </div>
    </div>
  );
}
