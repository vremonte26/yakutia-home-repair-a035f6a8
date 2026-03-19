import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReviewFormProps {
  fromUserId: string;
  toUserId: string;
  taskId: string;
  toUserName: string;
  onReviewSubmitted: () => void;
}

export function ReviewForm({ fromUserId, toUserId, taskId, toUserName, onReviewSubmitted }: ReviewFormProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: 'Выберите оценку', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      from_user: fromUserId,
      to_user: toUserId,
      task_id: taskId,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Вы уже оставили отзыв', variant: 'destructive' });
      } else {
        toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      }
      return;
    }
    toast({ title: 'Отзыв отправлен!' });
    onReviewSubmitted();
  };

  const displayRating = hoveredRating || rating;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Оставить отзыв — {toUserName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  star <= displayRating
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30'
                }`}
              />
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
        />
        <Button size="sm" onClick={handleSubmit} disabled={submitting || rating === 0}>
          {submitting ? 'Отправка...' : 'Отправить отзыв'}
        </Button>
      </CardContent>
    </Card>
  );
}
