import Link from "next/link";
import { notFound } from "next/navigation";
import {
  APPLICATION_STATUS_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  OWNERSHIP_TYPE_LABELS,
  PERSON_TYPE_LABELS,
} from "@sb/shared";

import { requireAnyPermission } from "@/lib/auth/rbac";
import { allowedStatusTransitions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getFranchiseFee } from "@/lib/settings";
import { createDocumentDownloadUrl } from "@/lib/storage";

import {
  DocumentReviewActions,
  FranchiseForm,
  PaymentForm,
  StatusForm,
} from "./review-forms";

export const metadata = { title: "Review Application" };

export default async function ReviewApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAnyPermission(["applications.review"]);
  const { id } = await params;

  const [application, franchiseFee] = await Promise.all([
    prisma.franchiseApplication.findUnique({
      where: { id },
      include: {
        operator: true,
        toda: { select: { name: true, municipality: true } },
        units: { orderBy: { make: "asc" } },
        documents: true,
        payments: { orderBy: { datePaid: "desc" } },
        franchiseRecord: true,
        statusHistory: { orderBy: { changedAt: "desc" } },
      },
    }),
    getFranchiseFee(),
  ]);
  if (!application) {
    notFound();
  }

  const documentRows = await Promise.all(
    application.documents.map(async (doc) => ({
      doc,
      url: await createDocumentDownloadUrl(doc.filePath),
    }))
  );
  const allowedStatuses = allowedStatusTransitions(user.permissions);
  const canRecordPayment = user.permissions.includes("payments.record");
  const canIssue = user.permissions.includes("franchise.issue");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {application.applicationNo}
          </h1>
          <p className="text-sm text-zinc-500">
            {application.applicationType === "new" ? "New franchise" : "Renewal"}{" "}
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

      <section className="grid gap-4 sm:grid-cols-3">
        <Detail
          label="Applicant"
          value={`${application.operator.firstName} ${application.operator.middleName ?? ""} ${application.operator.lastName}`.trim()}
        />
        <Detail
          label="Type"
          value={PERSON_TYPE_LABELS[application.operator.personType]}
        />
        <Detail label="Contact" value={application.operator.contactNo} />
        <Detail
          label="Address"
          value={`${application.operator.addressBarangay}, ${application.operator.addressTownProvince}`}
        />
        <Detail label="Route" value={application.appliedRoute} />
        <Detail
          label="Ownership"
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
          label="Registered owner"
          value={application.registeredOwner}
        />
        <Detail label="Community tax cert." value={application.comTaxCertNo ?? "—"} />
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
        <h2 className="text-lg font-semibold">Documents</h2>
        {documentRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            No documents uploaded.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {documentRows.map(({ doc, url }) => (
              <li key={doc.id} className="space-y-3 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {DOCUMENT_TYPE_LABELS[doc.documentType]}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {doc.fileName} ·{" "}
                      {DOCUMENT_STATUS_LABELS[doc.status]}
                      {doc.remarks ? ` · ${doc.remarks}` : ""}
                    </p>
                  </div>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-zinc-700 underline"
                    >
                      View file
                    </a>
                  ) : null}
                </div>
                <DocumentReviewActions
                  documentId={doc.id}
                  documentType={doc.documentType}
                  status={doc.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Status</h2>
        <StatusForm
          applicationId={application.id}
          currentStatus={application.status}
          allowedStatuses={allowedStatuses}
        />
        <ul className="space-y-1 text-xs text-zinc-500">
          {application.statusHistory.map((entry) => (
            <li key={entry.id}>
              {entry.changedAt.toLocaleString()} — {entry.status}
              {entry.remarks ? ` (${entry.remarks})` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Payments</h2>
        {application.payments.length === 0 ? (
          <p className="text-sm text-zinc-500">No payments recorded.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 text-sm">
            {application.payments.map((payment) => (
              <li key={payment.id} className="px-4 py-2">
                OR {payment.orNo} — PHP {Number(payment.amountPaid).toFixed(2)} —{" "}
                {payment.datePaid.toLocaleDateString()}
              </li>
            ))}
          </ul>
        )}
        {canRecordPayment ? (
          <PaymentForm
            applicationId={application.id}
            defaultAmount={franchiseFee}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Franchise</h2>
        {application.franchiseRecord ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
            <p className="font-medium">
              {application.franchiseRecord.franchiseCertificateNo}
            </p>
            <p className="text-xs text-emerald-800">
              Issued{" "}
              {application.franchiseRecord.dateIssued.toLocaleDateString()} · valid
              until {application.franchiseRecord.validUntil.toLocaleDateString()} ·{" "}
              {application.franchiseRecord.status}
            </p>
          </div>
        ) : canIssue && application.status === "approved" ? (
          <FranchiseForm applicationId={application.id} />
        ) : (
          <p className="text-sm text-zinc-500">
            {application.status === "approved"
              ? "You are not allowed to issue franchises."
              : "Approve the application and record payment first."}
          </p>
        )}
      </section>

      <Link href="/queue" className="text-sm text-zinc-500 underline">
        Back to queue
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
