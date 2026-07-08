insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('batch-sources', 'batch-sources', false)
on conflict (id) do nothing;

-- Converted/matched invoice PDFs (M2/M3): browser uploads directly using the
-- user's own session (no service role needed for file bytes).
create policy "active users can read invoices"
  on storage.objects for select
  using (bucket_id = 'invoices' and app_is_active_user());

create policy "active users can upload invoices"
  on storage.objects for insert
  with check (bucket_id = 'invoices' and app_is_active_user());

-- Raw uploaded Excel source files (M2), parsed server-side afterwards.
create policy "active users can read batch sources"
  on storage.objects for select
  using (bucket_id = 'batch-sources' and app_is_active_user());

create policy "active users can upload batch sources"
  on storage.objects for insert
  with check (bucket_id = 'batch-sources' and app_is_active_user());
