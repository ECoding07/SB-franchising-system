export const APP_NAME = "SBTF System";
export const APP_DESCRIPTION =
  "Sangguniang Barangay Tricycle Franchise (SBTF) System — Municipality of Mabini, Batangas";

export const FRANCHISE_FEE = 120;
export const FRANCHISE_VALIDITY_YEARS = 2;
export const SIGNED_URL_EXPIRY_SECONDS = 3600;
export const APPLICATION_DOCUMENTS_BUCKET = "application-documents";

export const ROLES = ["operator", "staff", "admin"] as const;
export type RoleName = (typeof ROLES)[number];

export const PERSON_TYPES = ["operator", "driver"] as const;
export type PersonType = (typeof PERSON_TYPES)[number];

export const ACCOUNT_STATUSES = ["pending", "active", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const APPLICATION_TYPES = ["new", "renewal"] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];

export const APPLICATION_STATUSES = [
  "draft",
  "pending",
  "under_review",
  "needs_requirements",
  "approved",
  "rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "membership_certificate",
  "barangay_clearance",
  "or_cr",
  "cedula",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ["pending", "verified", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const FRANCHISE_STATUSES = ["active", "expired", "revoked"] as const;
export type FranchiseStatus = (typeof FRANCHISE_STATUSES)[number];

export const OWNERSHIP_TYPES = [
  "single_proprietorship",
  "cooperative",
  "corporation",
] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const CITIZENSHIPS = ["filipino", "foreign"] as const;
export type Citizenship = (typeof CITIZENSHIPS)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  under_review: "Under Review",
  needs_requirements: "Needs Requirements",
  approved: "Approved",
  rejected: "Rejected",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  membership_certificate: "TODA Membership Certificate",
  barangay_clearance: "Barangay Clearance",
  or_cr: "OR/CR (Vehicle Registration)",
  cedula: "Cedula",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
};

export const OWNERSHIP_TYPE_LABELS: Record<OwnershipType, string> = {
  single_proprietorship: "Single Proprietorship",
  cooperative: "Cooperative",
  corporation: "Corporation",
};

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  operator: "Operator",
  driver: "Driver",
};
