import type { ReactNode } from "react";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/rbac";

export default async function OperatorLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(["operator"]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Operator</span>
          <nav className="flex items-center gap-4 text-sm text-zinc-600">
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link href="/applications/new" className="hover:underline">
              New Application
            </Link>
            <Link href="/profile" className="hover:underline">
              Profile
            </Link>
          </nav>
        </div>
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
