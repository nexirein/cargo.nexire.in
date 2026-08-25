"""
Train Classifier — Train and evaluate the ML embedding classifier.

Uses logistic regression on OpenAI embeddings for clearance_type prediction.
Saves model + label encoder for inference in TypeScript shadow mode.

Output: models/classifier_v1.joblib, models/label_encoder_v1.joblib
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from datetime import datetime
from openai import OpenAI
from supabase import create_client, Client
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from tqdm import tqdm

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS = 1536
MODEL_VERSION = "v1.0.0"
MODELS_DIR = "models"
TEST_SIZE = 0.2
RANDOM_STATE = 42


def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Supabase credentials not set")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_openai() -> OpenAI:
    if not OPENAI_API_KEY:
        print("[ERROR] OPENAI_API_KEY not set")
        sys.exit(1)
    return OpenAI(api_key=OPENAI_API_KEY)


def load_training_data_from_csv(csv_path: str) -> pd.DataFrame:
    if not os.path.exists(csv_path):
        print(f"[ERROR] File not found: {csv_path}")
        sys.exit(1)
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    print(f"[INFO] Loaded {len(df)} rows from {csv_path}")
    return df


def load_training_data_from_supabase() -> pd.DataFrame:
    supabase = get_supabase()
    result = supabase.table("training_examples").select("awb, customer_message, issue_type").execute()
    if not result.data:
        print("[WARN] No training data found in Supabase")
        return pd.DataFrame()
    df = pd.DataFrame(result.data)
    print(f"[INFO] Loaded {len(df)} training examples from Supabase")
    return df


def generate_embeddings(openai: OpenAI, texts: list[str], batch_size: int = 20) -> np.ndarray:
    embeddings = []
    for i in tqdm(range(0, len(texts), batch_size), desc="Generating embeddings"):
        batch = texts[i : i + batch_size]
        response = openai.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch,
            dimensions=EMBEDDING_DIMS,
        )
        embeddings.extend([d.embedding for d in response.data])
    return np.array(embeddings)


def main():
    os.makedirs(MODELS_DIR, exist_ok=True)

    df = load_training_data_from_csv("cleaned_emails.csv")

    if "clearance_type" not in df.columns:
        print("[INFO] No clearance_type labels in CSV — using Supabase training_examples")
        df_supabase = load_training_data_from_supabase()
        if not df_supabase.empty:
            df = df_supabase
        else:
            print("[ERROR] No labeled training data available. Provide a CSV with clearance_type column.")
            sys.exit(1)

    label_column = "clearance_type" if "clearance_type" in df.columns else "issue_type"
    text_column = "body_clean" if "body_clean" in df.columns else "customer_message"

    df = df.dropna(subset=[text_column, label_column])
    df = df[df[text_column].str.len() >= 20]

    print(f"[INFO] Training samples: {len(df)}")
    print(f"[INFO] Label distribution:\n{df[label_column].value_counts()}")

    openai = get_openai()
    texts = df[text_column].tolist()
    labels = df[label_column].tolist()

    X = generate_embeddings(openai, texts)
    y = np.array(labels)

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y_encoded
    )

    print(f"\n[INFO] Training set: {len(X_train)} samples")
    print(f"[INFO] Test set: {len(X_test)} samples")
    print(f"[INFO] Classes: {le.classes_.tolist()}")

    clf = LogisticRegression(
        multi_class="multinomial",
        solver="lbfgs",
        max_iter=1000,
        random_state=RANDOM_STATE,
        class_weight="balanced",
    )

    cv_scores = cross_val_score(clf, X_train, y_train, cv=5)
    print(f"\n[INFO] Cross-validation accuracy: {cv_scores.mean():.4f} (±{cv_scores.std():.4f})")

    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)

    accuracy = accuracy_score(y_test, y_pred)
    print(f"\n[RESULTS] Test Accuracy: {accuracy:.4f}")
    print(f"\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_, zero_division=0))

    model_path = os.path.join(MODELS_DIR, f"classifier_{MODEL_VERSION}.joblib")
    encoder_path = os.path.join(MODELS_DIR, f"label_encoder_{MODEL_VERSION}.joblib")

    joblib.dump(clf, model_path)
    joblib.dump(le, encoder_path)
    print(f"\n[OK] Model saved to {model_path}")
    print(f"[OK] Label encoder saved to {encoder_path}")

    report = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.utcnow().isoformat(),
        "accuracy": float(accuracy),
        "cv_mean": float(cv_scores.mean()),
        "cv_std": float(cv_scores.std()),
        "classes": le.classes_.tolist(),
        "n_samples": len(df),
        "n_train": len(X_train),
        "n_test": len(X_test),
    }

    report_path = os.path.join(MODELS_DIR, f"report_{MODEL_VERSION}.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[OK] Training report saved to {report_path}")

    proba_df = pd.DataFrame(y_proba, columns=le.classes_)
    proba_df["predicted"] = le.inverse_transform(y_pred)
    proba_df["actual"] = le.inverse_transform(y_test)
    proba_df.to_csv(os.path.join(MODELS_DIR, f"predictions_{MODEL_VERSION}.csv"), index=False)

    print(f"\n[DONE] Model training complete for {MODEL_VERSION}")


if __name__ == "__main__":
    main()
