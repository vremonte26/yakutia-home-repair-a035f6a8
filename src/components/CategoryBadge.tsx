import { CATEGORIES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

const LEGACY_MAP: Record<string, string> = {
  tiling: 'finishing',
  painting: 'finishing',
};

interface CategoryBadgeProps {
  value: string;
  size?: 'sm' | 'default';
}

export function CategoryBadge({ value, size = 'default' }: CategoryBadgeProps) {
  const resolved = LEGACY_MAP[value] ?? value;
  const cat = CATEGORIES.find(c => c.value === resolved);
  if (!cat) return <Badge variant="outline">{value}</Badge>;

  return (
    <Badge variant="secondary" className={`bg-amber-100 text-gray-500 border-amber-200 ${size === 'sm' ? 'text-xs px-2 py-0.5' : ''}`}>
      <span className="mr-1">{cat.icon}</span>
      {cat.label}
    </Badge>
  );
}

/** Deduplicate categories by resolved label (handles legacy tiling/painting → finishing) */
export function deduplicateCategories(categories: string[]): string[] {
  const seen = new Set<string>();
  return categories.filter(val => {
    const resolved = LEGACY_MAP[val] ?? val;
    if (seen.has(resolved)) return false;
    seen.add(resolved);
    return true;
  });
}
