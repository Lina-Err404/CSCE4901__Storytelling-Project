export function CoverFrame() {
  return <div className="cover-frame" aria-hidden="true" />;
}

export function CoverBook() {
  return (
    <svg
      className="cover-book"
      viewBox="0 0 180 128"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M38 64c-9-21-2-42 13-55M142 64c9-21 2-42-13-55" opacity=".65" />
      <path d="M37 48c-13-3-18-11-16-20 11 3 17 10 16 20ZM39 29c-2-12 2-20 11-24 3 11-1 19-11 24ZM143 48c13-3 18-11 16-20-11 3-17 10-16 20ZM141 29c2-12-2-20-11-24-3 11 1 19 11 24Z" opacity=".8" />
      <path d="M90 66C77 55 59 53 43 57v48c17-4 34-1 47 10 13-11 30-14 47-10V57c-16-4-34-2-47 9Z" fill="currentColor" fillOpacity=".06" />
      <path d="M43 63h-7v48c19-5 37-2 54 10 17-12 35-15 54-10V63h-7M90 66v49M53 68c10-1 20 1 28 6M53 79c10-1 20 1 28 6M53 90c10-1 20 1 28 6M99 74c8-5 18-7 28-6M99 85c8-5 18-7 28-6M99 96c8-5 18-7 28-6" />
      <path d="m90 14 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z" fill="currentColor" stroke="none" />
      <path d="m66 37 1.5 4.5L72 43l-4.5 1.5L66 49l-1.5-4.5L60 43l4.5-1.5ZM115 42l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="currentColor" stroke="none" />
      <circle cx="111" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
