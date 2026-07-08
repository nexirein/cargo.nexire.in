-- Per spec section 12 "Additional DB notes."
create index idx_batch_items_awb on batch_items(awb);
create index idx_batch_items_batch_run on batch_items(batch_run_id);
create index idx_batch_items_sub_batch on batch_items(sub_batch_id);
create index idx_batch_items_send_status on batch_items(send_status);

create index idx_sub_batches_batch_run on sub_batches(batch_run_id);

create index idx_awb_cases_awb on awb_cases(awb);
create index idx_awb_cases_owner on awb_cases(owner_user_id);
create index idx_awb_cases_status on awb_cases(current_status);
create index idx_awb_cases_issue_type on awb_cases(issue_type);
create index idx_awb_cases_urgency on awb_cases(urgency);
create index idx_awb_cases_next_action_at on awb_cases(next_action_at);
create index idx_awb_cases_slipped on awb_cases(slipped);
create index idx_awb_cases_created_at on awb_cases(created_at);

create index idx_email_events_awb on email_events(awb);
create index idx_email_events_batch_run on email_events(batch_run_id);
create index idx_email_events_message_id on email_events(message_id);

create index idx_case_assignments_case on case_assignments(case_id);
create index idx_case_updates_case on case_updates(case_id);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_actor on audit_logs(actor_user_id);

create index idx_file_assets_batch_item on file_assets(batch_item_id);
create index idx_file_assets_awb on file_assets(awb);
