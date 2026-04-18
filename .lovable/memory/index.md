# Memory: index.md
Updated: now

# Project Memory

## Core
- **Tech Stack**: Supabase (JWT Edge Functions, RLS), Vercel (SPA). 2GIS for maps, Yandex for geocoding.
- **Identity**: Phone is primary ID. Name is single source of truth across roles.
- **Data Retention**: Account deletion anonymizes profiles (keeps history intact).
- **Privacy**: Client exact address and chat access are locked until a master is chosen.
- **Geolocation**: App relies strictly on browser geo (50km from Yakutsk). No manual regions.
- **UI/UX**: Swipe gestures for modals/toasts. Critical actions always require confirmation.

## Memories
- [User Name Sync](mem://identity/user-name-sync) — Name synchronization across roles and profile editing constraints
- [Account Deletion](mem://auth/account-deletion-anonymization) — Profile anonymization logic keeping order history intact
- [Master Verification](mem://features/master-verification-lock) — Profile fields locked after verification is granted
- [Task Response Limit](mem://features/task-response-limit) — Max 5 masters per task, response and withdrawal logic
- [Address Privacy](mem://features/address-privacy-logic) — Location obfuscation before master is selected
- [Chat Access Rules](mem://features/chat-access-rules) — Chat unlocked only for in-progress or completed orders
- [Chat Media Security](mem://tech/chat-media-security) — Private bucket and 1-hour signed URLs for chat images
- [Notification System](mem://features/notification-system-config) — Real-time DB triggers and OneSignal push setup
- [Mobile Gestures UI](mem://style/mobile-gestures-ui) — Swipe interactions for toasts, modals, and image viewing
- [Action Confirmation](mem://ui/critical-action-confirmation) — Mandatory confirmation dialogs for destructive actions
- [Mutual Rating System](mem://features/mutual-rating-system) — Two-way post-task rating and UI display rules
- [Work Categories](mem://constraints/work-categories-style) — Available categories, unification of tiling/painting, and UI styling
- [Moderation Bypass](mem://dev/moderation-bypass-mode) — Testing variable for auto-verification
- [Self-Response Protection](mem://features/self-response-protection) — Masters prevented from accepting their own tasks
- [Master Feed Filtering](mem://features/master-feed-filtering) — Strict 50km geolocation filtering for the master feed
- [Deployment Config](mem://dev/deployment-vercel-config) — Vercel SPA routing and mandatory API keys
- [Supabase Environment](mem://tech/supabase-environment) — Project ID, JWT rules, and test authentication codes
- [Yandex Geocoding](mem://tech/yandex-geocoding-logic) — Exact house matching within Yakutsk radius
- [2GIS Map Integration](mem://tech/map-provider-2gis) — MapGL implementation, geo-permission caching, and marker offsets
- [Header Geo Label](mem://features/header-geo-label) — Header shows current Yakutsk/ulus from reverse geocoding, cached
