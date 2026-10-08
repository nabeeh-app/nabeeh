-- Stage 4: private receipts bucket with tenant-path policies.
-- No storage buckets exist in prod and no code path uploads or serves
-- receipts today (payments.receipt_url is written/read nowhere). This
-- migration creates the enforceable foundation only: bucket plus
-- policies. Signed-URL serving gets added with the first upload route
-- in stage 5 instead of shipping dead code now.
-- Layout contract for that route: object path {tenant_id}/{filename}.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payments', 'payments', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS tenant_receipts_select ON storage.objects;
DROP POLICY IF EXISTS tenant_receipts_insert ON storage.objects;
DROP POLICY IF EXISTS tenant_receipts_update ON storage.objects;
DROP POLICY IF EXISTS tenant_receipts_delete ON storage.objects;

CREATE POLICY tenant_receipts_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payments' AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::TEXT);
CREATE POLICY tenant_receipts_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payments' AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::TEXT);
CREATE POLICY tenant_receipts_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payments' AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::TEXT)
  WITH CHECK (bucket_id = 'payments' AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::TEXT);
CREATE POLICY tenant_receipts_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payments' AND (storage.foldername(name))[1] = (SELECT public.current_tenant_id())::TEXT);

COMMIT;
