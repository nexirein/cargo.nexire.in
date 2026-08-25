-- Storage bucket for template fixed attachments (DO FORMAT.docx, BANK DETAILS.docx, etc.)
insert into storage.buckets (id, name, public)
values ('template-attachments', 'template-attachments', false)
on conflict (id) do nothing;

create policy "active users can read template attachments"
  on storage.objects for select
  using (bucket_id = 'template-attachments' and app_is_active_user());

create policy "active users can upload template attachments"
  on storage.objects for insert
  with check (bucket_id = 'template-attachments' and app_is_active_user());

create policy "active users can delete template attachments"
  on storage.objects for delete
  using (bucket_id = 'template-attachments' and app_is_active_user());
