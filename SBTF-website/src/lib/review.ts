import type { ApplicationStatus, DocumentStatus } from "@sb/shared";

import { logActivity, notifyUser } from "@/lib/audit";
import { hasPermission, type SessionUser } from "@/lib/auth/permissions";
import { APPLICATION_STATUS_PERMISSION } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getFranchiseValidityYears } from "@/lib/settings";

export type ReviewResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { error: string };

export type RequestMeta = { ipAddress?: string; userAgent?: string };

function actorBlocked(actor: SessionUser) {
  return actor.status === "active" ? null : "Your account is not active.";
}

export async function reviewDocument(
  actor: SessionUser,
  input: {
    documentId: string;
    status: DocumentStatus;
    remarks?: string;
    requestMeta?: RequestMeta;
  }
): Promise<ReviewResult<{ applicationId: string }>> {
  const blocked = actorBlocked(actor);
  if (blocked) return { error: blocked };

  const permission =
    input.status === "rejected" ? "documents.reject" : "documents.verify";
  if (!hasPermission(actor, permission)) {
    return { error: "You are not allowed to review documents." };
  }

  const document = await prisma.applicationDocument.findUnique({
    where: { id: input.documentId },
    include: { application: { include: { operator: true } } },
  });
  if (!document) {
    return { error: "Document not found." };
  }

  await prisma.applicationDocument.update({
    where: { id: document.id },
    data: {
      status: input.status,
      remarks: input.remarks?.trim() ? input.remarks.trim() : null,
      verifiedBy: actor.id,
      verifiedAt: new Date(),
    },
  });

  await logActivity({
    user: actor,
    module: "document",
    action: `document.${input.status}`,
    targetType: "ApplicationDocument",
    targetId: document.id,
    metadata: {
      applicationNo: document.application.applicationNo,
      documentType: document.documentType,
    },
    requestMeta: input.requestMeta,
  });

  if (input.status !== "verified") {
    await notifyUser({
      userId: document.application.operator.userId,
      title: "Document needs attention",
      message: `${document.application.applicationNo}: your ${document.documentType.replace(/_/g, " ")} was returned.`,
      type: "document_rejected",
      link: `/applications/${document.applicationId}`,
    });
  }

  return { ok: true, data: { applicationId: document.applicationId } };
}

export async function setApplicationStatus(
  actor: SessionUser,
  input: {
    applicationId: string;
    status: ApplicationStatus;
    remarks?: string;
    requestMeta?: RequestMeta;
  }
): Promise<ReviewResult<{ applicationNo: string }>> {
  const blocked = actorBlocked(actor);
  if (blocked) return { error: blocked };

  const permission = APPLICATION_STATUS_PERMISSION[input.status];
  if (!permission || !hasPermission(actor, permission)) {
    return { error: "You are not allowed to set that status." };
  }

  const application = await prisma.franchiseApplication.findUnique({
    where: { id: input.applicationId },
    include: { documents: true, operator: true },
  });
  if (!application) {
    return { error: "Application not found." };
  }
  if (application.status === input.status) {
    return { error: "The application is already in that status." };
  }

  if (input.status === "approved") {
    if (application.documents.length === 0) {
      return { error: "No documents uploaded yet — cannot approve." };
    }
    const unverified = application.documents.filter(
      (doc) => doc.status !== "verified"
    );
    if (unverified.length > 0) {
      return {
        error: `${unverified.length} document(s) still pending or rejected.`,
      };
    }
  }

  await prisma.$transaction([
    prisma.franchiseApplication.update({
      where: { id: input.applicationId },
      data: {
        status: input.status,
        dateApproved:
          input.status === "approved" ? new Date() : application.dateApproved,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
      },
    }),
    prisma.applicationStatusHistory.create({
      data: {
        applicationId: input.applicationId,
        status: input.status,
        changedBy: actor.id,
        remarks: input.remarks?.trim() ? input.remarks.trim() : null,
      },
    }),
  ]);

  await logActivity({
    user: actor,
    module: "application",
    action: `application.${input.status}`,
    targetType: "FranchiseApplication",
    targetId: input.applicationId,
    metadata: {
      applicationNo: application.applicationNo,
      from: application.status,
    },
    requestMeta: input.requestMeta,
  });

  await notifyUser({
    userId: application.operator.userId,
    title: `Application ${application.applicationNo}`,
    message: `Status updated to ${input.status.replace(/_/g, " ")}.`,
    type: "application_status",
    link: `/applications/${input.applicationId}`,
  });

  return { ok: true, data: { applicationNo: application.applicationNo } };
}

