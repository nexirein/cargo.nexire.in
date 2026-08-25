-- Enable pg_trgm extension for fuzzy company name matching
-- Used by the Bulk Clearance Fill feature to match company names
-- that have minor variations (e.g., "ABC PVT LTD" vs "ABC PRIVATE LIMITED")
create extension if not exists pg_trgm with schema extensions;

-- Fuzzy matching index on company_clearance_master
create index if not exists idx_company_clearance_trgm
  on company_clearance_master using gin (company_name gin_trgm_ops);

-- Fuzzy matching index on broker_master
create index if not exists idx_broker_master_trgm
  on broker_master using gin (company_name gin_trgm_ops);

-- Normalization function: strips legal suffixes and normalizes whitespace
-- Used for better company name matching
create or replace function normalize_company_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text;
begin
  v_name := lower(trim(p_name));

  -- Remove common legal suffixes (order matters — longer first)
  v_name := regexp_replace(v_name, '\yprivate limited\y', '', 'g');
  v_name := regexp_replace(v_name, '\ypvt\.?\s*ltd\.?\y', '', 'g');
  v_name := regexp_replace(v_name, '\ypvt\b', '', 'g');
  v_name := regexp_replace(v_name, '\ylimited\y', '', 'g');
  v_name := regexp_replace(v_name, '\yltd\b', '', 'g');
  v_name := regexp_replace(v_name, '\yplc\y', '', 'g');
  v_name := regexp_replace(v_name, '\yllc\y', '', 'g');
  v_name := regexp_replace(v_name, '\yinc\b', '', 'g');
  v_name := regexp_replace(v_name, '\ycorporation\y', '', 'g');
  v_name := regexp_replace(v_name, '\ycorp\b', '', 'g');
  v_name := regexp_replace(v_name, '\ycompany\y', '', 'g');
  v_name := regexp_replace(v_name, '\yco\.?\b', '', 'g');

  -- Remove parenthetical qualifiers
  v_name := regexp_replace(v_name, '\(.*?\)', '', 'g');
  v_name := regexp_replace(v_name, '\*.*?\*', '', 'g');

  -- Remove non-alphanumeric characters (keep spaces and letters/numbers)
  v_name := regexp_replace(v_name, '[^a-z0-9\s]', ' ', 'g');

  -- Collapse whitespace
  v_name := regexp_replace(v_name, '\s+', ' ', 'g');
  v_name := trim(v_name);

  return v_name;
end;
$$;

-- Lookup function: find best clearance type match with fuzzy fallback
-- Returns clearance_type + similarity score
create or replace function fuzzy_clearance_lookup(p_company_name text)
returns table (
  clearance_type text,
  source text,
  similarity real
)
language plpgsql
stable
as $$
declare
  v_normalized text;
begin
  v_normalized := normalize_company_name(p_company_name);

  -- Level 1: exact normalized match
  return query
  select
    ccm.clearance_type,
    ccm.source,
    1.0::real as similarity
  from company_clearance_master ccm
  where normalize_company_name(ccm.company_name) = v_normalized
  order by ccm.times_seen desc, ccm.last_seen_at desc
  limit 1;

  -- If not found, Level 2: fuzzy trigram match
  if not found then
    return query
    select
      ccm.clearance_type,
      ccm.source,
      similarity(normalize_company_name(ccm.company_name), v_normalized) as sim
    from company_clearance_master ccm
    where similarity(normalize_company_name(ccm.company_name), v_normalized) > 0.4
    order by sim desc, ccm.times_seen desc, ccm.last_seen_at desc
    limit 1;
  end if;
end;
$$;

-- Trigger: auto-set updated_at on company_clearance_master
drop trigger if exists trg_company_clearance_master_updated_at on company_clearance_master;
create trigger trg_company_clearance_master_updated_at
  before update on company_clearance_master
  for each row
  execute function set_updated_at();
