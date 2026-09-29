import { prisma } from "@/lib/prisma";

type AuthUserLike = {
  id: string;
  email?: string;
};

/**
 * App-layer sync between Supabase `auth.users` and Prisma `users`.
 *
 * Upserts the Prisma user by email, links the Supabase auth id, and assigns the
 * default `operator` role when the account has no roles yet.
 */
export async function syncUserFromAuth(authUser: AuthUserLike) {
  if (!authUser.email) {
    return null;
  }

  const user = await prisma.user.upsert({
    where: { email: authUser.email },
    update: { authUserId: authUser.id, status: "active" },
    create: {
      email: authUser.email,
      authUserId: authUser.id,
      status: "active",
    },
  });

  const roleCount = await prisma.userRole.count({ where: { userId: user.id } });
  if (roleCount === 0) {
    const operatorRole = await prisma.role.findUnique({
      where: { name: "operator" },
    });
    if (operatorRole) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: operatorRole.id },
      });
    }
  }

  return user;
}