import { useState } from 'react';
import { User } from 'lucide-react';
import FullscreenImage from './FullscreenImage';

interface ClickableAvatarProps {
  src: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
};

const iconSizes = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

const radiusClasses = {
  sm: 'rounded-full',
  md: 'rounded-full',
  lg: 'rounded-2xl',
};

export default function ClickableAvatar({ src, name, size = 'md', className = '' }: ClickableAvatarProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);

  const sizeClass = sizeClasses[size];
  const radius = radiusClasses[size];

  return (
    <>
      <div
        className={`${sizeClass} ${radius} bg-accent flex items-center justify-center shrink-0 overflow-hidden ${src ? 'cursor-pointer' : ''} ${className}`}
        onClick={(e) => {
          if (src) {
            e.stopPropagation();
            setShowFullscreen(true);
          }
        }}
      >
        {src ? (
          <img src={src} alt={name || ''} className={`${sizeClass} ${radius} object-cover`} />
        ) : (
          <User className={`${iconSizes[size]} text-muted-foreground`} />
        )}
      </div>
      {showFullscreen && src && (
        <FullscreenImage src={src} onClose={() => setShowFullscreen(false)} />
      )}
    </>
  );
}
