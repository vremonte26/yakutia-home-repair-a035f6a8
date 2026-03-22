import { useSwipeDismiss } from '@/hooks/useSwipeDismiss';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FullscreenImageProps {
  src: string;
  onClose: () => void;
}

export default function FullscreenImage({ src, onClose }: FullscreenImageProps) {
  const { handlers, style } = useSwipeDismiss({
    direction: 'both',
    threshold: 80,
    onDismiss: onClose,
  });

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
        style={style}
        {...handlers}
      />
      <p className="absolute bottom-6 text-white/50 text-xs">Свайп вверх или вниз для закрытия</p>
    </div>
  );
}
