-- Store attachment content directly in file_assets to skip storage upload
alter table file_assets add column if not exists content text;
