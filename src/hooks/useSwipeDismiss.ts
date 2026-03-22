import { useRef, useCallback, useState } from 'react';

interface SwipeDismissOptions {
  direction: 'up' | 'down' | 'both';
  threshold?: number;
  onDismiss: () => void;
}

export function useSwipeDismiss({ direction, threshold = 80, onDismiss }: SwipeDismissOptions) {
  const startY = useRef(0);
  const currentY = useRef(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;

    let allowed = false;
    if (direction === 'up' && delta < 0) allowed = true;
    if (direction === 'down' && delta > 0) allowed = true;
    if (direction === 'both') allowed = true;

    if (allowed) {
      setOffsetY(delta);
    }
  }, [isDragging, direction]);

  const onTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (Math.abs(offsetY) > threshold) {
      const isUp = offsetY < 0;
      const isDown = offsetY > 0;
      if (
        (direction === 'up' && isUp) ||
        (direction === 'down' && isDown) ||
        direction === 'both'
      ) {
        onDismiss();
      }
    }
    setOffsetY(0);
  }, [offsetY, threshold, direction, onDismiss]);

  return {
    offsetY,
    isDragging,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    style: {
      transform: offsetY !== 0 ? `translateY(${offsetY}px)` : undefined,
      transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      opacity: offsetY !== 0 ? Math.max(0.2, 1 - Math.abs(offsetY) / 300) : 1,
    },
  };
}
