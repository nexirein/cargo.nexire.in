import { redirect } from "next/navigation";
import { getCurrentAppUser, hasActiveMailboxConfig } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.isActive) {
    redirect(
      `/login?error=${encodeURIComponent(
        "Your account has been deactivated. Contact an admin.",
      )}`,
    );
  }

  const hasMailbox = await hasActiveMailboxConfig(user.id);
  if (!hasMailbox) {
    redirect("/setup/mailbox");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
