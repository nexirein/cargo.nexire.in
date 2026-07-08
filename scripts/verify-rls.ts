import { createClient } from "@supabase/supabase-js";

const SEED_PASSWORD = "Password123!";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.local).",
    );
  }

  let failures = 0;
  function check(name: string, condition: boolean) {
    console.log(`${condition ? "PASS" : "FAIL"}  ${name}`);
    if (!condition) failures += 1;
  }

  const client = createClient(url, anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({
    email: "operator@cargopaf.test",
    password: SEED_PASSWORD,
  });
  if (signInError) {
    throw new Error(
      `Could not sign in as operator@cargopaf.test — run \`npm run seed\` first. (${signInError.message})`,
    );
  }

  // The highest-blast-radius policy: an active app user must be able to
  // read operational tables at all (a broken app_role()/app_is_active_user()
  // helper would silently lock every user out of everything).
  const { data: rows, error: selectError } = await client
    .from("app_users")
    .select("id")
    .limit(1);
  check(
    "active user can SELECT app_users",
    !selectError && !!rows && rows.length > 0,
  );

  // The other highest-blast-radius policy: mutations must be blocked for
  // ordinary authenticated clients, since every write in this app is
  // supposed to go through a service-role route handler after an app-level
  // role check. If this ever succeeds, RLS has a hole that lets any signed
  // -in user bypass application authorization entirely.
  const { error: insertError } = await client
    .from("awb_cases")
    .insert({ awb: "RLS-TEST-SHOULD-FAIL" });
  check(
    "authenticated (non-service-role) client is blocked from INSERT on awb_cases",
    !!insertError,
  );

  await client.auth.signOut();

  if (failures > 0) {
    console.error(`\n${failures} RLS check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll RLS checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
