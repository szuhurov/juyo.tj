-- ============================================================================
-- Activity/audit history was removed from the product entirely (admin Archive
-- page, per-user "Таърихи амалиёт" tab, and every AuditService/logAudit call
-- site) — not needed for this project. Drop the now-unused table.
-- ============================================================================

drop table if exists public.audit_log;
