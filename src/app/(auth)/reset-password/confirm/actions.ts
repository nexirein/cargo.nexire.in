"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    redirect(
      `/reset-password/confirm?error=${encodeURIComponent(
        "Password must be at least 8 characters.",
      )}`,
    );
  }
  if (password !== confirmPassword) {
    redirect(
      `/reset-password/confirm?error=${encodeURIComponent(
        "Passwords do not match.",
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(
      `/reset-password/confirm?error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect("/dashboard");
}
