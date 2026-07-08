import { ForbiddenError, canOverrideOwnership } from "@/lib/auth/rbac";
import type { AppUser } from "@/lib/auth/session";

/** Returns whether `user` is the case's owner; throws if they're neither
 * the owner nor allowed to override (admin/lead). */
export function assertOwnerOrOverride(
  caseRow: { owner_user_id: string | null },
  user: AppUser,
): boolean {
  const isOwner = caseRow.owner_user_id === user.id;
  if (!isOwner && !canOverrideOwnership(user.role)) {
    throw new ForbiddenError(
      "Only the case owner, a lead, or an admin can do that.",
    );
  }
  return isOwner;
}
