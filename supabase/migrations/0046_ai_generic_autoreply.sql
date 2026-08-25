-- Generic shipment-info auto-replies.
-- Routine info requests ("need more info about this shipment", IGM/DO/charges
-- queries, confirmations) are auto-answered — grounded in real shipment facts
-- pulled from awb_cases + batch_items — at a lower confidence threshold than
-- the strict 0.97 auto-send. Escalations / urgent / VIP / legal still require
-- human review.

insert into app_config (key, value, description) values
  ('auto_send_routine_enabled', 'true'::jsonb, 'Enable auto-reply for routine info requests (shipment info, IGM/DO/charges queries, confirmations, acknowledgements)'),
  ('auto_send_routine_min_confidence', '0.80'::jsonb, 'Minimum confidence for routine auto-replies'),
  ('auto_send_patterns', '[
    {"clearance_type": "nfbrk", "intent": "inquiry"},
    {"clearance_type": "nfbrk", "intent": "confirmation"},
    {"clearance_type": "nfbrk", "intent": "update"},
    {"clearance_type": "nfbrk", "intent": "docs_request"},
    {"intent": "inquiry"},
    {"intent": "confirmation"}
  ]'::jsonb, 'Intent/clearance combos eligible for AI auto-reply')
on conflict (key) do nothing;
