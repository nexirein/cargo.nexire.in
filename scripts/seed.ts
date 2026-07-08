import { createClient } from "@supabase/supabase-js";

const SEED_PASSWORD = "Password123!";

const SEED_USERS = [
  {
    email: "admin@cargopaf.test",
    fullName: "Ava Admin",
    role: "admin",
    teamName: "Ops HQ",
  },
  {
    email: "lead@cargopaf.test",
    fullName: "Leo Lead",
    role: "lead",
    teamName: "Mumbai Cargo",
  },
  {
    email: "operator@cargopaf.test",
    fullName: "Ola Operator",
    role: "operator",
    teamName: "Mumbai Cargo",
  },
  {
    email: "reviewer@cargopaf.test",
    fullName: "Remy Reviewer",
    role: "reviewer",
    teamName: "Mumbai Cargo",
  },
  {
    email: "viewer@cargopaf.test",
    fullName: "Vera Viewer",
    role: "viewer",
    teamName: "Mumbai Cargo",
  },
] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).",
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const appUserIds: Record<string, string> = {};

  for (const seed of SEED_USERS) {
    let authUserId: string;

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: seed.email,
        password: SEED_PASSWORD,
        email_confirm: true,
      });

    if (created?.user) {
      authUserId = created.user.id;
      console.log(`Created auth user ${seed.email}`);
    } else {
      const { data: list, error: listError } =
        await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users.find((u) => u.email === seed.email);
      if (!existing) {
        throw new Error(
          `Could not create or find auth user ${seed.email}: ${
            createError?.message ?? listError?.message
          }`,
        );
      }
      authUserId = existing.id;
      console.log(`Reusing existing auth user ${seed.email}`);
    }

    const { data: appUser, error: upsertError } = await admin
      .from("app_users")
      .upsert(
        {
          auth_user_id: authUserId,
          email: seed.email,
          full_name: seed.fullName,
          role: seed.role,
          team_name: seed.teamName,
          is_active: true,
        },
        { onConflict: "email" },
      )
      .select("id")
      .single();

    if (upsertError || !appUser) {
      throw new Error(
        `Failed to upsert app_users row for ${seed.email}: ${upsertError?.message}`,
      );
    }

    appUserIds[seed.role] = appUser.id;
  }

  const { data: existingMailbox } = await admin
    .from("mailbox_configs")
    .select("id")
    .eq("operational_mailbox", "cargo-ops@example.com")
    .maybeSingle();

  if (!existingMailbox) {
    const { error: mailboxError } = await admin.from("mailbox_configs").insert({
      owner_user_id: appUserIds.operator,
      display_name: "Mumbai Cargo Ops (seed)",
      operational_mailbox: "cargo-ops@example.com",
      tagged_mailbox: "prealert-replies@example.com",
      signature_html: "Regards,\nMumbai Cargo Operations",
      timezone: "Asia/Kolkata",
      is_active: true,
    });
    if (mailboxError) {
      console.warn("Could not seed mailbox config:", mailboxError.message);
    } else {
      console.log("Seeded mailbox config for operator@cargopaf.test");
    }
  }

  console.log("\nSeed complete. Sign in with any of:");
  for (const seed of SEED_USERS) {
    console.log(`  ${seed.role.padEnd(9)} ${seed.email} / ${SEED_PASSWORD}`);
  }
  console.log(
    "\nNote: only the operator account has a mailbox configured; the other\nseed accounts will be sent through the mandatory /setup/mailbox step.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
