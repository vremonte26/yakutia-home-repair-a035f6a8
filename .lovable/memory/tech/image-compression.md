---
name: Image Compression
description: All image uploads (chat, avatars, task photos) compressed via compressorjs before upload
type: feature
---
Library: compressorjs. Util: `src/lib/imageCompression.ts` exports `compressImage(file, opts)` and `compressImageSafe(file, opts, onError)`.
Defaults: quality 0.7, maxWidth 1280, mimeType 'image/jpeg'. Skips gif/svg.
Integrated in: ChatRoom (chat-images), CreateTask (task-photos), ProfilePage (avatars), MasterSetup (avatars).
On compression failure → uploads original + toast "Не удалось сжать фото — загружаем оригинал". Uploading state shown via existing spinners/disabled buttons.
