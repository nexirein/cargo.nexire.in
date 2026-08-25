-- Update existing templates with improved content and proper subject formatting.
-- Uses type as the lookup key; each type should have exactly one active template.

-- NFBRK: Update to use {END_RESULT} in subject and add proper attachment paths
update templates set
  subject_template = 'Pre Alert - {AWB} / {CONSIGNEE_NAME} | {END_RESULT}'
where type = 'nfbrk' and is_active = true;

-- FEBRK-Jeena: Update subject to use dynamic {END_RESULT} instead of hardcoded FEBRK-DDP
update templates set
  subject_template = 'CARGO ARRIVAL NOTICE- Pre Alert AWB and freight charges : {AWB} {CONSIGNEE_NAME} {FREIGHT} {CURRENCY} | {END_RESULT}'
where type = 'febrk-jeena' and is_active = true;

-- FEBRK-Sunimpex: Same subject format
update templates set
  subject_template = 'CARGO ARRIVAL NOTICE- Pre Alert AWB and freight charges : {AWB} {CONSIGNEE_NAME} {FREIGHT} {CURRENCY} | {END_RESULT}'
where type = 'febrk-sunimpex' and is_active = true;

-- Add index on type for faster template resolution during batch validation
create index if not exists idx_templates_type on templates(type);
