import { prisma } from "@/lib/prisma";

async function getNumberSetting(key: string, fallback: number) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return typeof setting?.value === "number" ? setting.value : fallback;
}

export async function getFranchiseFee(): Promise<number> {
  return getNumberSetting("franchise_fee", 120);
}

export async function getFranchiseValidityYears(): Promise<number> {
  return getNumberSetting("franchise_validity_years", 2);
}
