import { APPLICATION_STATUSES, type ApplicationStatus } from "@sb/shared";

export const APPLICATION_STATUS_PERMISSION: Partial<
  Record<ApplicationStatus, string>
> = {
  under_review: "applications.review",
  needs_requirements: "applications.request_requirements",
  approved: "applications.approve",
  rejected: "applications.reject",
};

/** Statuses the given permission set is allowed to set. */
export function allowedStatusTransitions(permissions: string[]) {
  return APPLICATION_STATUSES.filter((status) => {
    const permission = APPLICATION_STATUS_PERMISSION[status];
    return permission ? permissions.includes(permission) : false;
  });
}
