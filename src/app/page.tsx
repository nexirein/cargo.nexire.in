import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";

export default async function RootPage() {
  const user = await getCurrentAppUser();
  redirect(user ? "/dashboard" : "/login");
}
