import { NextResponse } from "next/server";
import { ForbiddenError } from "@/lib/auth/rbac";

export function handleRouteError(error: unknown) {
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
