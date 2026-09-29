import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/session-types";

export type { SessionUser };

/** Resolve the current authenticated user with their roles and permissions. */
export const getCurrentUser = cache(
  async (): Promise<SessionUser | null> => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    if (error || !authUser) {
      return null;
    }

    const dbUser = await prisma.user.findUnique({
      where: { authUserId: authUser.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!dbUser) {
      return null;
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      authUserId: dbUser.authUserId ?? authUser.id,
      status: dbUser.status,
      roles: dbUser.userRoles.map((ur) => ur.role.name),
      permissions: [
        ...new Set(
          dbUser.userRoles.flatMap((ur) =>
            ur.role.permissions.map((rp) => rp.permission.code)
          )
        ),
      ],
    };
  }
);