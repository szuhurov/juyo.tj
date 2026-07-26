-- ============================================================================
-- Нест кардани пурраи системаи "саволҳои санҷиши моликият" (verification
-- questions) — ба хости корбар, ин feature комилан аз бэкенд бардошта
-- мешавад. Frontend (VerificationGate, Step 6-и add-page, admin claims
-- UI ва ғ.) аллакай дар як commit-и алоҳида нест карда шуд.
--
-- ЭЗОҲ: dismissed_notifications/dismiss_notification (аз migration-и
-- 20260721000000) дар база вуҷуд надоштанд — ҳеҷ гоҳ apply нашуда буданд,
-- пас ин migration ба онҳо кор надорад. review_verification_attempt низ
-- (бояд бо 20260722000000 нест мешуд, лек он ҳам apply нашуда буд) дар
-- ҳамин ҷо нест карда мешавад, зеро ба ҳамин feature тааллуқ дорад.
-- ============================================================================

-- Аввал ҷадвалҳо (бо CASCADE) — trigger-и tr_verification_attempt_notify
-- ба notify_verification_attempt() вобаста аст, пас функсияро наметавон
-- пеш аз нест кардани trigger (яъне пеш аз ҷадвал) нест кард.
drop table if exists public.item_verification_attempts cascade;
drop table if exists public.item_verification_questions cascade;

drop function if exists public.get_verification_questions(uuid);
drop function if exists public.submit_verification_attempt(uuid, text, jsonb);
drop function if exists public.submit_verification_attempt(uuid, text, jsonb, text);
drop function if exists public.get_verification_status(uuid, text);
drop function if exists public.get_pending_verification_attempts(uuid);
drop function if exists public.get_my_verification_attempts(int);
drop function if exists public.review_verification_attempt(uuid, boolean);
drop function if exists public.notify_verification_attempt();
