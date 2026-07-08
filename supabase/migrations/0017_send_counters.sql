-- Atomic, race-safe counter increments + derived status transitions for
-- the send engine. Called once per completed send job (possibly from many
-- concurrent QStash-invoked webhook requests hitting the same batch_run/
-- sub_batch row), so the increment and the status check that follows it
-- must happen inside one row-locked UPDATE/SELECT, not as separate
-- read-then-write steps in application code.

create or replace function increment_sub_batch_counter(p_sub_batch_id uuid, p_column text)
returns void
language plpgsql
as $$
declare
  v_total int;
  v_sent int;
  v_failed int;
begin
  if p_column = 'sent_count' then
    update sub_batches set sent_count = sent_count + 1 where id = p_sub_batch_id;
  elsif p_column = 'failed_count' then
    update sub_batches set failed_count = failed_count + 1 where id = p_sub_batch_id;
  end if;

  select total_items, sent_count, failed_count into v_total, v_sent, v_failed
  from sub_batches where id = p_sub_batch_id;

  if v_sent + v_failed >= v_total then
    update sub_batches
    set status = case when v_failed = 0 then 'completed' else 'partially_failed' end,
        updated_at = now()
    where id = p_sub_batch_id;
  else
    update sub_batches set status = 'processing', updated_at = now() where id = p_sub_batch_id;
  end if;
end;
$$;

create or replace function increment_batch_run_counter(p_batch_run_id uuid, p_column text)
returns void
language plpgsql
as $$
declare
  v_total int;
  v_sent int;
  v_failed int;
begin
  if p_column = 'sent_count' then
    update batch_runs set sent_count = sent_count + 1 where id = p_batch_run_id;
  elsif p_column = 'failed_count' then
    update batch_runs set failed_count = failed_count + 1 where id = p_batch_run_id;
  end if;

  select total_rows, sent_count, failed_count into v_total, v_sent, v_failed
  from batch_runs where id = p_batch_run_id;

  if v_sent + v_failed >= v_total then
    update batch_runs
    set status = case when v_failed = 0 then 'completed' else 'partially_sent' end,
        updated_at = now()
    where id = p_batch_run_id;
  else
    update batch_runs set status = 'sending', updated_at = now() where id = p_batch_run_id;
  end if;
end;
$$;
