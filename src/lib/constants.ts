export const CATEGORIES = [
  { value: 'plumbing', label: 'Сантехника', icon: '🔧' },
  { value: 'electrical', label: 'Электрика', icon: '⚡' },
  { value: 'furniture', label: 'Сборка мебели', icon: '🪑' },
  { value: 'minor_repair', label: 'Мелкий ремонт', icon: '🔨' },
  { value: 'finishing', label: 'Отделка', icon: '🎨' },
  { value: 'other', label: 'Другое', icon: '🛠️' },
] as const;


export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};
