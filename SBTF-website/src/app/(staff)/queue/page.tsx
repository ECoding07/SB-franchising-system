import Link from "next/link";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@sb/shared";

import { requireAnyPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Application Queue" };

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAnyPermission(["applications.review"]);

  const { status } = await searchParams;
  const filter = (APPLICATION_STATUSES as readonly string[]).includes(
    status ?? ""
  )
    ? (status as ApplicationStatus)
    : undefined;

  const [grouped, applications] = await Promise.all([
    prisma.franchiseApplication.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.franchiseApplication.findMany({
      where: filter ? { status: filter } : undefined,
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        operator: true,
        _count: { select: { documents: true, units: true } },
      },
    }),
  ]);

  const counts = new Map(
    grouped.map((row) => [row.status, row._count._all])
  );
  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Application Queue</h1>
        <p className="text-sm text-zinc-500">
          {total} application(s) on file.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip href="/queue" label="All" count={total} active={!filter} />
        {APPLICATION_STATUSES.map((value) => (
          <FilterChip
            key={value}
            href={`/queue?status=${value}`}
            label={APPLICATION_STATUS_LABELS[value]}
            count={counts.get(value) ?? 0}
            active={filter === value}
          />
        ))}
      </div>

      {applications.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          No applications match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Application</th>
                <th className="px-3 py-2 font-medium">Applicant</th>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 font-medium">Docs</th>
                <th className="px-3 py-2 font-medium">Submitted</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/queue/${application.id}`}
                      className="font-medium underline"
                    >
                      {application.applicationNo}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {application.applicationType === "new" ? "New" : "Renewal"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {application.operator.firstName}{" "}
                    {application.operator.lastName}
                    <p className="text-xs text-zinc-500">
                      {application.operator.addressBarangay}
                    </p>
                  </td>
                  <td className="px-3 py-2">{application.appliedRoute}</td>
                  <td className="px-3 py-2">
                    {application._count.documents}/4
                  </td>
                  <td className="px-3 py-2">
                    {application.dateSubmitted
                      ? application.dateSubmitted.toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium">
                      {APPLICATION_STATUS_LABELS[application.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white"
          : "rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
      }
    >
      {label} ({count})
    </Link>
  );
}
