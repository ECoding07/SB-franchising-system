import { prisma } from "@/lib/prisma";

export async function getOperatorProfileForUser(userId: string) {
  return prisma.operatorProfile.findUnique({ where: { userId } });
}

export async function getMaxUnitsPerApplication(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "max_units_per_application" },
  });
  return typeof setting?.value === "number" ? setting.value : 2;
}

export async function listOperatorApplications(operatorId: string) {
  return prisma.franchiseApplication.findMany({
    where: { operatorId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      applicationNo: true,
      applicationType: true,
      status: true,
      appliedRoute: true,
      numberOfUnits: true,
      dateSubmitted: true,
      createdAt: true,
      _count: { select: { documents: true, units: true } },
    },
  });
}

export async function nextApplicationNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `APP-${year}-`;
  const last = await prisma.franchiseApplication.findFirst({
    where: { applicationNo: { startsWith: prefix } },
    orderBy: { applicationNo: "desc" },
    select: { applicationNo: true },
  });
  const seq = last
    ? Number.parseInt(last.applicationNo.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(5, "0")}`;
}
