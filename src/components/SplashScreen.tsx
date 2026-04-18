import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number;
}

export function SplashScreen({ onFinish, duration = 5000 }: SplashScreenProps) {
  const [leaving, setLeaving] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Trigger fade-in on next frame
    const enterTimer = setTimeout(() => setEntered(true), 50);
    const fadeTimer = setTimeout(() => setLeaving(true), duration);
    const finishTimer = setTimeout(() => onFinish(), duration + 600);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background: '#F1F1F1',
        fontFamily: 'Manrope, Inter, system-ui, sans-serif',
      }}
    >
      {/* Dotted "blueprint" pattern — schematic room with window & door */}
      <svg
        viewBox="0 0 400 500"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full transition-opacity ease-out"
        style={{
          opacity: entered ? 0.85 : 0,
          transitionDuration: '2000ms',
        }}
        aria-hidden="true"
      >
        <defs>
          {/* Base dot grid (very subtle) */}
          <pattern id="dotgrid" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill="#FFE9A8" />
          </pattern>
          {/* Denser dots for "walls" / drawing lines */}
          <pattern id="dotline" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.6" fill="#FFD86B" />
          </pattern>
        </defs>

        {/* Background dotted grid */}
        <rect width="400" height="500" fill="url(#dotgrid)" opacity="0.55" />

        {/* Schematic room: floor + two walls forming a corner */}
        {/* Floor line */}
        <rect x="40" y="380" width="320" height="6" fill="url(#dotline)" />
        {/* Left wall */}
        <rect x="40" y="120" width="6" height="266" fill="url(#dotline)" />
        {/* Right wall */}
        <rect x="354" y="120" width="6" height="266" fill="url(#dotline)" />
        {/* Ceiling line */}
        <rect x="40" y="120" width="320" height="6" fill="url(#dotline)" />

        {/* Window on left wall */}
        <rect x="80" y="180" width="90" height="70" fill="none" stroke="url(#dotline)" strokeWidth="4" strokeDasharray="3 4" />
        <line x1="125" y1="180" x2="125" y2="250" stroke="#FFD86B" strokeWidth="3" strokeDasharray="2 4" />
        <line x1="80" y1="215" x2="170" y2="215" stroke="#FFD86B" strokeWidth="3" strokeDasharray="2 4" />

        {/* Door on right wall */}
        <rect x="240" y="240" width="80" height="140" fill="none" stroke="url(#dotline)" strokeWidth="4" strokeDasharray="3 4" />
        <circle cx="305" cy="312" r="3" fill="#FFD86B" />

        {/* Corner indicator */}
        <line x1="200" y1="120" x2="200" y2="386" stroke="#FFE9A8" strokeWidth="2" strokeDasharray="2 6" opacity="0.7" />
      </svg>

      {/* Foreground content */}
      <div
        className="relative z-10 flex flex-col items-center px-6 text-center transition-all ease-out"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateY(0)' : 'translateY(12px)',
          transitionDuration: '2000ms',
        }}
      >
        <h1
          className="text-6xl sm:text-7xl font-extrabold tracking-tight"
          style={{ color: '#FFB300', textShadow: '0 2px 20px rgba(255,179,0,0.25)' }}
        >
          Времонте
        </h1>
        <p
          className="mt-4 text-base sm:text-lg font-medium"
          style={{ color: '#3A3A3A' }}
        >
          Найди мастера или стань им
        </p>
        <div className="mt-10 h-1 w-32 overflow-hidden rounded-full" style={{ background: 'rgba(58,58,58,0.15)' }}>
          <div
            className="h-full"
            style={{
              background: '#FFB300',
              animation: `splash-progress ${duration}ms ease-out forwards`,
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
