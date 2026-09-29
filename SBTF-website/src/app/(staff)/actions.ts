"use server";

import { revalidatePath } from "next/cache";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@sb/shared";

import { getRequestMeta } from "@/lib/audit";
import { requireUser } from "@/lib/auth/rbac";
import {
  issueFranchise,
  recordPayment,
  reviewDocument,
  setApplicationStatus,
} from "@/lib/review";

export type StaffFormState = { error?: string; message?: string };

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return (
    typeof value === "string" &&
    (APPLICATION_STATUSES as readonly string[]).includes(value)
  );
}

export async function updateDocumentStatusAction(input: {
  documentId: string;
  status: "pending" | "verified" | "rejected";
  remarks?: string;
}): Promise<{ ok: true } | { error: string }> {
  const actor = await requireUser();
  const result = await reviewDocument(actor, {
    documentId: input.documentId,
    status: input.status,
    remarks: input.remarks,
    requestMeta: await getRequestMeta(),
  });
  if ("error" in result) {
    return result;
  }
  revalidatePath(`/queue/${result.data.applicationId}`);
  return { ok: true };
}

export async function updateApplicationStatusAction(
  _prev: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  const actor = await requireUser();
  const applicationId = String(formData.get("applicationId") ?? "");
  const status = formData.get("status");
  if (!isApplicationStatus(status)) {
    return { error: "Select a valid status." };
  }

  const result = await setApplicationStatus(actor, {
    applicationId,
    status,
    remarks: String(formData.get("remarks") ?? ""),
    requestMeta: await getRequestMeta(),
  });
  if ("error" in result) {
    return result;
  }

  revalidatePath(`/queue/${applicationId}`);
  revalidatePath("/queue");
  return { message: `Status set to ${status.replace(/_/g, " ")}.` };
}

export async function recordPaymentAction(
  _prev: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  const actor = await requireUser();
  const applicationId = String(formData.get("applicationId") ?? "");
  const datePaidRaw = String(formData.get("datePaid") ?? "").trim();

  const result = await recordPayment(actor, {
    applicationId,
    orNo: String(formData.get("orNo") ?? ""),
    amountPaid: Number(String(formData.get("amountPaid") ?? "").trim()),
    datePaid: datePaidRaw ? new Date(datePaidRaw) : new Date(Number.NaN),
    requestMeta: await getRequestMeta(),
  });
  if ("error" in result) {
    return result;
  }

  revalidatePath(`/queue/${applicationId}`);
  return { message: "Payment recorded." };
}

export async function issueFranchiseAction(
  _prev: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  const actor = await requireUser();
  const applicationId = String(formData.get("applicationId") ?? "");
  const certificateNo = String(formData.get("certificateNo") ?? "").trim();
  const validUntilRaw = String(formData.get("validUntil") ?? "").trim();

  const result = await issueFranchise(actor, {
    applicationId,
    certificateNo: certificateNo || undefined,
    validUntil: validUntilRaw ? new Date(validUntilRaw) : undefined,
    requestMeta: await getRequestMeta(),
  });
  if ("error" in result) {
    return result;
  }

  revalidatePath(`/queue/${applicationId}`);
  return { message: `Franchise ${result.data.certificateNo} issued.` };
}
