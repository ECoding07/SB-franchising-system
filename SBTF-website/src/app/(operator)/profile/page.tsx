import { getOperatorProfileForUser } from "@/lib/applications";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

import { ProfileForm } from "./profile-form";

export const metadata = { title: "Operator Profile" };

export default async function ProfilePage() {
  const user = await requireRole(["operator"]);
  const [profile, todas] = await Promise.all([
    getOperatorProfileForUser(user.id),
    prisma.toda.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, municipality: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Operator Profile</h1>
        <p className="text-sm text-zinc-500">
          Complete your details before filing a franchise application.
        </p>
      </div>
      <ProfileForm
        profile={{
          personType: profile?.personType ?? "operator",
          firstName: profile?.firstName ?? "",
          middleName: profile?.middleName ?? "",
          lastName: profile?.lastName ?? "",
          citizenship: profile?.citizenship ?? "filipino",
          addressBarangay: profile?.addressBarangay ?? "",
          addressTownProvince: profile?.addressTownProvince ?? "",
          contactNo: profile?.contactNo ?? "",
          ctcNo: profile?.ctcNo ?? "",
          ctcIssuedAt: profile?.ctcIssuedAt ?? "",
          ctcIssuedOn: profile?.ctcIssuedOn ?? "",
          licenseNo: profile?.licenseNo ?? "",
          todaId: profile?.todaId ?? "",
        }}
        todas={todas}
      />
    </div>
  );
}
