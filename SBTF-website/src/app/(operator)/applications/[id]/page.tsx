import Link from "next/link";
import { notFound } from "next/navigation";
import {
  APPLICATION_STATUS_LABELS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  OWNERSHIP_TYPE_LABELS,
} from "@sb/shared";

import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { createDocumentDownloadUrl } from "@/lib/storage";

import { DocumentUploader } from "./document-uploader";

export const metadata = { title: "Application" };

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(["operator"]);
  const { id } = await params;

  const application = await prisma.franchiseApplication.findFirst({
    where: { id, operator: { userId: user.id } },
    include: {
      units: { orderBy: { make: "asc" } },
      documents: true,
      toda: { select: { name: true, municipality: true } },
    },
  });
  if (!application) {
    notFound();
  }

  const documentsByType = new Map(
    application.documents.map((doc) => [doc.documentType, doc])
  );
  const documentRows = await Promise.all(
    DOCUMENT_TYPES.map(async (type) => {
      const doc = documentsByType.get(type) ?? null;
      const url = doc ? await createDocumentDownloadUrl(doc.filePath) : null;
      return { type, doc, url };
    })
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{application.applicationNo}</h1>
          <p className="text-sm text-zinc-500">
            {application.applicationType === "new"
              ? "New franchise"
              : "Renewal"}{" "}
            · submitted{" "}
            {application.dateSubmitted
              ? application.dateSubmitted.toLocaleDateString()
              : "—"}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium">
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Detail label="Applied route" value={application.appliedRoute} />
        <Detail label="Registered owner" value={application.registeredOwner} />
        <Detail
          label="Ownership type"
          value={OWNERSHIP_TYPE_LABELS[application.ownershipType]}
        />
        <Detail
          label="TODA"
          value={
            application.toda
              ? `${application.toda.name} (${application.toda.municipality})`
              : "—"
          }
        />
        <Detail
          label="Community tax cert."
          value={application.comTaxCertNo ?? "—"}
        />
        <Detail label="Units" value={String(application.numberOfUnits)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vehicle units</h2>
        <div className="overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Make / Model</th>
                <th className="px-3 py-2 font-medium">Motor no.</th>
                <th className="px-3 py-2 font-medium">Chassis no.</th>
                <th className="px-3 py-2 font-medium">Plate no.</th>
              </tr>
            </thead>
            <tbody>
              {application.units.map((unit) => (
                <tr key={unit.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2">
                    {unit.make} {unit.model}
                  </td>
                  <td className="px-3 py-2">{unit.motorNo}</td>
                  <td className="px-3 py-2">{unit.chassisNo}</td>
                  <td className="px-3 py-2">{unit.plateNo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Requirements</h2>
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
          {documentRows.map(({ type, doc, url }) => (
            <li
              key={type}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {DOCUMENT_TYPE_LABELS[type]}
                </p>
                {doc ? (
                  <p className="text-xs text-zinc-500">
                    {doc.fileName} ·{" "}
                    {DOCUMENT_STATUS_LABELS[doc.status]}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400">Not uploaded</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-zinc-700 underline"
                  >
                    View
                  </a>
                ) : null}
                <DocumentUploader
                  applicationId={application.id}
                  documentType={type}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/dashboard" className="text-sm text-zinc-500 underline">
        Back to dashboard
      </Link>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
