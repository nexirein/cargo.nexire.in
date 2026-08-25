import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { TemplatesList } from "./templates-list";

export default async function TemplatesPage() {
  const user = await getCurrentAppUser();
  if (!user || (user.role !== "admin" && user.role !== "lead" && user.role !== "operator")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[oklch(0.45_0.25_280)]">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage email templates used for pre-alert notifications. Use {"{VARIABLE_NAME}"} placeholders for dynamic fields.
          </p>
        </div>
      </div>

      <TemplatesList templates={templates ?? []} isAdmin={user.role === "admin"} />
    </div>
  );
}
