-- Stage 5 companion: EXECUTE grants for read RPCs via scoped clients.
-- 026 revoked PUBLIC EXECUTE on all functions. Scoped (authenticated)
-- clients call these four read RPCs with an explicit owner teacher_id,
-- preserving the manual-predicate trust model. service_role keeps its
-- grants from 026. Trigger-internal functions need no grants.
BEGIN;
GRANT EXECUTE ON FUNCTION public.teacher_student_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.message_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_summary(UUID, DATE, DATE) TO authenticated;
COMMIT;
