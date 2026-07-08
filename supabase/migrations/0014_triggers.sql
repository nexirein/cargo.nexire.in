-- Generic updated_at toucher, applied to every table that has the column.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_mailbox_configs_updated_at before update on mailbox_configs
  for each row execute function set_updated_at();
create trigger trg_batch_runs_updated_at before update on batch_runs
  for each row execute function set_updated_at();
create trigger trg_sub_batches_updated_at before update on sub_batches
  for each row execute function set_updated_at();
create trigger trg_batch_items_updated_at before update on batch_items
  for each row execute function set_updated_at();
create trigger trg_draft_replies_updated_at before update on draft_replies
  for each row execute function set_updated_at();
create trigger trg_call_tasks_updated_at before update on call_tasks
  for each row execute function set_updated_at();

-- awb_cases gets its own trigger: every UPDATE bumps `version` automatically
-- so optimistic-concurrency callers only need to read+compare version, never
-- increment it themselves (removes a class of "forgot to bump version" bugs
-- across the claim/release/assign/update routes).
create or replace function bump_awb_case_version()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

create trigger trg_awb_cases_version before update on awb_cases
  for each row execute function bump_awb_case_version();
