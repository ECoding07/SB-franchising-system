import { redirect } from "next/navigation";

import {
  getMaxUnitsPerApplication,
  getOperatorProfileForUser,
} from "@/lib/applications";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

import { NewApplicationForm } from "./new-application-form";

export const metadata = { title: "New Application" };

export default async function NewApplicationPage() {
  const user = await requireRole(["operator"]);
  const profile = await getOperatorProfileForUser(user.id);
  if (!profile) {
    redirect("/profile");
  }

  const [todas, maxUnits] = await Promise.all([
    prisma.toda.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, municipality: true },
    }),
    getMaxUnitsPerApplication(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Franchise Application</h1>
        <p className="text-sm text-zinc-500">
          Provide the application details and vehicle unit(s).
        </p>
      </div>
      <NewApplicationForm
        defaultTodaId={profile.todaId ?? ""}
        maxUnits={maxUnits}
        todas={todas}
      />
    </div>
  );
}
