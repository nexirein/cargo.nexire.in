"""
Pattern Analysis — Analyze labeled email data to determine safe auto-send patterns.

Identifies patterns where:
- Historical variance is zero (same reply every time)
- Error rate is zero (no corrections needed)
- Confidence is consistently high

Output: report of auto-send eligible patterns with thresholds.

Input: enriched_emails.csv (from label_with_llm.py)
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from collections import Counter
from datetime import datetime


def analyze_patterns(csv_path: str, output_dir: str = "models"):
    if not os.path.exists(csv_path):
        print(f"[ERROR] File not found: {csv_path}")
        sys.exit(1)

    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    print(f"[INFO] Loaded {len(df)} rows from {csv_path}")

    os.makedirs(output_dir, exist_ok=True)

    patterns = []

    if "actual_reply" not in df.columns:
        df["actual_reply"] = ""

    group_cols = [c for c in ["clearance_type", "intent", "urgency"] if c in df.columns]
    if not group_cols:
        print("[ERROR] No classification columns found. Run label_with_llm.py first.")
        sys.exit(1)

    for group_keys, group in df.groupby(group_cols):
        if isinstance(group_keys, str):
            group_keys = (group_keys,)
        pattern = dict(zip(group_cols, group_keys))
        pattern["count"] = len(group)

        replies = group["actual_reply"].dropna().tolist()
        unique_replies = set(r.strip() for r in replies if r.strip())
        pattern["unique_replies"] = len(unique_replies)
        pattern["zero_variance"] = len(unique_replies) <= 1

        if len(replies) > 0:
            reply_lengths = [len(r) for r in replies]
            pattern["avg_reply_length"] = round(np.mean(reply_lengths), 1)
            pattern["std_reply_length"] = round(np.std(reply_lengths), 1)

        if "confidence" in group.columns:
            confs = pd.to_numeric(group["confidence"], errors="coerce").dropna()
            pattern["avg_confidence"] = round(confs.mean(), 4) if len(confs) > 0 else 0
            pattern["min_confidence"] = round(confs.min(), 4) if len(confs) > 0 else 0
        else:
            pattern["avg_confidence"] = 0
            pattern["min_confidence"] = 0

        pattern["auto_send_eligible"] = (
            pattern.get("zero_variance", False)
            and pattern["count"] >= 30
            and pattern.get("avg_confidence", 0) >= 0.95
        )

        patterns.append(pattern)

    report_df = pd.DataFrame(patterns)
    report_df = report_df.sort_values("count", ascending=False)

    eligible = report_df[report_df["auto_send_eligible"] == True]
    borderline = report_df[
        (report_df["auto_send_eligible"] == False)
        & (report_df["count"] >= 10)
    ]

    total_emails = len(df)
    eligible_emails = eligible["count"].sum() if not eligible.empty else 0

    report = {
        "generated_at": datetime.utcnow().isoformat(),
        "total_patterns": len(patterns),
        "total_emails": total_emails,
        "eligible_patterns": len(eligible),
        "eligible_emails": eligible_emails,
        "eligible_pct": round(eligible_emails / total_emails * 100, 1) if total_emails > 0 else 0,
        "min_samples_required": 30,
        "min_confidence_required": 0.95,
        "auto_send_candidates": [],
        "borderline_patterns": [],
    }

    print("\n" + "=" * 80)
    print("PATTERN ANALYSIS REPORT")
    print("=" * 80)
    print(f"\nTotal patterns: {len(patterns)}")
    print(f"Total emails: {total_emails}")
    print(f"Auto-send eligible patterns: {len(eligible)} ({eligible_emails} emails, {report['eligible_pct']}%)")
    print()

    if not eligible.empty:
        print("-" * 80)
        print("AUTO-SEND ELIGIBLE PATTERNS (zero variance, ≥30 samples, ≥0.95 confidence)")
        print("-" * 80)
        for _, row in eligible.iterrows():
            pattern_desc = " | ".join(f"{k}={v}" for k, v in row.items()
                                      if k in group_cols)
            print(f"  ✓ {pattern_desc}")
            print(f"    Count: {row['count']}, Confidence: {row['avg_confidence']:.4f}")
            print()
            report["auto_send_candidates"].append({
                k: v for k, v in row.items() if k in group_cols or k in
                ["count", "avg_confidence", "zero_variance"]
            })

    if not borderline.empty:
        print("-" * 80)
        print("BORDERLINE PATTERNS (≥10 samples, NOT yet eligible)")
        print("-" * 80)
        for _, row in borderline.iterrows():
            pattern_desc = " | ".join(f"{k}={v}" for k, v in row.items()
                                      if k in group_cols)
            reasons = []
            if row["count"] < 30:
                reasons.append(f"only {row['count']}/30 samples")
            if not row.get("zero_variance", False):
                reasons.append(f"{row['unique_replies']} unique replies (not zero-variance)")
            if row.get("avg_confidence", 0) < 0.95:
                reasons.append(f"confidence {row['avg_confidence']:.4f} < 0.95")
            print(f"  ~ {pattern_desc}")
            print(f"    {' | '.join(reasons)}")
            print()
            report["borderline_patterns"].append({
                k: v for k, v in row.items() if k in group_cols or k in
                ["count", "unique_replies", "avg_confidence", "zero_variance"]
            })

    report_path = os.path.join(output_dir, "pattern_analysis_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n[OK] Full report saved to {report_path}")

    csv_path_out = os.path.join(output_dir, "pattern_analysis.csv")
    report_df.to_csv(csv_path_out, index=False)
    print(f"[OK] CSV report saved to {csv_path_out}")

    eligible_list = report["auto_send_candidates"]
    if eligible_list:
        config_path = os.path.join(output_dir, "auto_send_patterns.json")
        with open(config_path, "w") as f:
            json.dump(eligible_list, f, indent=2)
        print(f"[OK] Auto-send config saved to {config_path}")
        print(f"\n[ACTION] To enable auto-send, run:\n"
              f"  python scripts/configure_auto_send.py --enable\n")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Analyze email patterns for auto-send safety")
    parser.add_argument("csv", default="enriched_emails.csv", nargs="?",
                        help="Enriched CSV (default: enriched_emails.csv)")
    parser.add_argument("--output-dir", default="models",
                        help="Output directory (default: models)")
    args = parser.parse_args()
    analyze_patterns(args.csv, args.output_dir)
