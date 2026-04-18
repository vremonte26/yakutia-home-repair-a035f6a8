import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number;
}

export function SplashScreen({ onFinish, duration = 7000 }: SplashScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const [phase, setPhase] = useState(0); // 0: initial, 1: drawing (0-3s), 2: title, 3: subtitle

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 50);      // start drawing pattern
    const t2 = setTimeout(() => setPhase(2), 800);     // title fade-in
    const t3 = setTimeout(() => setPhase(3), 2200);    // subtitle fade-in (~3s mark)
    const fadeTimer = setTimeout(() => setLeaving(true), duration);
    const finishTimer = setTimeout(() => onFinish(), duration + 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  const title = 'Времонте';

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: '#F8F9FA',
        fontFamily: 'Manrope, Inter, system-ui, sans-serif',
      }}
    >
      {/* Dotted "blueprint" pattern — schematic room with window & door */}
      <svg
        viewBox="0 0 400 500"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        style={{
          opacity: phase >= 1 ? 0.95 : 0,
          transition: 'opacity 2400ms ease-out',
        }}
        aria-hidden="true"
      >
        <defs>
          {/* Sparse warm dot grid (background) */}
          <pattern id="dotgrid-bg" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#E8E2D4" />
          </pattern>
          {/* Medium grey dots */}
          <pattern id="dotgrid-grey" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="#C7C7C7" />
          </pattern>
          {/* Dense yellow dots for "walls" / drawing lines */}
          <pattern id="dotline-yellow" x="0" y="0" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="1.8" cy="1.8" r="1.6" fill="#FFC83D" />
          </pattern>
          {/* Warm orange-yellow accent dots */}
          <pattern id="dotline-warm" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="#FFB300" />
          </pattern>
        </defs>

        {/* Background warm dotted grid */}
        <rect width="400" height="500" fill="url(#dotgrid-bg)" opacity="0.7" />

        {/* Subtle grey dot region — floor shading */}
        <rect x="40" y="320" width="320" height="60" fill="url(#dotgrid-grey)" opacity="0.45" />

        {/* Schematic room: floor + walls forming a corner */}
        <rect x="40" y="380" width="320" height="6" fill="url(#dotline-yellow)" />
        <rect x="40" y="120" width="6" height="266" fill="url(#dotline-yellow)" />
        <rect x="354" y="120" width="6" height="266" fill="url(#dotline-yellow)" />
        <rect x="40" y="120" width="320" height="6" fill="url(#dotline-warm)" opacity="0.85" />

        {/* Window on left side */}
        <rect x="80" y="180" width="90" height="70" fill="none" stroke="url(#dotline-yellow)" strokeWidth="4" strokeDasharray="3 4" />
        <line x1="125" y1="180" x2="125" y2="250" stroke="#FFC83D" strokeWidth="3" strokeDasharray="2 4" />
        <line x1="80" y1="215" x2="170" y2="215" stroke="#FFC83D" strokeWidth="3" strokeDasharray="2 4" />

        {/* Door on right side */}
        <rect x="240" y="240" width="80" height="140" fill="none" stroke="url(#dotline-warm)" strokeWidth="4" strokeDasharray="3 4" />
        <circle cx="305" cy="312" r="3" fill="#FFB300" />

        {/* Corner indicator */}
        <line x1="200" y1="120" x2="200" y2="386" stroke="#D9D2C0" strokeWidth="2" strokeDasharray="2 6" opacity="0.7" />
      </svg>

      {/* Foreground content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <h1
          className="text-6xl sm:text-7xl font-extrabold tracking-tight"
          style={{
            color: '#FFB300',
            textShadow: '0 2px 24px rgba(255,179,0,0.25)',
            display: 'flex',
            gap: '0.02em',
          }}
        >
          {title.split('').map((ch, i) => (
            <span
              key={i}
              style={{
                opacity: phase >= 2 ? 1 : 0,
                transform: phase >= 2 ? 'translateY(0)' : 'translateY(8px)',
                transition: `opacity 420ms ease-out ${i * 90}ms, transform 420ms ease-out ${i * 90}ms`,
                display: 'inline-block',
              }}
            >
              {ch}
            </span>
          ))}
        </h1>
        <p
          className="mt-4 text-base sm:text-lg font-medium"
          style={{
            color: '#3A3A3A',
            opacity: phase >= 3 ? 1 : 0,
            transform: phase >= 3 ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 700ms ease-out, transform 700ms ease-out',
          }}
        >
          Найди мастера или стань им
        </p>
        <div
          className="mt-10 h-1 w-32 overflow-hidden rounded-full"
          style={{ background: 'rgba(58,58,58,0.15)' }}
        >
          <div
            className="h-full"
            style={{
              background: '#FFB300',
              animation: `splash-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes splash-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
