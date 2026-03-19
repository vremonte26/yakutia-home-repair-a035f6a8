import { Star } from 'lucide-react';

interface UserRatingProps {
  rating: number | null;
  reviewCount?: number;
  size?: 'sm' | 'md';
}

export function UserRating({ rating, reviewCount, size = 'sm' }: UserRatingProps) {
  const r = rating ?? 0;
  if (r === 0 && (!reviewCount || reviewCount === 0)) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span className={`inline-flex items-center gap-1 ${textSize}`}>
      <Star className={`${iconSize} fill-amber-400 text-amber-400`} />
      <span className="font-semibold">{r.toFixed(1)}</span>
      {reviewCount !== undefined && (
        <span className="text-muted-foreground">({reviewCount})</span>
      )}
    </span>
  );
}
