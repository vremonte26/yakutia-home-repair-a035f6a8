import { useSwipeDismiss } from '@/hooks/useSwipeDismiss';
import { useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FullscreenImageProps {
  src: string;
  onClose: () => void;
}

export default function FullscreenImage({ src, onClose }: FullscreenImageProps) {
  const [scale, setScale] = useState(1);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);

  const { handlers: swipeHandlers, style: swipeStyle } = useSwipeDismiss({
    direction: 'both',
    threshold: 80,
    onDismiss: onClose,
  });

  const getDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      initialDistance.current = getDistance(e.touches);
      initialScale.current = scale;
    } else {
      swipeHandlers.onTouchStart(e);
    }
  }, [scale, swipeHandlers]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches);
      if (initialDistance.current > 0) {
        const newScale = Math.min(5, Math.max(0.5, initialScale.current * (dist / initialDistance.current)));
        setScale(newScale);
      }
    } else if (scale <= 1) {
      swipeHandlers.onTouchMove(e);
    }
  }, [scale, swipeHandlers]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (initialDistance.current > 0 && e.touches.length < 2) {
      initialDistance.current = 0;
      if (scale < 1) setScale(1);
    } else if (scale <= 1) {
      swipeHandlers.onTouchEnd();
    }
  }, [scale, swipeHandlers]);

  const handleDoubleClick = () => {
    setScale(s => s > 1 ? 1 : 2.5);
  };

  const mergedStyle = {
    ...swipeStyle,
    transform: [
      swipeStyle.transform,
      `scale(${scale})`,
    ].filter(Boolean).join(' '),
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 text-white hover:bg-white/20 z-10"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>
      <img
        src={src}
        alt="Фото"
        className="max-w-full max-h-[90vh] object-contain select-none"
        draggable={false}
        style={mergedStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={handleDoubleClick}
      />
      <p className="absolute bottom-6 text-white/50 text-xs">Свайп вверх/вниз для закрытия · двойной тап для зума</p>
    </div>
  );
}
