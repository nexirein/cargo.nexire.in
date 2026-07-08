"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(`/reset-password?error=${encodeURIComponent("Enter your email.")}`);
  }

  const supabase = await createClient();
  const origin = process.env.APP_BASE_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password/confirm")}`,
  });

  // Always show the same confirmation, whether or not the email exists,
  // so this can't be used to enumerate registered accounts.
  redirect("/reset-password?sent=1");
}
