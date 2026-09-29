"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  applicationSchema,
  documentTypeSchema,
  operatorProfileSchema,
} from "@sb/shared";

import { getMaxUnitsPerApplication, nextApplicationNo } from "@/lib/applications";
import { requireRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import {
  buildDocumentPath,
  createDocumentUploadUrl,
  removeDocumentObject,
} from "@/lib/storage";

export type FormState = { error?: string; message?: string };

function emptyToNull(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function assertOwnership(userId: string, applicationId: string) {
  return prisma.franchiseApplication.findFirst({
    where: { id: applicationId, operator: { userId } },
    select: { id: true, operatorId: true },
  });
}

export async function saveOperatorProfileAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireRole(["operator"]);

  const parsed = operatorProfileSchema.safeParse({
    personType: formData.get("personType"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName"),
    lastName: formData.get("lastName"),
    citizenship: formData.get("citizenship") || "filipino",
    addressBarangay: formData.get("addressBarangay"),
    addressTownProvince: formData.get("addressTownProvince"),
    contactNo: formData.get("contactNo"),
    ctcNo: formData.get("ctcNo"),
    ctcIssuedAt: formData.get("ctcIssuedAt"),
    ctcIssuedOn: formData.get("ctcIssuedOn"),
    licenseNo: formData.get("licenseNo"),
    todaId: formData.get("todaId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const fields = {
    personType: data.personType,
    firstName: data.firstName,
    middleName: emptyToNull(data.middleName),
    lastName: data.lastName,
    citizenship: data.citizenship,
    addressBarangay: data.addressBarangay,
    addressTownProvince: data.addressTownProvince,
    contactNo: data.contactNo,
    ctcNo: emptyToNull(data.ctcNo),
    ctcIssuedAt: emptyToNull(data.ctcIssuedAt),
    ctcIssuedOn: emptyToNull(data.ctcIssuedOn),
    licenseNo: emptyToNull(data.licenseNo),
    todaId: emptyToNull(data.todaId),
  };

  await prisma.operatorProfile.upsert({
    where: { userId: user.id },
    update: fields,
    create: { userId: user.id, ...fields },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { message: "Profile saved." };
}

export async function submitApplicationAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireRole(["operator"]);

  const profile = await prisma.operatorProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    return { error: "Please complete your operator profile first." };
  }

  let unitsRaw: unknown = [];
  try {
    unitsRaw = JSON.parse(String(formData.get("units") ?? "[]"));
  } catch {
    return { error: "Invalid vehicle unit data." };
  }

  const parsed = applicationSchema.safeParse({
    applicationType: formData.get("applicationType"),
    todaId: formData.get("todaId"),
    appliedRoute: formData.get("appliedRoute"),
    registeredOwner: formData.get("registeredOwner"),
    ownershipType: formData.get("ownershipType"),
    comTaxCertNo: formData.get("comTaxCertNo"),
    comTaxIssuedAt: formData.get("comTaxIssuedAt"),
    comTaxIssuedOn: formData.get("comTaxIssuedOn"),
    units: unitsRaw,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const maxUnits = await getMaxUnitsPerApplication();
  if (input.units.length > maxUnits) {
    return { error: `A maximum of ${maxUnits} unit(s) per application.` };
  }

  let applicationId: string | null = null;
  for (let attempt = 0; attempt < 3 && !applicationId; attempt += 1) {
    try {
      const applicationNo = await nextApplicationNo();
      const created = await prisma.franchiseApplication.create({
        data: {
          applicationNo,
          operatorId: profile.id,
          todaId: emptyToNull(input.todaId) ?? profile.todaId,
          applicationType: input.applicationType,
          status: "pending",
          appliedRoute: input.appliedRoute,
          numberOfUnits: input.units.length,
          registeredOwner: input.registeredOwner,
          ownershipType: input.ownershipType,
          comTaxCertNo: emptyToNull(input.comTaxCertNo),
          comTaxIssuedAt: emptyToNull(input.comTaxIssuedAt),
          comTaxIssuedOn: emptyToNull(input.comTaxIssuedOn),
          dateSubmitted: new Date(),
          units: {
            create: input.units.map((unit) => ({
              make: unit.make,
              model: unit.model,
              motorNo: unit.motorNo,
              engineNo: emptyToNull(unit.engineNo),
              chassisNo: unit.chassisNo,
              plateNo: unit.plateNo,
              certificateOfRegistrationNo: emptyToNull(
                unit.certificateOfRegistrationNo
              ),
            })),
          },
          statusHistory: {
            create: { status: "pending", remarks: "Submitted by operator" },
          },
        },
        select: { id: true },
      });
      applicationId = created.id;
    } catch {
      if (attempt === 2) {
        return { error: "Could not submit the application. Please try again." };
      }
    }
  }

  revalidatePath("/dashboard");
  redirect(`/applications/${applicationId}`);
}

export async function requestDocumentUploadAction(input: {
  applicationId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<{ path: string; token: string } | { error: string }> {
  const user = await requireRole(["operator"]);
  const application = await assertOwnership(user.id, input.applicationId);
  if (!application) {
    return { error: "Application not found." };
  }
  const type = documentTypeSchema.safeParse(input.documentType);
  if (!type.success) {
    return { error: "Invalid document type." };
  }
  if (
    !(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(input.mimeType)
  ) {
    return { error: "Only PDF, JPG, or PNG files are allowed." };
  }
  if (input.fileSize <= 0 || input.fileSize > MAX_DOCUMENT_BYTES) {
    return { error: "File must be 10 MB or smaller." };
  }

  const path = buildDocumentPath(
    application.operatorId,
    input.applicationId,
    type.data,
    input.fileName
  );
  try {
    const { token } = await createDocumentUploadUrl(path);
    return { path, token };
  } catch {
    return { error: "Could not prepare the upload. Please try again." };
  }
}

export async function registerDocumentAction(input: {
  applicationId: string;
  documentType: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<{ ok: true } | { error: string }> {
  const user = await requireRole(["operator"]);
  const application = await assertOwnership(user.id, input.applicationId);
  if (!application) {
    return { error: "Application not found." };
  }
  const type = documentTypeSchema.safeParse(input.documentType);
  if (!type.success) {
    return { error: "Invalid document type." };
  }
  const expectedPrefix = `${application.operatorId}/${input.applicationId}/`;
  if (!input.path.startsWith(expectedPrefix)) {
    return { error: "Invalid file path." };
  }

  const existing = await prisma.applicationDocument.findUnique({
    where: {
      applicationId_documentType: {
        applicationId: input.applicationId,
        documentType: type.data,
      },
    },
  });

  await prisma.applicationDocument.upsert({
    where: {
      applicationId_documentType: {
        applicationId: input.applicationId,
        documentType: type.data,
      },
    },
    update: {
      filePath: input.path,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      status: "pending",
      remarks: null,
      verifiedBy: null,
      verifiedAt: null,
    },
    create: {
      applicationId: input.applicationId,
      documentType: type.data,
      filePath: input.path,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
    },
  });

  if (existing && existing.filePath !== input.path) {
    await removeDocumentObject(existing.filePath);
  }

  revalidatePath(`/applications/${input.applicationId}`);
  return { ok: true };
}
