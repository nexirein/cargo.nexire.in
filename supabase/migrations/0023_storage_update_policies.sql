-- Storage buckets are missing UPDATE and DELETE policies.
-- The mapping wizard uses upsert:true to let users re-upload an Excel file.
-- Without UPDATE/DELETE, the second upload (existing file) fails with:
--   "new row violates row-level security policy"

create policy "active users can update batch sources"
  on storage.objects for update
  using (bucket_id = 'batch-sources' and app_is_active_user());

create policy "active users can delete batch sources"
  on storage.objects for delete
  using (bucket_id = 'batch-sources' and app_is_active_user());

create policy "active users can update invoices"
  on storage.objects for update
  using (bucket_id = 'invoices' and app_is_active_user());

create policy "active users can delete invoices"
  on storage.objects for delete
  using (bucket_id = 'invoices' and app_is_active_user());
