/**
 * Bootstrap an initial administrator for the SBTF system.
 *
 * Creates (or reuses) the Supabase auth user, then links it to a Prisma `users`
 * row with the `admin` role. This exercises the exact app-layer sync path that
 * regular signups will use.
 *
 * Usage:
 *   ADMIN_EMAIL="admin@mabini.gov.ph" ADMIN_PASSWORD="..." npx tsx scripts/create-admin.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = process.env.ADMIN_EMAIL ?? "admin@mabini.gov.ph";
const password = process.env.ADMIN_PASSWORD;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!password) {
    throw new Error("Missing ADMIN_PASSWORD");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let authUserId: string;
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) {
    if (!("message" in created.error) || !/already been registered/i.test(created.error.message)) {
      throw created.error;
    }
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (!match) throw new Error(`Auth user ${email} not found after duplicate-create response`);
    authUserId = match.id;
    console.log(`Reusing existing auth user: ${email}`);
  } else {
    authUserId = created.data.user.id;
    console.log(`Created auth user: ${email}`);
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { authUserId, status: "active" },
    create: { email, authUserId, status: "active" },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: user.id, roleId: adminRole.id },
    },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });

  console.log(
    `Admin ready: ${email} (auth ${authUserId}) role=admin user=${user.id}`
  );
}

main()
  .catch((error) => {
    console.error("create-admin failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });