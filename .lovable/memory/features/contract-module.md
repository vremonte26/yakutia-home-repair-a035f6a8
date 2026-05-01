---
name: Contract Module v3
description: Договор с версионированием, diff между слепками, подтверждением обеих сторон и автосообщениями в чат
type: feature
---

Таблицы: contracts (1 на task_id), contract_versions (слепки), master_private_data (только мастер видит).
Статусы: draft → pending_approval → approved → signed (заглушка) → cancelled.
Поток: «Заключить договор» появляется после accepted-отклика. Любая сторона редактирует общие поля и отправляет на согласование — создаётся новая версия, инициатор автоподтверждает. Вторая сторона видит подсветку изменений (сравнение последней vs предыдущей версии), может Подтвердить или Отклонить с причиной (отправляется в чат). Когда обе стороны подтвердили — status=approved, поля блокируются.
Trigger notify_contract_field_change: при изменении subject/price/deadline/address пишет системное сообщение в messages.
Подпись СМС — заглушка, реализуем позже.
Файлы: src/pages/ContractPage.tsx, маршрут /contract/:taskId, кнопка в src/pages/TaskDetail.tsx.
