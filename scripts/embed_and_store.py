"""
Embed + Store Pipeline — Embed cleaned email text and store in Supabase.

Input:  cleaned_emails.csv (from cleaning_pipeline.py)
Output: Populates 'emails' table in Supabase with embeddings

Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY in .env
"""

import os
import sys
import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client
from tqdm import tqdm

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

BATCH_SIZE = 20
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_openai() -> OpenAI:
    if not OPENAI_API_KEY:
        print("[ERROR] OPENAI_API_KEY must be set in .env")
        sys.exit(1)
    return OpenAI(api_key=OPENAI_API_KEY)


def embed_batch(client: OpenAI, texts: list[str]) -> list[list[float]]:
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
        dimensions=EMBEDDING_DIMS,
    )
    return [d.embedding for d in response.data]


def store_emails(df: pd.DataFrame) -> None:
    supabase = get_supabase()
    openai = get_openai()
    inserted = 0
    skipped = 0

    for i in tqdm(range(0, len(df), BATCH_SIZE), desc="Embedding & storing"):
        batch = df.iloc[i : i + BATCH_SIZE]
        texts = batch["body_clean"].tolist()

        try:
            embeddings = embed_batch(openai, texts)
        except Exception as e:
            print(f"\n[ERROR] Embedding batch failed at row {i}: {e}")
            continue

        records = []
        for idx, (_, row) in enumerate(batch.iterrows()):
            embedding = embeddings[idx]
            body_text = row["body_clean"]

            records.append({
                "awb": str(row.get("awb", "")),
                "subject": str(row.get("subject", "")),
                "body_clean": body_text[:50000] if body_text else "",
                "sender_email": str(row.get("sender_email", "")),
                "recipient_emails": str(row.get("recipient_emails", "")).split(";") if row.get("recipient_emails") else [],
                "embedding": embedding,
                "extracted_at": str(row.get("received_at", "")),
            })

        try:
            result = supabase.table("emails").upsert(records, ignore_duplicates=False).execute()
            inserted += len(records)
        except Exception as e:
            print(f"\n[ERROR] Supabase insert failed at row {i}: {e}")
            skipped += len(records)

    print(f"\n[OK] Done. Inserted: {inserted}, Skipped: {skipped}")


def main(csv_path: str) -> None:
    if not os.path.exists(csv_path):
        print(f"[ERROR] File not found: {csv_path}")
        sys.exit(1)

    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    print(f"[INFO] Loaded {len(df)} rows from {csv_path}")

    existing = df[df["body_clean"].notna() & (df["body_clean"].str.len() >= 20)]
    print(f"[INFO] {len(existing)} rows have valid body text")

    store_emails(existing)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Embed and store emails in Supabase")
    parser.add_argument("csv", default="cleaned_emails.csv", nargs="?",
                        help="Path to cleaned CSV (default: cleaned_emails.csv)")
    args = parser.parse_args()
    main(args.csv)
