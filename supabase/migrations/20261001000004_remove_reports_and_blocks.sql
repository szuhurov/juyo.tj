-- Owner decision (2026-10-03): no in-app report or block feature.
-- Removes everything 20261001000001_reports_and_blocks.sql created.

drop trigger if exists content_reports_auto_hide on public.content_reports;
drop trigger if exists content_reports_fill_user on public.content_reports;
drop function if exists public.content_reports_auto_hide();
drop function if exists public.content_reports_fill_user();
drop table if exists public.content_reports;
drop table if exists public.user_blocks;
