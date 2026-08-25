# AI Implementation Guide — Cargo Pre-Alert Email Intelligence

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Data Pipeline](#2-data-pipeline)
3. [Supabase Vector DB Schema](#3-supabase-vector-db-schema)
4. [Model Architecture](#4-model-architecture)
5. [Data Labeling Strategy](#5-data-labeling-strategy)
6. [Training Pipeline](#6-training-pipeline)
7. [Integration with Cargo-PAF](#7-integration-with-cargo-paf)
8. [Implementation Phases](#8-implementation-phases)
9. [Appendix: VBA Script Fields](#9-appendix-vba-script-fields)

---

## 1. System Overview

### Goals

| Goal | Description | Where It's Used |
|------|-------------|-----------------|
| **Classifier** | Auto-detect clearance type (NFBRK, FEBRK, Calling, Hold), intent, urgency from incoming email | Batches → Validate page, Cases page |
| **RAG Retriever** | Retrieve past similar emails + best-matching reply templates | Review page, Send page |
| **Response Generator** | Draft reply subject + body using template + LLM | Send page → operator reviews before sending |
| **Follow-up Scheduler** | Auto-create follow-up tasks based on clearance type / intent / time elapsed | Cases, My Cases, Calls pages |
| **Call Log Linker** | Link call logs to AWB email threads | Calls page |

### Data Flow

```
┌─────────────┐
│  Outlook     │  VBA script extracts emails by AWB
│  Mailboxes   │  → CSV: awb,message_id,subject,sender,to,cc,body,...
└──────┬──────┘
       ▼
┌─────────────┐
│  Clean       │  Python pipeline: dedup, normalize, strip signatures,
│  Pipeline    │  extract structured fields, parse attachments
└──────┬──────┘
       ▼
┌─────────────┐
│  Label       │  Semi-auto: rules + LLM + human review
│  Engine      │  Output: clearance_type, intent, urgency
└──────┬──────┘
       ▼
┌─────────────┐
│  Embed +     │  text-embedding-3-small → store in Supabase (pgvector)
│  Store       │  Store labeled emails + templates in Supabase tables
└──────┬──────┘
       ▼
┌─────────────┐
│  Inference   │  Classify → Retrieve → Draft → Human Review → Send
│  Pipeline    │  Track → Follow-up Scheduler → Notify
└─────────────┘
```

---

## 2. Data Pipeline

### 2.1 Extraction (VBA Script)

The script `scripts/outlook_awb_extractor.bas` does:

- Reads AWBs from Excel Column A
- Scans ALL Outlook folders across ALL mailboxes
- Filters: only emails where `CC_OR_TO_MAIL` (a mail address or domain) appears
  in **TO or CC** — the shared mailbox. Empty constant = the script refuses to
  run (it never extracts all mail).
- Matches AWB in subject or body (hyphen-insensitive)
- Deduplicates by EntryID (same email not counted twice)
- Outputs two formats:
  - **Excel sheet** "Extracted Data" (wide format, 5 matches per AWB)
  - **CSV** `email_extract.csv` (long format: 1 row per email-AWB pair)

**CSV output fields:**

| Field | Example | Purpose |
|-------|---------|---------|
| `awb` | `123456789012` | Primary key for all operations |
| `message_id` | `<abc123@fedex.com>` | Global dedup across batch runs |
| `subject` | `NFBRK AWB 123456789012 — Docs Attached` | Classifier input |
| `sender` | `suresh.pal@mku.com` | Sender analysis |
| `to_addr` | `iphv@fedex.com; ops@fedex.com` | Recipient patterns |
| `cc_addr` | `sachin.bhalla@inextlogistics.com` | CC patterns (brokers, CHAs) |
| `received_at` | `2026-07-22 14:30:00` | Temporal features |
| `folder` | `Inbox` | Mailbox folder (for routing patterns) |
| `conversation_id` | `ABC123DEF` | Thread grouping |
| `attachments` | `3;invoice.pdf;packing_list.pdf;awb_copy.pdf` | Attachment types |
| `has_attachments` | `1` / `0` | Quick boolean for labeling |
| `body_text` | `Dear Team, please find attached...` | Main ML input |
| `clearance_type` | *(empty)* | **Label column — filled by the team** |
| `intent` | *(empty)* | **Label column — filled by the team** |
| `urgency` | *(empty)* | **Label column — filled by the team** |
| `response_type` | *(empty)* | **Label column — filled by the team** |

> The last four columns are empty on purpose: the operations team fills them
> when labeling the CSV. See `TRAINING_DATA_HARVEST_GUIDE.md` for the exact
> instructions handed to the team. The cleaning pipeline filters internal /
> auto-reply rows regardless of labels.

### 2.2 Cleaning Pipeline (Python)

After extraction, run this Python pipeline to produce ML-ready data:

```python
# cleaning_pipeline.py — structure only (not full implementation)

import pandas as pd
import re
from email.utils import parseaddr

def clean_email_extract(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)

    # 1. Dedup by message_id (keep first occurrence per AWB)
    df = df.drop_duplicates(subset=['awb', 'message_id'], keep='first')

    # 2. Parse structured info from subject
    df['clearance_type_rule'] = df['subject'].apply(classify_by_subject)

    # 3. Clean sender: strip display name, keep email only
    df['sender_email'] = df['sender'].apply(lambda x: parseaddr(x)[1])

    # 4. Clean body: remove quoted replies, signatures, excess whitespace
    df['body_clean'] = df['body_text'].apply(clean_body)

    # 5. Extract attachment categories
    df['has_attachments'] = df['attachments'].str[:1].astype(int) > 0
    df['attachment_types_raw'] = df['attachments']

    # 6. Extract conversation metadata
    df['is_thread_start'] = df['conversation_id'].isna() | (df['conversation_id'] == '')

    # 7. Time-based features
    df['received_at'] = pd.to_datetime(df['received_at'])
    df['received_hour'] = df['received_at'].dt.hour
    df['received_dayofweek'] = df['received_at'].dt.dayofweek

    return df


def classify_by_subject(subject: str) -> str | None:
    """Rule-based clearance type from subject line."""
    if not subject:
        return None
    s = subject.upper()
    if 'NFBRK' in s:    return 'nfbrk'
    if 'FEBRK' in s:
        if 'SUNIMPEX' in s: return 'febrk-sunimpex'
        if 'JEENA' in s:    return 'febrk-jeena'
        return 'febrk'
    if 'CALLING' in s:  return 'calling'
    if 'HOLD' in s:     return 'hold'
    return None


def clean_body(body: str) -> str:
    """Remove email signatures, quoted replies, excessive whitespace."""
    if not body:
        return ''
    # Remove lines starting with > (quoted text)
    body = re.sub(r'^>.*$', '', body, flags=re.MULTILINE)
    # Remove common signature markers
    for sig_marker in ['-- ', '___', 'Thanks', 'Regards', 'Best regards',
                        'Disclaimer:', 'DISCLAIMER', 'This message contains',
                        'Confidentiality Notice']:
        idx = body.find(sig_marker)
        if idx >= 0:
            body = body[:idx]
    # Clean whitespace
    body = re.sub(r'\n{3,}', '\n\n', body)
    return body.strip()
```

### 2.3 Data Format for ML Training

After cleaning, the data should be in this **long format** CSV:

```csv
awb,message_id,subject,body_clean,sender_email,to_addr,cc_addr,received_at,folder,conversation_id,has_attachments,clearance_type_rule,intent,urgency
123456789012,<msg1@fedex.com>,"NFBRK AWB...","Dear Team, please find...",suresh.pal@mku.com,iphv@fedex.com;ops@fedex.com,sachin.bhalla@inextlogistics.com,2026-07-22 14:30:00,Inbox,CONV001,TRUE,nfbrk,,,
```

**One row per email-AWB pair.** This is what trains the models.

---

## 3. Supabase Vector DB Schema

### 3.1 Enable pgvector

```sql
-- Run via Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3.2 Tables

```sql
-- ===========================
-- EMAILS (core data store)
-- ===========================
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  awb TEXT NOT NULL,
  subject TEXT,
  body_clean TEXT,
  sender_email TEXT,
  sender_name TEXT,
  recipients_to TEXT[],
  recipients_cc TEXT[],
  received_at TIMESTAMPTZ,
  folder TEXT,
  conversation_id TEXT,
  has_attachments BOOLEAN DEFAULT false,
  attachment_info TEXT,

  -- Labels (populated by labeling pipeline)
  clearance_type TEXT,
  intent TEXT,                       -- inquiry, update, escalation, confirmation, docs_request, other
  urgency TEXT,                      -- low, normal, high, critical
  response_type TEXT,                -- acknowledge, provide_info, request_docs, escalate, no_action

  -- Embedding (text-embedding-3-small = 1536d)
  embedding VECTOR(1536),

  -- Metadata
  source_batch TEXT,                 -- which VBA export batch
  labeled_by TEXT,                   -- 'rule', 'llm', 'human', 'gold'
  human_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_emails_awb ON emails(awb);
CREATE INDEX idx_emails_message_id ON emails(message_id);
CREATE INDEX idx_emails_clearance_type ON emails(clearance_type);
CREATE INDEX idx_emails_intent ON emails(intent);
CREATE INDEX idx_emails_received_at ON emails(received_at);

-- Vector similarity search index
CREATE INDEX idx_emails_embedding ON emails
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ===========================
-- TEMPLATES (reply templates)
-- ===========================
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clearance_type TEXT NOT NULL,
  intent TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  variables JSONB,                   -- list of required variable names
  version INT DEFAULT 1,
  active BOOLEAN DEFAULT true,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_templates_active ON templates(active);
CREATE INDEX idx_templates_clearance_intent ON templates(clearance_type, intent);


-- ===========================
-- GENERATED RESPONSES (audit trail)
-- ===========================
CREATE TABLE generated_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  awb TEXT,
  original_subject TEXT,
  original_body TEXT,
  generated_subject TEXT,
  generated_body TEXT,
  confidence_score REAL,
  model_used TEXT,                   -- 'gpt-4o-mini', 'claude-3-haiku', etc.
  status TEXT DEFAULT 'draft',       -- draft, reviewed, sent, rejected, edited
  reviewed_by UUID,
  edited_subject TEXT,
  edited_body TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_generated_responses_status ON generated_responses(status);


-- ===========================
-- FOLLOW-UPS (scheduled tasks)
-- ===========================
CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  awb TEXT NOT NULL,
  email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,                -- reminder, escalation, doc_request, callback
  status TEXT DEFAULT 'pending',     -- pending, sent, completed, cancelled
  note TEXT,
  assigned_to UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_follow_ups_status ON follow_ups(status);
CREATE INDEX idx_follow_ups_due ON follow_ups(due_at) WHERE status = 'pending';


-- ===========================
-- INFERENCE LOG (model performance monitoring)
-- ===========================
CREATE TABLE inference_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_awb TEXT,
  input_subject TEXT,
  input_body_hash TEXT,
  predicted_clearance_type TEXT,
  predicted_intent TEXT,
  predicted_urgency TEXT,
  actual_clearance_type TEXT,        -- filled when human corrects
  actual_intent TEXT,
  actual_urgency TEXT,
  confidence REAL,
  latency_ms INT,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Embedding Function (in Postgres)

```sql
-- Helper function to generate embeddings (call via Supabase Edge Functions)
-- Or generate in Python and insert directly
CREATE OR REPLACE FUNCTION match_similar_emails(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  filter_clearance_type TEXT DEFAULT NULL,
  filter_intent TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  awb TEXT,
  subject TEXT,
  body_clean TEXT,
  clearance_type TEXT,
  intent TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.awb, e.subject, e.body_clean,
    e.clearance_type, e.intent,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM emails e
  WHERE
    e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (filter_clearance_type IS NULL OR e.clearance_type = filter_clearance_type)
    AND (filter_intent IS NULL OR e.intent = filter_intent)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 4. Model Architecture

### 4.1 Classifier

**What it does:** Given an email's subject + body + sender metadata, predict:
1. `clearance_type` (nfbrk, febrk, febrk-jeena, febrk-sunimpex, calling, hold)
2. `intent` (inquiry, update, escalation, confirmation, docs_request, other)
3. `urgency` (low, normal, high, critical)

**Approach 1 — Embedding + Logistic Regression (simpler, cheaper):**

```
Input Text (Subject + Body)
        │
        ▼
text-embedding-3-small  (OpenAI API — 1536d)
        │
        ▼
Logistic Regression (one-vs-rest per label)
        │
        ▼
Output: clearance_type (acc ~0.95), intent (acc ~0.85), urgency (acc ~0.80)
```

**Implementation:**

```python
import openai
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder

# Get embeddings
def embed_text(text: str) -> list[float]:
    resp = openai.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return resp.data[0].embedding

# Train
X = np.array([embed_text(row) for row in df['train_text']])
y_ct = label_encoder_ct.fit_transform(df['clearance_type'])

clf_ct = LogisticRegression(max_iter=1000, multi_class='multinomial')
clf_ct.fit(X, y_ct)
```

**Approach 2 — Few-shot LLM (more accurate, higher cost):**

```
Prompt:
    System: Classify the following pre-alert email.
    Labels: {nfbrk, febrk, febrk-jeena, febrk-sunimpex, calling, hold}
    User: [email subject + body]
    
Output (structured JSON):
    {"clearance_type": "nfbrk", "intent": "update", "urgency": "normal"}
```

Use `gpt-4o-mini` for cost efficiency (~$0.15/1M input tokens).

### 4.2 RAG Retriever

**What it does:** Given a classified email, find the most relevant past emails and templates.

```
New Email
    │
    ▼
Generate embedding (text-embedding-3-small)
    │
    ▼
Search Supabase (match_similar_emails):
    │   ├── same clearance_type → top 5 historical emails
    │   └── same clearance_type + intent → top 3 templates
    ▼
Return: [hist_email_1, ..., hist_email_5, template_1, template_2, template_3]
```

### 4.3 Response Generator

**What it does:** Draft a reply email using retrieved examples + template.

```
System Prompt:
    You are a cargo pre-alert operations assistant.
    Given the incoming email and retrieved context, draft a reply.

Context:
    - Incoming email: [subject + body]
    - Classified as: [clearance_type, intent, urgency]
    - Similar past email #1: [subject + body + actual reply]
    - Similar past email #2: ...
    - Best template: [subject_template + body_template]
    - Variables to fill: [awb, consignee_name, broker, etc.]

Output:
    {
        "subject": "Re: [original subject]",
        "body": "Dear [sender],\n\n[reply content]\n\nBest regards,\nOperations Team",
        "template_used": "template_id_123",
        "confidence": 0.87
    }
```

### 4.4 Follow-up Scheduler

**Rules engine (not ML — deterministic):**

| Condition | Action | Delay |
|-----------|--------|-------|
| clearance_type=NFBRK, no reply in 24h | Create follow-up: reminder | 24h after sent |
| clearance_type=FEBRK, broker not confirmed | Create follow-up: escalation | 48h after sent |
| intent=docs_request, no docs received | Create follow-up: doc reminder | 24h, then 72h |
| clearance_type=Calling, no callback log | Create follow-up: callback | 4h |
| urgency=critical, no action in 2h | Create follow-up: escalation | 2h |
| Thread inactive > 7 days | Create follow-up: status check | 7d |

---

## 5. Data Labeling Strategy

### 5.1 Label Hierarchy

```
Per email:
├── clearance_type     (6 classes) ← already have rules from existing system
├── intent             (5+ classes) ← needs labeling
├── urgency            (4 classes)  ← needs labeling
└── response_type      (5 classes)  ← needs labeling
```

### 5.2 Semi-Automated Labeling Pipeline

**Phase 1 — Rule-based (0 human effort):**
- `clearance_type`: ✓ already classified by existing `resolveClearanceType()` function
- `is_thread_start`: True/False from conversation_id
- `has_attachments`: True/False from attachment count
- `received_hour`, `received_dayofweek`: auto from timestamp

**Phase 2 — LLM-assisted labeling (minimal human effort):**

```python
def llm_label_email(subject: str, body: str, sender: str) -> dict:
    prompt = f"""
    Classify this pre-alert email:
    
    Subject: {subject[:200]}
    Body: {body[:1000]}
    Sender: {sender}
    
    Return JSON:
    {{
        "intent": "inquiry|update|escalation|confirmation|docs_request|other",
        "urgency": "low|normal|high|critical",
        "response_type": "acknowledge|provide_info|request_docs|escalate|no_action",
        "confidence": 0.0-1.0
    }}
    """
    # Call OpenAI
    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)
```

**Phase 3 — Human review (active learning):**
- Show lowest-confidence predictions to human
- Batch review in a simple web UI or spreadsheet
- 200-300 human-labeled examples → retrain → improve confidence
- Target: 1000 labeled emails for initial training set

### 5.3 Label Quality

| Label | Expected Accuracy | Minimum Samples |
|-------|-------------------|-----------------|
| clearance_type | 99% (rule-based) | N/A (rules exist) |
| intent | 95% (LLM + human review) | 500 per class |
| urgency | 90% (LLM + human review) | 200 per class |
| response_type | 90% (LLM + human review) | 300 per class |

---

## 6. Training Pipeline

### 6.1 Dependencies

```txt
# requirements_ai.txt
openai>=1.0.0
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
supabase>=2.0.0
pgvector>=0.2.0
python-dotenv>=1.0.0
```

### 6.2 Embedding + Store Pipeline

```python
# embed_and_store.py — one-time batch job

import os
import pandas as pd
from openai import OpenAI
from supabase import create_client

client = OpenAI()
supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

df = pd.read_csv('email_extract.csv')

for _, row in df.iterrows():
    # Combine text for embedding
    text = f"{row['subject']}\n{row['body_clean']}"
    
    # Generate embedding
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000]  # truncate to token limit
    )
    embedding = resp.data[0].embedding
    
    # Insert into Supabase
    supabase.table('emails').insert({
        'message_id': row['message_id'],
        'awb': row['awb'],
        'subject': row['subject'],
        'body_clean': row['body_clean'],
        'sender_email': row['sender_email'],
        'recipients_to': row['to_addr'].split(';') if pd.notna(row['to_addr']) else [],
        'recipients_cc': row['cc_addr'].split(';') if pd.notna(row['cc_addr']) else [],
        'received_at': row['received_at'],
        'folder': row['folder'],
        'conversation_id': row['conversation_id'],
        'has_attachments': row['has_attachments'],
        'clearance_type': row['clearance_type'],
        'intent': row['intent'],
        'urgency': row['urgency'],
        'embedding': embedding,
        'source_batch': 'v1_extract',
        'labeled_by': 'llm'
    }).execute()
```

### 6.3 Classifier Training Script

```python
# train_classifier.py

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# Load embeddings + labels
df = pd.read_parquet('labeled_emails.parquet')
X = np.array([json.loads(e) for e in df['embedding']])  # 1536-dim vectors
y = df['clearance_type']

# Train/val split
X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)

# Train
clf = LogisticRegression(max_iter=1000, multi_class='multinomial')
clf.fit(X_train, y_train)

# Evaluate
y_pred = clf.predict(X_val)
print(classification_report(y_val, y_pred))

# Save
joblib.dump(clf, 'models/clearance_type_classifier.pkl')
joblib.dump(le, 'models/clearance_type_encoder.pkl')
```

### 6.4 Inference Endpoint

```python
# inference.py — called from cargo-paf API

import joblib
import openai
from supabase import create_client

clf = joblib.load('models/clearance_type_classifier.pkl')
le = joblib.load('models/clearance_type_encoder.pkl')

def classify_email(subject: str, body: str) -> dict:
    text = f"{subject}\n{body}"
    
    # Embed
    resp = openai.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000]
    )
    emb = resp.data[0].embedding
    
    # Classify
    ct_pred = clf.predict([emb])[0]
    ct_proba = max(clf.predict_proba([emb])[0])
    
    # RAG: find similar emails
    similar = supabase.rpc('match_similar_emails', {
        'query_embedding': emb,
        'match_threshold': 0.7,
        'match_count': 5,
        'filter_clearance_type': ct_pred
    }).execute()
    
    # RAG: find best template
    templates = supabase.table('templates') \
        .select('*') \
        .eq('clearance_type', ct_pred) \
        .eq('active', True) \
        .execute()
    
    return {
        'clearance_type': ct_pred,
        'confidence': ct_proba,
        'similar_emails': similar.data,
        'templates': templates.data
    }
```

---

## 7. Integration with Cargo-PAF

### 7.1 New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/classify` | POST | Classify email (subject + body → clearance_type, intent, urgency) |
| `/api/ai/similar` | POST | Find similar historical emails by text |
| `/api/ai/draft-reply` | POST | Generate draft reply for an email |
| `/api/ai/followups` | POST | Generate follow-up tasks for an AWB |
| `/api/ai/templates` | GET | List available templates (filtered by clearance_type, intent) |
| `/api/ai/feedback` | POST | Log human correction for model improvement |

### 7.2 UI Integration Points

**Validate Page (`/batches/[id]/validate`):**
- After validation, show AI classification for clearance type with confidence
- "AI suggests NFBRK (97%)" badge next to each clearance type count
- Click to accept/reject

**Review Page (`/batches/[id]/review`):**
- Show AI-generated draft replies for each clearance type group
- Operator can edit before sending
- Track acceptance rate for model improvement

**Send Page (`/batches/[id]/send`):**
- Pre-populate reply subject/body from AI draft
- Operator reviews, edits, confirms
- Logs final sent version vs AI draft for quality tracking

**Cases Page / My Cases / Calls Page:**
- Show AI-suggested follow-ups
- "Follow-up: Reminder for AWB 123456789012 — due in 4h"
- One-click create follow-up task

### 7.3 Component: AIClassificationBadge

```tsx
// components/ai/ai-classification-badge.tsx

interface AIClassificationProps {
  clearanceType: string;
  confidence: number;
  onAccept: () => void;
  onReject: () => void;
}

export function AIClassificationBadge({
  clearanceType,
  confidence,
  onAccept,
  onReject,
}: AIClassificationProps) {
  const display = CLEARANCE_DISPLAY[clearanceType];
  const highConf = confidence > 0.9;

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${
      highConf ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
    }`}>
      <span className="text-xs text-slate-500">AI:</span>
      <span className={`text-sm font-medium ${display?.text ?? ''}`}>
        {display?.label ?? clearanceType}
      </span>
      <span className={`text-xs ${highConf ? 'text-emerald-600' : 'text-amber-600'}`}>
        ({(confidence * 100).toFixed(0)}%)
      </span>
      <button onClick={onAccept} className="text-xs text-emerald-600 hover:text-emerald-800">✓</button>
      <button onClick={onReject} className="text-xs text-red-500 hover:text-red-700">✗</button>
    </div>
  );
}
```

---

## 8. Implementation Phases

### Phase 1: Data Foundation (Week 1-2)

| Step | Task | Deliverable |
|------|------|-------------|
| 1.1 | Run VBA script on 500+ AWBs | `email_extract.csv` with 2000+ emails |
| 1.2 | Build cleaning pipeline | `cleaning_pipeline.py` → clean dataset |
| 1.3 | Set up Supabase project | Enable pgvector, create tables |
| 1.4 | Embed + store all emails | Supabase `emails` table populated |
| 1.5 | Rule-based clearance type labeling | Labels for all emails |

**Success criteria:** 2000+ emails in Supabase with embeddings and clearance type labels.

### Phase 2: LLM Labeling + Human Review (Week 2-3)

| Step | Task | Deliverable |
|------|------|-------------|
| 2.1 | Build LLM labeling script | `label_with_llm.py` |
| 2.2 | Label intent + urgency for all emails | Intent/urgency labels in Supabase |
| 2.3 | Build simple review UI (or use spreadsheet) | Review tool |
| 2.4 | Human review of 300 lowest-confidence samples | Gold-labeled set |
| 2.5 | Iterate: retrain, re-label, re-review | Label quality report |

**Success criteria:** 90%+ agreement on human-reviewed subset for intent/urgency.

### Phase 3: Classifier Training (Week 3-4)

| Step | Task | Deliverable |
|------|------|-------------|
| 3.1 | Train embedding + logistic regression classifier | `models/clearance_type_classifier.pkl` |
| 3.2 | Evaluate on holdout set | Accuracy, precision, recall report |
| 3.3 | Train intent + urgency classifiers | 3 classifiers total |
| 3.4 | Build inference API endpoint | `POST /api/ai/classify` |

**Success criteria:** Classifier accuracy >95% for clearance type, >85% for intent.

### Phase 4: RAG + Templates (Week 4-5)

| Step | Task | Deliverable |
|------|------|-------------|
| 4.1 | Create template library (10-15 templates) | `templates` table populated |
| 4.2 | Build RAG retrieval function | `match_similar_emails()` + `match_templates()` |
| 4.3 | Build draft-reply LLM prompt | Response generator |
| 4.4 | Build `POST /api/ai/draft-reply` endpoint | API endpoint |
| 4.5 | Manual evaluation: 50 replies, check quality | Quality report |

**Success criteria:** 80% of draft replies usable with minor edits.

### Phase 5: Follow-up Scheduler (Week 5)

| Step | Task | Deliverable |
|------|------|-------------|
| 5.1 | Implement rules engine | `follow_up_rules.py` |
| 5.2 | Build `POST /api/ai/followups` | API endpoint |
| 5.3 | Add Supabase cron job (pg_cron) | Auto-create follow-ups every hour |
| 5.4 | Build notification system | In-app + email notifications |

### Phase 6: Cargo-PAF Integration (Week 5-6)

| Step | Task | Deliverable |
|------|------|-------------|
| 6.1 | Add `AIClassificationBadge` to validate page | UI component |
| 6.2 | Add AI draft to review/send pages | Draft reply panel |
| 6.3 | Add follow-up displays to cases/calls pages | Follow-up panel |
| 6.4 | Add feedback collection (accept/reject tracking) | `inference_log` table updates |
| 6.5 | End-to-end testing | Test script + QA signoff |

### Phase 7: Monitoring & Iteration (Ongoing)

| Step | Task | Deliverable |
|------|------|-------------|
| 7.1 | Monitor inference quality weekly | Dashboard |
| 7.2 | Collect human corrections as training data | Weekly training data update |
| 7.3 | Retrain classifier monthly | Deployed model v2, v3, ... |
| 7.4 | Track business metrics: time saved, reply rate | Report |

---

## 9. Appendix: VBA Script Fields

The updated VBA script (`scripts/outlook_awb_extractor.bas`) now extracts 10 fields per match:

| # | Field | Description | ML Use |
|---|-------|-------------|--------|
| 1 | **MessageID** | Internet Message ID or EntryID | Global dedup |
| 2 | **Subject** | Email subject line | Main classifier input |
| 3 | **Sender** | Resolved sender email | Sender pattern analysis |
| 4 | **To** | Semicolon-separated To recipients | Recipient pattern analysis |
| 5 | **CC** | Semicolon-separated CC recipients | CC pattern (brokers, CHAs) |
| 6 | **Received** | `yyyy-mm-dd hh:mm:ss` | Temporal features |
| 7 | **Folder** | Folder name (Inbox, Sent Items, etc.) | Routing patterns |
| 8 | **ConversationID** | Outlook conversation ID | Thread grouping |
| 9 | **Attachments** | `count;filename1;filename2;...` | Attachment type detection |
| 10 | **Body** | Plain text body | Main ML input (longest field) |

**Output modes:**
- Excel sheet: Wide format (up to 5 matches × 10 fields per AWB row)
- CSV export: Long format (1 row per email-AWB pair) — **this is the ML input**

**To re-run with new AWBs:** paste new AWBs in Column A, run `ExtractOutlookData`. The CSV is overwritten.

---

## Quick Start

```bash
# 1. Run VBA script in Excel → get email_extract.csv

# 2. Set up Python environment
pip install -r requirements_ai.txt

# 3. Run cleaning pipeline
python scripts/cleaning_pipeline.py \
  --input email_extract.csv \
  --output cleaned_emails.parquet

# 4. Run rule-based labeling
python scripts/label_rules.py \
  --input cleaned_emails.parquet \
  --output labeled_emails.parquet

# 5. Embed and store in Supabase
python scripts/embed_and_store.py \
  --input labeled_emails.parquet

# 6. Train classifier
python scripts/train_classifier.py \
  --input labeled_emails.parquet \
  --output models/

# 7. Deploy inference API
# (integrate POST /api/ai/classify into cargo-paf)
```
