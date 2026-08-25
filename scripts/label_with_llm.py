"""
LLM Labeling — Enrich cleaned emails with intent, urgency, response_type labels.

Uses GPT-4o-mini to classify each email. Processes in batches with cost tracking.

Input:  cleaned_emails.csv (from cleaning_pipeline.py)
Output: enriched_emails.csv (adds intent, urgency, response_type, clearance_type columns)
"""

import os
import sys
import json
import time
import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI
from tqdm import tqdm

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = "gpt-4o-mini"
BATCH_SIZE = 10
RATE_LIMIT_SLEEP = 1.0
MAX_RETRIES = 3


def get_openai() -> OpenAI:
    if not OPENAI_API_KEY:
        print("[ERROR] OPENAI_API_KEY must be set in .env")
        sys.exit(1)
    return OpenAI(api_key=OPENAI_API_KEY)


CLASSIFY_PROMPT = """Classify this FedEx cargo pre-alert email into structured labels.

Email Subject: {subject}
Email Body: {body}

Return JSON:
{{
  "clearance_type": "nfbrk" | "febrk" | "febrk-sunimpex" | "febrk-jeena" | "calling" | "hold",
  "intent": "inquiry" | "update" | "escalation" | "confirmation" | "docs_request" | "other",
  "urgency": "low" | "normal" | "high" | "critical",
  "response_type": "acknowledge" | "provide_info" | "request_docs" | "escalate" | "no_action",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}}

Return ONLY valid JSON."""


def classify_email(openai: OpenAI, subject: str, body: str) -> dict | None:
    body_truncated = body[:3000] if body else ""
    prompt = CLASSIFY_PROMPT.format(subject=subject[:500], body=body_truncated)

    for attempt in range(MAX_RETRIES):
        try:
            response = openai.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            if content:
                return json.loads(content)
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RATE_LIMIT_SLEEP * (attempt + 1))
                continue
            print(f"\n[ERROR] LLM classification failed: {e}")
    return None


def main(input_csv: str, output_csv: str, resume: bool = False):
    if not os.path.exists(input_csv):
        print(f"[ERROR] Input file not found: {input_csv}")
        sys.exit(1)

    df = pd.read_csv(input_csv, dtype=str, keep_default_na=False)
    print(f"[INFO] Loaded {len(df)} rows from {input_csv}")

    if "intent" in df.columns and resume:
        already_labeled = df["intent"].notna() & (df["intent"] != "")
        df = df[~already_labeled]
        print(f"[INFO] Resuming: {len(df)} rows remaining after filtering already-labeled")

    openai = get_openai()
    total_cost_estimate = 0
    results = []
    errors = 0

    for i in tqdm(range(0, len(df)), desc="Labeling"):
        row = df.iloc[i]
        subject = str(row.get("subject", ""))
        body = str(row.get("body_clean", "") or row.get("customer_message", ""))

        if not body or len(body) < 20:
            results.append({
                "clearance_type": "",
                "intent": "other",
                "urgency": "normal",
                "response_type": "no_action",
                "confidence": 0,
            })
            continue

        result = classify_email(openai, subject, body)
        if result:
            results.append(result)
            total_cost_estimate += 0.0002
        else:
            results.append({
                "clearance_type": "",
                "intent": "other",
                "urgency": "normal",
                "response_type": "no_action",
                "confidence": 0,
            })
            errors += 1

        if i > 0 and i % 10 == 0:
            time.sleep(RATE_LIMIT_SLEEP)

    output_df = pd.DataFrame(results)
    combined = pd.concat([df.reset_index(drop=True), output_df], axis=1)
    combined.to_csv(output_csv, index=False)

    print(f"\n[OK] Enriched dataset written to {output_csv}")
    print(f"     Total: {len(combined)} rows")
    print(f"     Errors: {errors}")
    print(f"     Est. API cost: ~${total_cost_estimate:.2f}")

    print(f"\nLabel Distribution:")
    for col in ["clearance_type", "intent", "urgency", "response_type"]:
        if col in combined.columns:
            print(f"\n{col}:")
            print(combined[col].value_counts().to_string())


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="LLM label enrichment for email dataset")
    parser.add_argument("input", default="cleaned_emails.csv", nargs="?",
                        help="Input CSV (default: cleaned_emails.csv)")
    parser.add_argument("output", default="enriched_emails.csv", nargs="?",
                        help="Output CSV (default: enriched_emails.csv)")
    parser.add_argument("--resume", action="store_true",
                        help="Skip rows that already have intent labels")
    args = parser.parse_args()
    main(args.input, args.output, args.resume)
