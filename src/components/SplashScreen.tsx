import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number;
}

export function SplashScreen({ onFinish, duration = 3000 }: SplashScreenProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setLeaving(true), duration);
    const finishTimer = setTimeout(() => onFinish(), duration + 500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-secondary transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ fontFamily: 'Manrope, Inter, system-ui, sans-serif' }}
    >
      <div className="animate-scale-in flex flex-col items-center px-6 text-center">
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-primary">
          Времонте
        </h1>
        <p className="mt-4 text-base sm:text-lg font-medium text-secondary-foreground/90">
          Найди мастера или стань им
        </p>
        <div className="mt-10 h-1 w-24 overflow-hidden rounded-full bg-secondary-foreground/20">
          <div className="h-full bg-primary animate-[splash-progress_3s_ease-out_forwards]" />
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
