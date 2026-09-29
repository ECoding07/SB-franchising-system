import { z } from "zod";

import {
  APPLICATION_TYPES,
  CITIZENSHIPS,
  DOCUMENT_TYPES,
  OWNERSHIP_TYPES,
  PERSON_TYPES,
} from "./constants";

export const operatorProfileSchema = z.object({
  personType: z.enum(PERSON_TYPES),
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim().optional().or(z.literal("")),
  lastName: z.string().trim().min(1, "Last name is required"),
  citizenship: z.enum(CITIZENSHIPS).default("filipino"),
  addressBarangay: z.string().trim().min(1, "Barangay is required"),
  addressTownProvince: z.string().trim().min(1, "Town/Province is required"),
  contactNo: z.string().trim().min(1, "Contact number is required"),
  ctcNo: z.string().trim().optional().or(z.literal("")),
  ctcIssuedAt: z.string().trim().optional().or(z.literal("")),
  ctcIssuedOn: z.string().trim().optional().or(z.literal("")),
  licenseNo: z.string().trim().optional().or(z.literal("")),
  todaId: z.string().trim().optional().or(z.literal("")),
});

export type OperatorProfileInput = z.infer<typeof operatorProfileSchema>;

export const applicationUnitSchema = z.object({
  make: z.string().trim().min(1, "Make is required"),
  model: z.string().trim().min(1, "Model is required"),
  motorNo: z.string().trim().min(1, "Motor no. is required"),
  engineNo: z.string().trim().optional().or(z.literal("")),
  chassisNo: z.string().trim().min(1, "Chassis no. is required"),
  plateNo: z.string().trim().min(1, "Plate no. is required"),
  certificateOfRegistrationNo: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),
});

export type ApplicationUnitInput = z.infer<typeof applicationUnitSchema>;

export const applicationSchema = z.object({
  applicationType: z.enum(APPLICATION_TYPES),
  todaId: z.string().trim().optional().or(z.literal("")),
  appliedRoute: z.string().trim().min(1, "Applied route is required"),
  registeredOwner: z.string().trim().min(1, "Registered owner is required"),
  ownershipType: z.enum(OWNERSHIP_TYPES),
  comTaxCertNo: z.string().trim().optional().or(z.literal("")),
  comTaxIssuedAt: z.string().trim().optional().or(z.literal("")),
  comTaxIssuedOn: z.string().trim().optional().or(z.literal("")),
  units: z
    .array(applicationUnitSchema)
    .min(1, "At least one unit is required")
    .max(10, "Too many units"),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
