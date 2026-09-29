export type SessionUser = {
  id: string;
  email: string;
  authUserId: string;
  status: "pending" | "active" | "suspended";
  roles: string[];
  permissions: string[];
};
