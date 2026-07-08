-- Broad SELECT for any active app user. This is an internal ops tool with
-- no dedicated `teams` table for hard row partitioning, so "lead sees their
-- team" style narrowing happens in application queries, not RLS.
--
-- All INSERT/UPDATE/DELETE on these tables intentionally has NO policy here:
-- every mutation goes through a Next.js Route Handler using the service-role
-- client after an app-level auth/role check, and service-role bypasses RLS.
-- This keeps "who can change what" logic in one place (the route handlers)
-- instead of split between Postgres policies and application code.
do $$
declare
  t text;
  tables text[] := array[
    'app_users', 'mailbox_configs', 'batch_runs', 'sub_batches', 'batch_items',
    'file_assets', 'email_events', 'awb_cases', 'case_assignments', 'case_updates',
    'ai_classifications', 'draft_replies', 'reminder_jobs', 'call_tasks', 'audit_logs'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create policy %I on %I for select using (app_is_active_user());',
      'select_active_users', t
    );
  end loop;
end $$;
