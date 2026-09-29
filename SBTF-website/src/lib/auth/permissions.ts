import type { SessionUser } from "@/lib/auth/session-types";

export type { SessionUser };

export function hasPermission(user: SessionUser, code: string): boolean {
  return user.permissions.includes(code);
}
