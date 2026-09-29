import type { ReactNode } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/rbac";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["admin"]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
        <span className="font-semibold">Administrator</span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            Sign out
          </button>
        </form>
      </header>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}