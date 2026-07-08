import type { AppRole, AppUser } from "./session";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  lead: "Team Lead",
  operator: "Operator",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// Throws if the user is missing, inactive, or lacks one of the allowed
// roles. Used at the top of every mutating route handler as the actual
// security boundary (RLS only guards SELECT for direct browser reads).
export function requireRole(
  user: AppUser | null,
  ...allowed: AppRole[]
): AppUser {
  if (!user || !user.isActive) {
    throw new ForbiddenError("Not authenticated.");
  }
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError(
      `Requires role: ${allowed.map((r) => ROLE_LABELS[r]).join(", ")}.`,
    );
  }
  return user;
}

export function canManageCases(role: AppRole): boolean {
  return role === "admin" || role === "lead" || role === "operator";
}

export function canOverrideOwnership(role: AppRole): boolean {
  return role === "admin" || role === "lead";
}

export function canApproveDrafts(role: AppRole): boolean {
  return role === "admin" || role === "lead" || role === "reviewer";
}
