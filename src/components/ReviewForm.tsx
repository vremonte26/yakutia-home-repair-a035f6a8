import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface ReviewFormProps {
  fromUserId: string;
  toUserId: string;
  taskId: string;
  toUserName: string;
  open: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

export function ReviewForm({ fromUserId, toUserId, taskId, toUserName, open, onClose, onReviewSubmitted }: ReviewFormProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasContent = rating > 0 || comment.trim().length > 0;

  const handleSubmit = async () => {
    if (!hasContent) return;
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      from_user: fromUserId,
      to_user: toUserId,
      task_id: taskId,
      rating: rating || 0,
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
    setRating(0);
    setComment('');
    onReviewSubmitted();
    onClose();
  };

  const handleSkip = () => {
    setRating(0);
    setComment('');
    onClose();
  };

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Как прошла работа?</DialogTitle>
          <DialogDescription>
            Оцените {toUserName} (по желанию)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-1 justify-center">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(prev => prev === star ? 0 : star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
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
        </div>
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Пропустить
          </Button>
          {hasContent && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Отправка...' : 'Опубликовать'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
