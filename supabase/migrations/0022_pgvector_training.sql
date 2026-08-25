-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Training examples for AI classification
create table training_examples (
  id uuid primary key default gen_random_uuid(),
  awb text,
  subject text,
  customer_message text not null,
  issue_type text not null,
  urgency text not null default 'normal',
  action_taken text not null,
  human_review_required boolean not null default false,
  call_required boolean not null default false,
  final_resolution text,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index on training_examples using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

alter table training_examples enable row level security;

create policy "Active users can read training examples"
  on training_examples for select
  using (true);

-- Reminder policy configuration per team
create table reminder_policies (
  id uuid primary key default gen_random_uuid(),
  policy_name text not null,
  first_reminder_hours int not null default 48,
  final_reminder_hours int not null default 72,
  urgent_sla_minutes int not null default 120,
  max_reminder_level int not null default 2,
  call_escalation_after_hours int not null default 96,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into reminder_policies (policy_name, first_reminder_hours, final_reminder_hours) values
  ('Default', 48, 72);

alter table reminder_policies enable row level security;

create policy "Active users can read reminder policies"
  on reminder_policies for select
  using (true);

-- Add policy FK to mailbox_configs
alter table mailbox_configs
  add column if not exists reminder_policy_id uuid references reminder_policies(id);

-- Create function to schedule reminders when case becomes awaiting_reply
create or replace function schedule_initial_reminders()
returns trigger
language plpgsql
as $$
declare
  v_policy_id uuid;
  v_first_reminder_hours int;
  v_final_reminder_hours int;
begin
  if new.current_status = 'awaiting_reply' then
    select coalesce(mc.reminder_policy_id, rp.id) into v_policy_id
    from batch_runs br
    left join mailbox_configs mc on mc.id = br.mailbox_config_id
    cross join reminder_policies rp
    where rp.is_active = true
    and br.id = new.latest_batch_run_id
    order by rp.created_at
    limit 1;

    select first_reminder_hours, final_reminder_hours
    into v_first_reminder_hours, v_final_reminder_hours
    from reminder_policies where id = v_policy_id;

    insert into reminder_jobs (case_id, reminder_level, due_at)
    values
      (new.id, 1, now() + (v_first_reminder_hours || ' hours')::interval),
      (new.id, 2, now() + (v_final_reminder_hours || ' hours')::interval);
  end if;
  return new;
end;
$$;

create trigger trg_schedule_reminders
  after insert or update of current_status on awb_cases
  for each row
  when (new.current_status = 'awaiting_reply')
  execute function schedule_initial_reminders();
