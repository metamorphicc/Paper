'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
const commands = [
  { path: '/', title: 'Protocol overview' },
  { path: '/trade', title: 'Trading terminal' },
  { path: '/profile', title: 'Address profile' },
  { path: '/leaderboard', title: 'Community and points' },
  { path: '/rewards', title: 'Token proposals and rewards' },
  { path: '/treasury', title: 'Treasury' },
];
export default function Commands() {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState(0);
  const list = commands.filter((command) =>
    command.title.toLowerCase().includes(query.toLowerCase()),
  );
  function open() {
    setQuery('');
    setSelected(0);
    dialog.current?.showModal();
    input.current?.focus();
  }
  function navigate(path: string) {
    dialog.current?.close();
    router.push(path);
  }
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else open();
      }
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);
  return (
    <>
      <button className="button small command-trigger" aria-label="Open page search" onClick={open}>
        {' '}
        Search <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-label="Page search"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="command-content">
          <label htmlFor="command-query"> Find a page </label>
          <input
            id="command-query"
            ref={input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelected((value) => Math.min(list.length - 1, value + 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelected((value) => Math.max(0, value - 1));
              }
              if (event.key === 'Enter' && list[selected]) {
                event.preventDefault();
                event.stopPropagation();
                navigate(list[selected]!.path);
              }
            }}
          />
          <div className="command-results">
            {list.map((command, index) => (
              <button
                className={index === selected ? 'selected' : ''}
                key={command.path}
                onClick={() => navigate(command.path)}
              >
                {command.title}
                <span>↵</span>
              </button>
            ))}
            {!list.length && <p> No matching page. Try another search. </p>}
          </div>
          <button className="button small" onClick={() => dialog.current?.close()}>
            {' '}
            Close{' '}
          </button>
        </div>
      </dialog>
    </>
  );
}
