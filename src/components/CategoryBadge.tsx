import { CATEGORIES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

interface CategoryBadgeProps {
  value: string;
  size?: 'sm' | 'default';
}

export function CategoryBadge({ value, size = 'default' }: CategoryBadgeProps) {
  const cat = CATEGORIES.find(c => c.value === value);
  if (!cat) return <Badge variant="outline">{value}</Badge>;

  return (
    <Badge variant="secondary" className={`text-muted-foreground ${size === 'sm' ? 'text-xs px-2 py-0.5' : ''}`}>
      <span className="mr-1">{cat.icon}</span>
      {cat.label}
    </Badge>
  );
}
