-- Opt the send-progress tables into Supabase's realtime broadcast so the
-- send-progress page gets sub-second updates without polling.
alter publication supabase_realtime add table batch_runs;
alter publication supabase_realtime add table sub_batches;
alter publication supabase_realtime add table batch_items;
