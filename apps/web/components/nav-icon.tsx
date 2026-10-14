type Name = 'Overview' | 'Terminal' | 'Profile' | 'Community' | 'Rewards' | 'Research' | 'Treasury';
const paths: Record<Name, React.ReactNode> = {
  Overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  Terminal: (
    <>
      <path d="M5 3v18M12 3v18M19 3v18" />
      <rect x="3" y="7" width="4" height="7" rx="1" />
      <rect x="10" y="5" width="4" height="7" rx="1" />
      <rect x="17" y="11" width="4" height="6" rx="1" />
    </>
  ),
  Profile: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  Community: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1" />
    </>
  ),
  Rewards: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z" />
    </>
  ),
  Research: (
    <>
      <path d="M3 21h18M5 17V9M12 17V3M19 17v-5" />
      <circle cx="5" cy="6" r="1" />
      <circle cx="19" cy="9" r="1" />
    </>
  ),
  Treasury: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="13" cy="12" r="4" />
      <path d="M13 8v8M9 12h8M6 8v2M6 14v2" />
    </>
  ),
};
export function NavIcon({ name }: { name: Name }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 3h11l7 7v15H5V3Z" />
      <path d="M16 3v7h7M9 14h10M9 18h10M9 22h6" />
    </svg>
  );
}
