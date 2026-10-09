export function ArtssMark({ size = 56, className = "" }: { size?: number; className?: string }) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="artssMarkHot" x1="14" y1="91" x2="69" y2="4" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1C4D91"/><stop offset=".26" stopColor="#3B89F8"/><stop offset=".66" stopColor="#A8D0FF"/><stop offset="1" stopColor="#FFFFFF"/>
      </linearGradient>
      <linearGradient id="artssMarkGold" x1="48" y1="3" x2="89" y2="97" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF"/><stop offset=".29" stopColor="#D5E8FF"/><stop offset=".66" stopColor="#69A9FF"/><stop offset="1" stopColor="#2358A0"/>
      </linearGradient>
    </defs>
    <path d="M9 84 40 18c5-11 17-12 23-1l29 66c3 7-1 12-7 12H70c-4 0-7-2-9-6L49 57 35 89c-2 4-4 6-9 6H14c-7 0-9-5-5-11Z" fill="url(#artssMarkHot)"/>
    <path d="m53 9 11 8 28 66c3 7-1 12-7 12H70c-5 0-8-3-10-8L42 43l11-34Z" fill="url(#artssMarkGold)"/>
    <path d="m18 83 30-62 5-12-3 25-25 53-11 4 4-8Z" fill="#FFFFFF" opacity=".6"/>
    <path d="M33 68h34l9 18H24l9-18Z" fill="#C5E0FF"/>
    <path d="M34 73h34l5 10H29l5-10Z" fill="#3E87E8"/>
    <path d="m74 14 4 8 9 3-9 3-4 9-3-9-9-3 9-3 3-8Z" fill="#DBE9FF"/>
    <path d="m74 19 2 5 5 1-5 2-2 5-2-5-5-2 5-1 2-5Z" fill="#FFFFFF"/>
  </svg>;
}
