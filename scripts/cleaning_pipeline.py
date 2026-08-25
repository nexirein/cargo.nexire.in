"""
Cleaning Pipeline — VBA-extracted email CSV → clean, structured training data.

Input:  email_extract.csv (from Outlook AWB Extractor VBA script)
Output: cleaned_emails.csv (ready for embedding + storage)

Fields expected from VBA:
  AWB | MessageID | Subject | Sender | To | CC | Received | Folder | Body | ConversationID | Attachments

Output fields:
  awb, subject, body_clean, sender_email, recipient_emails,
  received_at, conversation_id, message_id, folder
"""

import re
import html
import hashlib
import pandas as pd
from pathlib import Path
from typing import Optional


def clean_html(raw: str) -> str:
    if not isinstance(raw, str):
        return ""
    raw = html.unescape(raw)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw


def extract_awb_from_body(body: str, known_awbs: set) -> Optional[str]:
    if not isinstance(body, str):
        return None
    for awb in known_awbs:
        if awb in body:
            return awb
    digits = re.findall(r"\b(\d{12,15})\b", body)
    return digits[0] if digits else None


def is_auto_reply(subject: str, body: str) -> bool:
    combined = (subject or "") + " " + (body or "")
    patterns = [
        "out of office", "automatic reply", "auto-reply",
        "mail delivery failed", "delivery status", "undelivered",
        "failure notice", "returned mail",
    ]
    return any(p in combined.lower() for p in patterns)


def clean_dataset(input_path: str, output_path: str) -> None:
    input_file = Path(input_path)
    if not input_file.exists():
        print(f"[ERROR] Input file not found: {input_path}")
        return

    df = pd.read_csv(input_file, dtype=str, keep_default_na=False)
    print(f"[INFO] Loaded {len(df)} rows from {input_path}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    awb_col = next((c for c in df.columns if "awb" in c), None)
    subject_col = next((c for c in df.columns if "subject" in c), None)
    sender_col = next((c for c in df.columns if "sender" in c or "from" in c), None)
    to_col = next((c for c in df.columns if c == "to" or "recipient" in c), None)
    cc_col = next((c for c in df.columns if c == "cc"), None)
    body_col = next((c for c in df.columns if "body" in c), None)
    received_col = next((c for c in df.columns if "received" in c or "date" in c), None)
    folder_col = next((c for c in df.columns if "folder" in c), None)
    conv_col = next((c for c in df.columns if "conversation" in c or "thread" in c), None)

    known_awbs = set(df[awb_col].dropna().unique()) if awb_col else set()

    records = []
    auto_reply_count = 0
    missing_body = 0
    no_awb_match = 0

    for _, row in df.iterrows():
        subject = str(row.get(subject_col, ""))
        body = str(row.get(body_col, ""))
        sender = str(row.get(sender_col, ""))
        to = str(row.get(to_col, ""))
        cc = str(row.get(cc_col, ""))
        received = str(row.get(received_col, ""))
        folder = str(row.get(folder_col, ""))
        conv_id = str(row.get(conv_col, ""))

        if is_auto_reply(subject, body):
            auto_reply_count += 1
            continue

        body_clean = clean_html(body)
        if len(body_clean.strip()) < 20:
            missing_body += 1
            continue

        awb = str(row.get(awb_col, "")) or extract_awb_from_body(body, known_awbs)
        if not awb:
            no_awb_match += 1

        recipients = []
        if to:
            recipients.extend([e.strip() for e in to.split(";") if e.strip()])
        if cc:
            recipients.extend([e.strip() for e in cc.split(";") if e.strip()])

        records.append({
            "awb": awb or "",
            "subject": subject,
            "body_clean": body_clean,
            "sender_email": sender,
            "recipient_emails": ";".join(recipients),
            "received_at": received,
            "conversation_id": conv_id,
            "body_hash": hashlib.sha256(body_clean.encode()).hexdigest()[:16],
            "folder": folder,
        })

    output = pd.DataFrame(records)
    output.to_csv(output_path, index=False)
    print(f"[OK] Cleaned dataset written to {output_path}: {len(output)} rows")
    print(f"     Auto-replies filtered: {auto_reply_count}")
    print(f"     Missing body filtered: {missing_body}")
    print(f"     No AWB match: {no_awb_match}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Clean VBA-extracted email CSV")
    parser.add_argument("input", default="email_extract.csv", nargs="?",
                        help="Path to VBA-extracted CSV (default: email_extract.csv)")
    parser.add_argument("output", default="cleaned_emails.csv", nargs="?",
                        help="Output path for cleaned CSV (default: cleaned_emails.csv)")
    args = parser.parse_args()
    clean_dataset(args.input, args.output)