export async function recordPayment(
  actor: SessionUser,
  input: {
    applicationId: string;
    orNo: string;
    amountPaid: number;
    datePaid: Date;
    requestMeta?: RequestMeta;
  }
): Promise<ReviewResult<{ applicationNo: string }>> {
  const blocked = actorBlocked(actor);
  if (blocked) return { error: blocked };
  if (!hasPermission(actor, "payments.record")) {
    return { error: "You are not allowed to record payments." };
  }
  if (!input.orNo.trim()) {
    return { error: "OR number is required." };
  }
  if (!Number.isFinite(input.amountPaid) || input.amountPaid <= 0) {
    return { error: "Enter a valid amount." };
  }
  if (Number.isNaN(input.datePaid.getTime())) {
    return { error: "Enter a valid date." };
  }

  const application = await prisma.franchiseApplication.findUnique({
    where: { id: input.applicationId },
    include: { operator: true },
  });
  if (!application) {
    return { error: "Application not found." };
  }

  try {
    await prisma.payment.create({
      data: {
        applicationId: input.applicationId,
        orNo: input.orNo.trim(),
        amountPaid: input.amountPaid,
        datePaid: input.datePaid,
        recordedBy: actor.id,
      },
    });
  } catch {
    return { error: "That OR number is already recorded." };
  }

  await logActivity({
    user: actor,
    module: "payment",
    action: "payment.record",
    targetType: "Payment",
    targetId: input.applicationId,
    metadata: {
      applicationNo: application.applicationNo,
      orNo: input.orNo.trim(),
      amountPaid: input.amountPaid,
    },
    requestMeta: input.requestMeta,
  });

  await notifyUser({
    userId: application.operator.userId,
    title: "Payment recorded",
    message: `Payment for ${application.applicationNo} (OR ${input.orNo.trim()}) was recorded.`,
    type: "payment",
    link: `/applications/${input.applicationId}`,
  });

  return { ok: true, data: { applicationNo: application.applicationNo } };
}

async function nextFranchiseCertificateNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FR-${year}-`;
  const last = await prisma.franchiseRecord.findFirst({
    where: { franchiseCertificateNo: { startsWith: prefix } },
    orderBy: { franchiseCertificateNo: "desc" },
    select: { franchiseCertificateNo: true },
  });
  const seq = last
    ? Number.parseInt(last.franchiseCertificateNo.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function issueFranchise(
  actor: SessionUser,
  input: {
    applicationId: string;
    certificateNo?: string;
    validUntil?: Date;
    requestMeta?: RequestMeta;
  }
): Promise<ReviewResult<{ certificateNo: string; validUntil: string }>> {
  const blocked = actorBlocked(actor);
  if (blocked) return { error: blocked };
  if (!hasPermission(actor, "franchise.issue")) {
    return { error: "You are not allowed to issue franchises." };
  }

  const application = await prisma.franchiseApplication.findUnique({
    where: { id: input.applicationId },
    include: { operator: true, payments: true, franchiseRecord: true },
  });
  if (!application) {
    return { error: "Application not found." };
  }
  if (application.status !== "approved") {
    return { error: "Only approved applications can be issued a franchise." };
  }
  if (application.payments.length === 0) {
    return { error: "Record the franchise fee payment before issuing." };
  }
  if (application.franchiseRecord) {
    return { error: "A franchise record already exists for this application." };
  }

  const dateIssued = new Date();
  const validityYears = await getFranchiseValidityYears();
  const validUntil =
    input.validUntil ??
    new Date(dateIssued.getFullYear() + validityYears, dateIssued.getMonth(), dateIssued.getDate());
  if (Number.isNaN(validUntil.getTime())) {
    return { error: "Enter a valid expiry date." };
  }

  const certificateNo = input.certificateNo?.trim() || (await nextFranchiseCertificateNo());

  try {
    await prisma.$transaction([
      prisma.franchiseRecord.create({
        data: {
          applicationId: input.applicationId,
          operatorId: application.operatorId,
          franchiseCertificateNo: certificateNo,
          dateIssued,
          validUntil,
          route: application.appliedRoute,
          issuedBy: actor.id,
        },
      }),
      prisma.franchiseApplication.update({
        where: { id: input.applicationId },
        data: { validUntil },
      }),
    ]);
  } catch {
    return { error: "Could not issue the franchise. Check the certificate number." };
  }

  await logActivity({
    user: actor,
    module: "franchise",
    action: "franchise.issue",
    targetType: "FranchiseRecord",
    targetId: input.applicationId,
    metadata: {
      applicationNo: application.applicationNo,
      certificateNo,
      validUntil: validUntil.toISOString(),
    },
    requestMeta: input.requestMeta,
  });

  await notifyUser({
    userId: application.operator.userId,
    title: "Franchise issued",
    message: `Franchise ${certificateNo} was issued for ${application.applicationNo}.`,
    type: "franchise",
    link: `/applications/${input.applicationId}`,
  });

  return {
    ok: true,
    data: { certificateNo, validUntil: validUntil.toISOString() },
  };
}
