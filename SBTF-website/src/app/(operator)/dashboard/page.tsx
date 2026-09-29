import Link from "next/link";
import { APPLICATION_STATUS_LABELS } from "@sb/shared";

import {
  getOperatorProfileForUser,
  listOperatorApplications,
} from "@/lib/applications";
import { requireRole } from "@/lib/auth/rbac";

export const metadata = { title: "Dashboard" };

export default async function OperatorDashboard() {
  const user = await requireRole(["operator"]);
  const profile = await getOperatorProfileForUser(user.id);
  const applications = profile
    ? await listOperatorApplications(profile.id)
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Operator Dashboard</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <Link
          href="/applications/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          New application
        </Link>
      </div>

      {!profile ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          Your operator profile is incomplete.{" "}
          <Link href="/profile" className="font-medium underline">
            Complete your profile
          </Link>{" "}
          before filing an application.
        </div>
      ) : null}

      {applications.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          No applications yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
          {applications.map((application) => (
            <li
              key={application.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <Link
                  href={`/applications/${application.id}`}
                  className="text-sm font-medium underline"
                >
                  {application.applicationNo}
                </Link>
                <p className="text-xs text-zinc-500">
                  {application.appliedRoute} ·{" "}
                  {application.applicationType === "new" ? "New" : "Renewal"} ·{" "}
                  {application._count.units} unit(s) ·{" "}
                  {application._count.documents}/4 documents
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium">
                {APPLICATION_STATUS_LABELS[application.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
