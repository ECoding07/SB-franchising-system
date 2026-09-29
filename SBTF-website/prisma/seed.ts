import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  { code: "users.view", description: "View user list" },
  { code: "users.create", description: "Create user accounts" },
  { code: "users.update", description: "Update user profiles" },
  { code: "users.assign_roles", description: "Assign roles to users" },
  { code: "users.suspend", description: "Suspend or activate users" },
  { code: "applications.create", description: "Submit franchise applications (own)" },
  { code: "applications.view_own", description: "View own applications" },
  { code: "applications.review", description: "Review applications" },
  { code: "applications.approve", description: "Approve applications" },
  { code: "applications.reject", description: "Reject applications" },
  { code: "applications.request_requirements", description: "Request additional requirements" },
  { code: "documents.upload", description: "Upload requirements for own application" },
  { code: "documents.verify", description: "Verify uploaded documents" },
  { code: "documents.reject", description: "Reject uploaded documents" },
  { code: "payments.view", description: "View payments" },
  { code: "payments.record", description: "Record offline payment (OR number)" },
  { code: "toda.view", description: "View TODA organizations" },
  { code: "toda.manage", description: "Manage TODA organizations" },
  { code: "franchise.view_all", description: "View all franchise records" },
  { code: "franchise.issue", description: "Issue franchise certificates" },
  { code: "franchise.revoke", description: "Revoke franchises" },
  { code: "franchise.renew", description: "Process renewals" },
  { code: "reports.view", description: "View reports" },
  { code: "reports.export", description: "Export reports" },
  { code: "logs.activity_view", description: "View activity logs" },
  { code: "logs.system_view", description: "View system logs" },
  { code: "settings.manage", description: "Manage system settings" },
  { code: "retention.manage", description: "Manage data retention policies" },
  { code: "analytics.view", description: "View analytics dashboards" },
] as const;

const ROLES = [
  {
    name: "admin",
    description: "System administrator — full access",
    permissions: PERMISSIONS.map((p) => p.code),
  },
  {
    name: "staff",
    description: "Municipal staff — reviews, verification, payments, reports",
    permissions: [
      "users.view",
      "applications.review",
      "applications.approve",
      "applications.reject",
      "applications.request_requirements",
      "documents.verify",
      "documents.reject",
      "payments.view",
      "payments.record",
      "toda.view",
      "franchise.view_all",
      "franchise.issue",
      "franchise.revoke",
      "franchise.renew",
      "reports.view",
      "reports.export",
      "logs.activity_view",
      "logs.system_view",
      "analytics.view",
    ],
  },
  {
    name: "operator",
    description: "Tricycle operator / driver — applies for franchises",
    permissions: [
      "applications.create",
      "applications.view_own",
      "documents.upload",
      "payments.view",
      "toda.view",
      "franchise.view_all",
    ],
  },
];

const DEFAULT_SETTINGS = [
  { key: "franchise_fee", value: 120, description: "Franchise application fee (PHP)" },
  { key: "franchise_validity_years", value: 2, description: "Franchise validity period (years)" },
  { key: "max_units_per_application", value: 2, description: "Max units per single application" },
];

const DEFAULT_RETENTION = [
  { recordType: "franchise_records", retentionDays: 3650, description: "Franchise records (10 years)" },
  { recordType: "franchise_applications", retentionDays: 3650, description: "Applications (10 years)" },
  { recordType: "application_documents", retentionDays: 3650, description: "Application documents (10 years)" },
  { recordType: "payments", retentionDays: 1825, description: "Payment records (5 years)" },
  { recordType: "analytics_summaries", retentionDays: 1825, description: "Analytics summaries (5 years)" },
  { recordType: "activity_logs", retentionDays: 1825, description: "Activity logs (5 years)" },
  { recordType: "system_logs", retentionDays: 180, description: "System logs (180 days)" },
  { recordType: "login_attempts", retentionDays: 90, description: "Login attempts (90 days)" },
  { recordType: "notifications", retentionDays: 180, description: "Notifications (180 days)" },
];

async function main() {
  console.log("Seeding roles and permissions...");
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
  }

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const role of ROLES) {
    const roleRow = await prisma.role.findUniqueOrThrow({ where: { name: role.name } });
    for (const code of role.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: roleRow.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: roleRow.id, permissionId: permission.id },
      });
    }
  }

  console.log("Seeding system settings...");
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: { key: setting.key, value: setting.value },
    });
  }

  console.log("Seeding retention policies...");
  for (const policy of DEFAULT_RETENTION) {
    await prisma.retentionPolicy.upsert({
      where: { recordType: policy.recordType },
      update: { retentionDays: policy.retentionDays, enabled: true },
      create: {
        recordType: policy.recordType,
        retentionDays: policy.retentionDays,
        enabled: true,
      },
    });
  }

  const counts = {
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    rolePermissions: await prisma.rolePermission.count(),
    settings: await prisma.systemSetting.count(),
    retention: await prisma.retentionPolicy.count(),
  };
  console.log("Seed complete:", JSON.stringify(counts));
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });