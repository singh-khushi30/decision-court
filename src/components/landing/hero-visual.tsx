type Leaf = {
  x: number;
  y: number;
  r: number;
  s: number;
  fill: string;
  kind: "olive" | "round" | "slim";
};

const leaves: Leaf[] = [
  { x: 118, y: 28, r: -70, s: 0.72, fill: "#3d4a32", kind: "slim" },
  { x: 142, y: 22, r: 24, s: 0.95, fill: "#6e7d56", kind: "olive" },
  { x: 96, y: 58, r: -36, s: 1.15, fill: "#546246", kind: "round" },
  { x: 132, y: 64, r: 52, s: 0.78, fill: "#7d8c64", kind: "olive" },
  { x: 168, y: 48, r: 18, s: 0.62, fill: "#4e5c3e", kind: "slim" },
  { x: 78, y: 96, r: -58, s: 0.88, fill: "#3f4c34", kind: "olive" },
  { x: 112, y: 102, r: 8, s: 1.22, fill: "#62704e", kind: "round" },
  { x: 154, y: 92, r: 46, s: 0.84, fill: "#849366", kind: "olive" },
  { x: 186, y: 78, r: 68, s: 0.7, fill: "#556244", kind: "slim" },
  { x: 64, y: 138, r: -24, s: 1.05, fill: "#46543a", kind: "olive" },
  { x: 98, y: 146, r: 16, s: 0.74, fill: "#73825a", kind: "round" },
  { x: 136, y: 132, r: -12, s: 1.18, fill: "#3c4a32", kind: "olive" },
  { x: 172, y: 128, r: 38, s: 0.66, fill: "#8a9870", kind: "slim" },
  { x: 204, y: 112, r: 72, s: 0.92, fill: "#5a6848", kind: "round" },
  { x: 52, y: 178, r: -48, s: 0.8, fill: "#4a583c", kind: "olive" },
  { x: 88, y: 188, r: 6, s: 1.08, fill: "#667450", kind: "round" },
  { x: 124, y: 176, r: -18, s: 0.7, fill: "#3e4c34", kind: "slim" },
  { x: 158, y: 170, r: 28, s: 1.14, fill: "#546244", kind: "olive" },
  { x: 196, y: 158, r: 54, s: 0.76, fill: "#7a8860", kind: "round" },
  { x: 226, y: 142, r: 80, s: 0.58, fill: "#455338", kind: "slim" },
  { x: 70, y: 224, r: -32, s: 0.96, fill: "#5e6c4a", kind: "olive" },
  { x: 108, y: 232, r: 12, s: 0.64, fill: "#869468", kind: "slim" },
  { x: 146, y: 214, r: -8, s: 1.2, fill: "#445238", kind: "round" },
  { x: 184, y: 208, r: 34, s: 0.82, fill: "#6a7852", kind: "olive" },
  { x: 214, y: 196, r: 62, s: 0.9, fill: "#3f4d34", kind: "olive" },
  { x: 92, y: 268, r: -22, s: 0.86, fill: "#546244", kind: "round" },
  { x: 128, y: 262, r: 18, s: 1.02, fill: "#6e7c56", kind: "olive" },
  { x: 166, y: 252, r: -14, s: 0.68, fill: "#455338", kind: "slim" },
  { x: 198, y: 246, r: 44, s: 0.94, fill: "#7d8b62", kind: "round" },
  { x: 148, y: 300, r: 8, s: 0.72, fill: "#5a6846", kind: "olive" },
  { x: 182, y: 292, r: 36, s: 0.6, fill: "#445236", kind: "slim" },
  { x: 40, y: 118, r: -64, s: 0.84, fill: "#3a482e", kind: "olive" },
  { x: 58, y: 72, r: -28, s: 1.05, fill: "#61704c", kind: "round" },
  { x: 34, y: 164, r: -12, s: 0.7, fill: "#7d8b60", kind: "slim" },
  { x: 210, y: 36, r: 22, s: 0.88, fill: "#4c5a3c", kind: "olive" },
  { x: 236, y: 64, r: 48, s: 0.74, fill: "#6a784e", kind: "round" },
  { x: 248, y: 108, r: 70, s: 0.66, fill: "#536142", kind: "olive" },
  { x: 84, y: 48, r: -46, s: 0.62, fill: "#88966c", kind: "slim" },
  { x: 156, y: 36, r: 14, s: 0.8, fill: "#445236", kind: "round" },
];

function LeafShape({ kind }: { kind: Leaf["kind"] }) {
  if (kind === "round") {
    return <path d="M0 0C12-14 28-16 34-2 24 12 10 10 0 0Z" />;
  }
  if (kind === "slim") {
    return <path d="M0 0C8-26 18-32 24-6 14 8 6 6 0 0Z" />;
  }
  return <path d="M0 0C10-20 26-24 38-4 24 12 10 8 0 0Z" />;
}

function Foliage({ fill }: { fill?: string }) {
  return (
    <>
      <path
        d="M188 378C176 330 150 286 132 232 112 172 128 112 104 58"
        fill="none"
        stroke={fill ?? "#4e5c3e"}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path
        d="M150 250C112 210 96 168 62 142"
        fill="none"
        stroke={fill ?? "#62704c"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M176 340C206 292 198 236 226 176"
        fill="none"
        stroke={fill ?? "#6a7854"}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M168 300C132 274 118 236 86 214"
        fill="none"
        stroke={fill ?? "#546246"}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {leaves.map((leaf) => (
        <g
          key={`${leaf.x}-${leaf.y}-${leaf.kind}`}
          fill={fill ?? leaf.fill}
          transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r}) scale(${leaf.s})`}
        >
          <LeafShape kind={leaf.kind} />
          {fill ? null : (
            <path
              d="M3-1C14-3 24-3 32-2"
              fill="none"
              stroke="#eef6dc"
              strokeWidth="0.7"
              opacity="0.35"
            />
          )}
        </g>
      ))}
    </>
  );
}

export function HeroVisual() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative isolate h-[440px] overflow-hidden rounded-[2rem] bg-[#e3cfb6] shadow-[0_34px_80px_-46px_rgba(62,42,24,0.65)] sm:h-[520px] lg:h-[600px]"
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .hero-light { animation: hero-glow 16s ease-in-out infinite; }
          .hero-plant { animation: hero-sway 22s ease-in-out infinite alternate; }
          .hero-beam {
            transform-box: view-box;
            transform-origin: 50% 30%;
            animation: hero-balance 12s ease-in-out infinite alternate;
          }
        }
        @keyframes hero-glow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.88; }
        }
        @keyframes hero-sway {
          from { transform: rotate(-0.8deg); }
          to { transform: rotate(1.05deg); }
        }
        @keyframes hero-balance {
          from { transform: rotate(-2deg); }
          to { transform: rotate(-0.4deg); }
        }
      `}</style>

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 136"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="hero-niche" x1="0" y1="0" x2="1" y2="0.2">
            <stop offset="0%" stopColor="#c4aa90" />
            <stop offset="38%" stopColor="#e4d0b8" />
            <stop offset="72%" stopColor="#f7efe4" />
            <stop offset="100%" stopColor="#fff8ee" />
          </linearGradient>
          <linearGradient id="hero-jamb" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b89a78" />
            <stop offset="46%" stopColor="#f3e7d8" />
            <stop offset="100%" stopColor="#fffaf3" />
          </linearGradient>
          <radialGradient id="hero-sun" cx="78%" cy="18%" r="42%">
            <stop offset="0%" stopColor="#ffe7c2" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#f3d7ae" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e7d3b8" stopOpacity="0" />
          </radialGradient>
          <filter id="hero-plaster" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100" height="136" fill="#e7d4bc" />
        <rect width="100" height="136" fill="url(#hero-sun)" />
        <path d="M4 136V46A46 50 0 0 1 96 46v90Z" fill="#f4ebdf" />
        <path d="M18 136V58A32 36 0 0 1 82 58v78Z" fill="url(#hero-niche)" />
        <path
          d="M18 136V58A32 36 0 0 1 50 26v110Z"
          fill="#9a7b5c"
          opacity="0.34"
        />
        <path
          d="M18 136V58A32 36 0 0 1 82 58v78"
          fill="none"
          stroke="url(#hero-jamb)"
          strokeWidth="2.4"
        />
        <path
          d="M20.2 136V59.2A29.6 33.4 0 0 1 79.6 59.2"
          fill="none"
          stroke="#fffaf4"
          strokeWidth="0.45"
          opacity="0.8"
        />
        <ellipse cx="76" cy="40" rx="18" ry="24" fill="#ffe3b8" opacity="0.72" />
        <ellipse cx="84" cy="78" rx="10" ry="16" fill="#fff6e6" opacity="0.4" />
        <rect
          width="100"
          height="136"
          filter="url(#hero-plaster)"
          opacity="0.18"
        />
      </svg>

      <div className="hero-light absolute top-[-8%] right-[-8%] h-[74%] w-[52%] origin-top rotate-[18deg] bg-[linear-gradient(180deg,rgba(255,228,180,0.9),rgba(255,196,130,0.28)_38%,transparent_70%)] blur-2xl" />
      <div className="hero-light absolute top-[8%] right-[14%] h-[26%] w-[20%] rotate-[14deg] rounded-[45%] bg-[#fff1d4]/90 blur-md" />
      <div className="absolute top-[20%] right-[30%] h-[28%] w-[7%] -rotate-[8deg] bg-[linear-gradient(180deg,rgba(255,248,230,0.55),transparent)] blur-lg" />

      <svg
        viewBox="0 0 280 460"
        className="absolute right-[-6%] bottom-[17%] z-[6] h-[70%] w-[58%] opacity-25 blur-md"
      >
        <g transform="translate(-26 18)">
          <Foliage fill="#5c4634" />
        </g>
      </svg>

      <div className="absolute inset-x-0 bottom-0 z-10 h-[28%]">
        <div className="absolute inset-x-[-4%] top-[20%] h-[46%] bg-[linear-gradient(180deg,#f7f2ea,#e8d9c8)] shadow-[0_18px_28px_-20px_rgba(70,48,28,0.45)]" />
        <svg
          className="absolute inset-x-0 top-[20%] h-[48%] w-full opacity-50"
          viewBox="0 0 400 80"
          preserveAspectRatio="none"
        >
          <path
            d="M-10 24C90 10 130 42 230 18 310 4 360 16 420 28"
            fill="none"
            stroke="#d5c4b0"
            strokeWidth="0.8"
          />
          <path
            d="M20 52C120 40 200 66 320 46"
            fill="none"
            stroke="#fbf7f2"
            strokeWidth="1.2"
          />
        </svg>
        <div className="absolute inset-x-0 top-[20%] h-px bg-white/80" />
        <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,#e4d3c0,#cbb8a2)]" />
        <div className="absolute top-[38%] left-[14%] h-3 w-[42%] rounded-full bg-[#4a3424]/20 blur-md" />
        <div className="absolute top-[34%] right-[10%] h-3 w-[22%] rounded-full bg-[#4a3424]/15 blur-md" />
      </div>

      <div className="absolute bottom-[15%] left-[11%] z-30 w-[50%] -rotate-[1.5deg]">
        <div className="relative h-[96px]">
          <div className="absolute right-0 bottom-0 left-[2%] h-[34px] rounded-[2px] bg-[linear-gradient(180deg,#d9c3a6,#b89878)] shadow-[0_10px_14px_-12px_rgba(40,24,12,0.85)]">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-[#8d6b48]" />
            <div className="absolute inset-y-0 right-0 w-3.5 bg-[repeating-linear-gradient(180deg,#f6efe6_0_1px,#e7d5c0_1px_2px)]" />
          </div>
          <div className="absolute right-[2%] bottom-[26px] left-[8%] h-[30px] rounded-[2px] bg-[linear-gradient(180deg,#f1e6d8,#e3d0ba)] shadow-[0_8px_10px_-10px_rgba(40,24,12,0.7)]">
            <div className="absolute inset-x-0 top-0 h-px bg-white/70" />
            <div className="absolute inset-y-0 right-0 w-3 bg-[repeating-linear-gradient(180deg,#f8f3ea_0_1px,#e6d4be_1px_2px)]" />
          </div>
          <div className="absolute right-[8%] bottom-[48px] left-0 h-[32px] rounded-[2px] bg-[linear-gradient(180deg,#fbf7f2,#efe3d4)] shadow-[0_6px_10px_-8px_rgba(40,24,12,0.55)]">
            <p className="absolute inset-x-2 top-1/2 -translate-y-1/2 text-center font-serif text-[0.58rem] tracking-[0.18em] text-[#6d4c32]/70 uppercase sm:text-[0.68rem] sm:tracking-[0.22em]">
              A calmer you
            </p>
            <div className="absolute inset-y-1 right-0 w-2.5 bg-[repeating-linear-gradient(180deg,#f8f3ea_0_1px,#e5d4c0_1px_2px)]" />
          </div>
          <div className="absolute bottom-[72px] left-[28%] h-2 w-[28%] rounded-full bg-[#4a3424]/25 blur-[3px]" />
        </div>
        <svg
          viewBox="0 0 360 396"
          className="absolute bottom-[76px] -left-[8%] w-[122%]"
        >
        <defs>
          <linearGradient id="hero-brass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5a3e24" />
            <stop offset="46%" stopColor="#b48c48" />
            <stop offset="68%" stopColor="#f0e2c2" />
            <stop offset="84%" stopColor="#a07a3e" />
            <stop offset="100%" stopColor="#6d4e2c" />
          </linearGradient>
          <linearGradient id="hero-pan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3e6c8" />
            <stop offset="40%" stopColor="#c49a52" />
            <stop offset="100%" stopColor="#6e502c" />
          </linearGradient>
          <filter id="hero-scale-shadow" x="-20%" y="-8%" width="150%" height="140%">
            <feDropShadow
              dx="2"
              dy="7"
              stdDeviation="3"
              floodColor="#4a3422"
              floodOpacity="0.22"
            />
          </filter>
        </defs>
        <g filter="url(#hero-scale-shadow)">
          <path
            d="M132 372h96c4 0 6 2 6 5v6c0 3-3 5-7 5h-94c-4 0-7-2-7-5v-6c0-3 2-5 6-5z"
            fill="url(#hero-brass)"
          />
          <path
            d="M146 360h68c3 0 4 1 4 3v8H142v-8c0-2 1-3 4-3z"
            fill="url(#hero-brass)"
          />
          <rect x="172" y="122" width="16" height="240" rx="2" fill="url(#hero-brass)" />
          <rect x="180" y="122" width="3.5" height="240" fill="#f7edd4" opacity="0.85" />
          <ellipse cx="180" cy="122" rx="14" ry="5" fill="#f0e2c4" />
          <ellipse cx="180" cy="122" rx="6" ry="2.2" fill="#7a5830" opacity="0.4" />
          <g className="hero-beam">
            <rect x="24" y="112" width="312" height="10" rx="2" fill="url(#hero-brass)" />
            <rect x="24" y="112" width="312" height="2.2" fill="#f8edd6" opacity="0.8" />
            <circle cx="180" cy="106" r="6.5" fill="#f4e7c8" />
            <circle cx="180" cy="106" r="2.6" fill="#7a5830" />
            <g fill="none" stroke="#7a5a32" strokeWidth="2.4" strokeLinecap="round">
              <path d="M58 122v28" />
              <path d="M74 122v40" />
              <path d="M90 122v28" />
              <path d="M270 122v46" />
              <path d="M286 122v58" />
              <path d="M302 122v46" />
            </g>
            <g transform="translate(74 164)">
              <path d="M-42 2C-34 28 34 30 42 2Z" fill="url(#hero-pan)" />
              <ellipse cx="0" cy="2" rx="42" ry="7" fill="url(#hero-brass)" />
              <ellipse cx="0" cy="3" rx="30" ry="3.4" fill="#5c4124" opacity="0.28" />
              <path
                d="M-24 2c8 5 16 6 24 0"
                fill="none"
                stroke="#f8edd4"
                strokeWidth="1.2"
                opacity="0.8"
              />
            </g>
            <g transform="translate(286 184)">
              <path d="M-42 2C-34 30 34 32 42 2Z" fill="url(#hero-pan)" />
              <ellipse cx="0" cy="2" rx="42" ry="7" fill="url(#hero-brass)" />
              <ellipse cx="0" cy="3" rx="30" ry="3.4" fill="#5c4124" opacity="0.28" />
              <path
                d="M-24 2c8 5 16 6 24 0"
                fill="none"
                stroke="#f8edd4"
                strokeWidth="1.2"
                opacity="0.75"
              />
            </g>
          </g>
        </g>
        </svg>
      </div>

      <svg
        viewBox="0 0 280 460"
        className="hero-plant absolute right-[-1%] bottom-[14%] z-20 h-[78%] w-[66%] origin-[72%_90%]"
      >
        <defs>
          <linearGradient id="hero-clay" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8f1e8" />
            <stop offset="34%" stopColor="#e7d5c2" />
            <stop offset="100%" stopColor="#a68464" />
          </linearGradient>
        </defs>
        <ellipse cx="196" cy="424" rx="42" ry="7" fill="#5c4030" opacity="0.2" />
        <Foliage />
        <path
          d="M158 352c2 18 10 40 28 52 20 12 46 8 58-12 8-16 6-36-2-48-10-8-22-4-30 2-6-12-22-16-36-8-8 4-14 8-18 14z"
          fill="url(#hero-clay)"
        />
        <path
          d="M176 338c2-10 12-18 24-18s22 8 24 18c-6 6-14 8-24 8s-18-2-24-8z"
          fill="#f3e8da"
        />
        <ellipse cx="200" cy="334" rx="26" ry="6" fill="#e7d5c2" />
        <ellipse cx="200" cy="333" rx="16" ry="2.6" fill="#6a5340" opacity="0.35" />
        <path
          d="M172 366c8 14 16 28 20 42"
          fill="none"
          stroke="#fff8f0"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>

      <div className="absolute inset-0 z-50 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(74,52,32,0.22)_100%)]" />
    </div>
  );
}
