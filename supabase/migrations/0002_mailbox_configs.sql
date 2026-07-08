create table mailbox_configs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references app_users(id),
  display_name text not null,
  operational_mailbox text not null,
  tagged_mailbox text not null,
  signature_html text,
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table mailbox_configs enable row level security;
