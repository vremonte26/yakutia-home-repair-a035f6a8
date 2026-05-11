export const CATEGORIES = [
  { value: 'construction', label: 'Строительство и ремонт', icon: '🏗️' },
  { value: 'electrical', label: 'Электрика', icon: '⚡' },
  { value: 'plumbing', label: 'Сантехника', icon: '🔧' },
  { value: 'furniture', label: 'Мебель', icon: '🪑' },
  { value: 'care', label: 'Забота', icon: '💚' },
  { value: 'other', label: 'Другое', icon: '🛠️' },
] as const;


export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};
