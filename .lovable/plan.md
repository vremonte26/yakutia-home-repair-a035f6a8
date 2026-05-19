## Разделение профилей клиента и мастера в одном аккаунте

Большая архитектурная задача: затрагивает схему БД, RLS, регистрацию, переключение ролей, отображение во всём интерфейсе и историю сделок. Ниже — план изменений.

### 1. Миграция БД

В таблицу `profiles` добавить:
- `client_data jsonb` — `{ name, photo, phone }`
- `master_data jsonb` — `{ name, photo, phone, categories, about, work_area, is_verified, rejection_reason }`
- `current_role app_role` — текущая активная роль (дублирует `role` для прозрачности переключения)
- `master_pending_changes jsonb` — заявка мастера на изменение данных (на модерацию)

Бэкфилл существующих пользователей:
- Для всех: `client_data = { name, photo, phone }`, `current_role = role`
- Для мастеров: `master_data = { name, photo, phone, categories, about, work_area, is_verified, rejection_reason }`
- Для клиентов: `master_data = '{}'::jsonb` (пусто — нужно будет заполнить при переключении)

Старые поля (`name`, `photo`, `categories`, `about`, `work_area`, `is_verified`, `rejection_reason`) **оставляем** как есть, чтобы не ломать существующий код. Они станут "зеркалом" активной роли — синхронизируем через триггер `BEFORE UPDATE`: при изменении `current_role` или соответствующего `*_data` плоские поля переписываются из активного jsonb.

Это критично: огромная часть кода (`profiles.name`, `profiles.photo`, `profiles.categories`, фид мастера, чаты, триггеры уведомлений) читает плоские поля. Триггер делает переключение прозрачным.

### 2. RLS

Заменить общую политику `Users can update own profile` на узкую SECURITY DEFINER функцию `update_role_data(_role, _data)`, которую вызывает фронт. Сама `UPDATE` на `profiles` от пользователя разрешит только: `current_role`, `is_active`, `notification_prefs`, `lat/lng`, `blocked_until` — но не `*_data` напрямую.

- `client_data` редактируется только если `current_role = 'client'`.
- `master_data` напрямую не редактируется — изменения идут в `master_pending_changes`, модератор подтверждает через админку (применяет в `master_data` и сбрасывает `is_verified` при необходимости).
- При первичном создании мастер-профиля (пустой `master_data`) — разрешаем заполнить сразу, но `is_verified = null` (на модерацию).

### 3. Регистрация и выбор роли

`RoleSelection.tsx`:
- Клиент: записывает `client_data = { name, phone, photo: null }`, `current_role = 'client'`, `role = 'client'`.
- Мастер: ведёт на `MasterSetup`, который пишет в `master_data` и ставит на модерацию (`is_verified = null`).

### 4. Переключение роли (`AppLayout.toggleRole`)

Логика:
1. Если у пользователя есть данные в обеих ролях → просто меняем `current_role` (триггер обновит плоские поля).
2. Если выбранной роли нет (пустой jsonb) →
   - На клиента: показать модалку "Введите имя" (как в `RoleSelection`), создать `client_data`, переключить.
   - На мастера: редирект на `MasterSetup` для заполнения и модерации.

Новый компонент `RoleSwitchDialog.tsx` для случая 2 (клиент). Для мастера используем существующий `MasterSetup`, добавив режим "создание из переключения".

### 5. Отображение

- **Шапка/профиль (`AppLayout`, `ProfilePage`)**: продолжают читать `profile.name`, `profile.photo`, `profile.phone` — триггер БД гарантирует, что это данные активной роли.
- **Исторический слепок в чатах/заказах/отзывах**: при создании `tasks`, `responses`, `reviews`, `messages` сохраняем snapshot имени/фото автора на момент действия. Добавим колонки:
  - `tasks.client_name_snapshot`, `tasks.client_photo_snapshot`
  - `responses.master_name_snapshot`, `responses.master_photo_snapshot`
  - `reviews.from_name_snapshot`, `reviews.from_photo_snapshot`
  - `messages.from_name_snapshot`, `messages.from_photo_snapshot`
  
  Заполнение — через `BEFORE INSERT` триггер, читающий активный `*_data` автора. Существующие записи бэкфилим текущим `name/photo` автора.
  
  Фронт (карточки задач, чат, отзывы, профиль клиента/мастера) — где сейчас читается `profiles.name/photo` через join, переключаем на snapshot, а fallback — текущий профиль.

### 6. Модерация изменений мастера

В `AdminPanel` / `Moderation`: новая вкладка "Запросы мастеров" — список профилей где `master_pending_changes IS NOT NULL`. Кнопки "Принять" (merge в `master_data`, при изменении категорий/описания — `is_verified = null` для повторной проверки фото — оставим как есть) / "Отклонить".

Мастер редактирует свой профиль через новый UI (`ProfilePage` для роли master) → запись идёт в `master_pending_changes`, в UI бейдж "На модерации".

### 7. Затрагиваемые файлы

**Миграции:**
- Новая миграция: колонки + бэкфилл + триггеры синхронизации + триггеры snapshot + RLS + функция `update_role_data`.

**Фронт (правки):**
- `src/hooks/useAuth.tsx` — добавить поля `client_data`, `master_data`, `current_role`, `master_pending_changes` в `Profile`.
- `src/components/AppLayout.tsx` — `toggleRole` с проверкой существования профиля + диалог.
- `src/pages/RoleSelection.tsx` — писать в `client_data` через RPC.
- `src/pages/MasterSetup.tsx` — писать в `master_data` через RPC, поддержать режим "добавление мастер-роли поверх существующего клиента".
- `src/pages/ProfilePage.tsx` — редактирование данных активной роли; для мастера — через `master_pending_changes` с бейджем "на модерации".
- `src/pages/AdminPanel.tsx` / `src/pages/Moderation.tsx` — раздел "Запросы на изменение профиля мастера".
- `src/components/TaskCard.tsx`, `ChatRoom.tsx`, `ReviewThread.tsx`, `MasterProfile.tsx`, `ClientProfile.tsx` — использовать snapshot-поля где это исторический контекст.

**Новые файлы:**
- `src/components/RoleSwitchDialog.tsx` — модалка ввода имени при первом переключении на клиента.

### 8. Совместимость

Старая логика продолжает работать: плоские поля `profiles.name/photo/categories/...` синхронизируются триггером и остаются источником правды для всех существующих читателей (фид, уведомления, поиск мастеров по категориям). Новые snapshot-поля — опциональны, fallback на текущий профиль.

---

Подтверди план — приступаю к миграции и коду.
