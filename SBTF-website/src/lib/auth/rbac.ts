import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session-types";

export { hasPermission } from "@/lib/auth/permissions";
export type { SessionUser };

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}

/** Require an active session with at least one of the given roles. */
export async function requireRole(
  roles: readonly string[]
): Promise<SessionUser> {
  const user = await requireUser();
  const allowed =
    user.status === "active" && roles.some((role) => user.roles.includes(role));
  if (!allowed) {
    redirect("/");
  }
  return user;
}

/** Require an active session holding at least one of the given permissions. */
export async function requireAnyPermission(
  codes: readonly string[]
): Promise<SessionUser> {
  const user = await requireUser();
  const allowed =
    user.status === "active" && codes.some((code) => user.permissions.includes(code));
  if (!allowed) {
    redirect("/");
  }
  return user;
}