"use client";

export function AuroraLandscape({ compact = false }: { compact?: boolean }) {
  return <svg className={compact ? "aurora-landscape compact" : "aurora-landscape"} viewBox="0 0 960 500" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="alpineSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#050c36"/><stop offset="44%" stopColor="#123c97"/><stop offset="80%" stopColor="#34b4dd"/><stop offset="100%" stopColor="#96f8f4"/></linearGradient>
      <linearGradient id="highPeaks" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#faffff"/><stop offset="42%" stopColor="#a1e9ff"/><stop offset="100%" stopColor="#2a60b7"/></linearGradient>
      <linearGradient id="darkPeaks" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8c9cfb"/><stop offset="65%" stopColor="#244385"/><stop offset="100%" stopColor="#192760"/></linearGradient>
      <linearGradient id="auroraRibbon" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#47ffff"/><stop offset=".35" stopColor="#70e5fe"/><stop offset=".6" stopColor="#a477f8"/><stop offset="1" stopColor="#3519bc"/></linearGradient>
      <linearGradient id="lake" x1="0" y1="0" x2=".3" y2="1"><stop stopColor="#a5faff"/><stop offset=".45" stopColor="#32b8ec"/><stop offset="1" stopColor="#162d88"/></linearGradient>
      <radialGradient id="moonGlow"><stop stopColor="#efffff" stopOpacity=".7"/><stop offset="1" stopColor="#c5e8fe" stopOpacity="0"/></radialGradient>
      <filter id="softGlow"><feGaussianBlur stdDeviation="13"/></filter>
    </defs>
    <rect width="960" height="500" fill="url(#alpineSky)"/>
    <path d="M-80 65 C120 160 222 -8 400 70S706 174 1040 -16" fill="none" stroke="#86ecff" strokeWidth="61" opacity=".16" filter="url(#softGlow)"/>
    <path d="M-70 84 C106 179 254 -32 423 83S779 146 1060 -53" fill="none" stroke="url(#auroraRibbon)" strokeWidth="18" opacity=".7"/>
    <path d="M-80 123C168 215 243 24 426 116S704 211 1030 0" fill="none" stroke="#d3ffff" strokeWidth="4" opacity=".65"/>
    <circle cx="707" cy="103" r="105" fill="url(#moonGlow)"/><circle cx="707" cy="103" r="43" fill="#efffff" opacity=".96"/>
    {Array.from({length:20},(_,i)=><circle key={i} cx={(i*137+27)%940} cy={(i*83+33)%207} r={i%3===0?2:1} fill="#fff" opacity={.4+(i%5)/10}/>)}
    <path d="M212 337 408 108 559 290 654 190 830 341Z" fill="url(#highPeaks)"/>
    <path d="m408 108-82 98 63-27 21 32 38-39 76 100Z" fill="#f9ffff" opacity=".97"/>
    <path d="m654 190-52 71 39-13 21 24 29-16 61 77Z" fill="#e9fafe"/>
    <path d="M371 338 560 143 733 351 802 237 979 355Z" fill="url(#darkPeaks)" opacity=".82"/>
    <path d="m560 143-80 91 79-32 36 32 36-23 69 110Z" fill="#e2efff" opacity=".95"/>
    <path d="M-80 331Q104 267 268 320T655 314Q865 273 1030 330L1030 500H-80Z" fill="#10275e"/>
    <path d="M-40 340Q280 295 517 338T1030 337L1030 500H-40Z" fill="url(#lake)"/>
    <path d="M0 363Q255 328 487 369T960 355M0 397Q300 361 530 405T960 388M-20 449Q269 398 560 452T980 436" fill="none" stroke="#c9ffff" strokeWidth="7" opacity=".5"/>
    <path d="M-60 421Q220 350 440 428T970 398" fill="none" stroke="#54e5fb" strokeWidth="35" opacity=".27" filter="url(#softGlow)"/>
    <path d="M-20 420Q215 351 450 423T1000 394" fill="none" stroke="url(#auroraRibbon)" strokeWidth="14" opacity=".9"/>
    <path d="M-20 427Q215 360 457 430T1000 402" fill="none" stroke="#c9feff" strokeWidth="3" opacity=".85"/>
    {Array.from({length:11},(_,i)=>{const x=50+i*77, y=315-(i%3)*22, scale=.55+(i%4)*.17;return <g key={i} transform={`translate(${x},${y}) scale(${scale})`}><path d="M0 -140 0 18" stroke="#1c164e" strokeWidth="8"/><path d="M0 -153-46-71-25-73-60-9 0-26 60-9 25-73 46-71Z" fill={i%3===0?"#321d6a":i%3===1?"#173c75":"#17335a"}/><path d="M0-145-18-103 0-109 20-103Z" fill="#b7faff" opacity=".8"/></g>})}
    <path d="M0 470Q200 425 380 456T960 441V500H0Z" fill="#162051" opacity=".84"/>
  </svg>;
}

export function AuroraMark() {
  return <svg viewBox="0 0 60 60" width="100%" height="100%" fill="none" aria-hidden="true"><defs><linearGradient id="markIce" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#edffff"/><stop offset=".37" stopColor="#68f8ff"/><stop offset=".67" stopColor="#70a7ff"/><stop offset="1" stopColor="#c890ff"/></linearGradient></defs><path d="M30 5v50M5 30h50M12 12l36 36M48 12 12 48" stroke="url(#markIce)" strokeWidth="3" strokeLinecap="round"/><path d="m30 9-5 7m5-7 5 7M30 51l-5-7m5 7 5-7M9 30l7-5m-7 5 7 5M51 30l-7-5m7 5-7 5" stroke="#d9f8ff" strokeWidth="2" strokeLinecap="round"/><path d="m30 19 11 11-11 11-11-11Z" fill="#73dbff" fillOpacity=".35" stroke="#c7fbff" strokeWidth="1.8"/><circle cx="30" cy="30" r="5" fill="#ecffff"/></svg>;
}
