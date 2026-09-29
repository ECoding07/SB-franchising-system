import { redirect } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  if (user.status !== "active") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Account not active</h1>
        <p className="max-w-md text-sm text-zinc-500">
          Your account is {user.status}. Please contact the Municipal
          Administrator if you believe this is a mistake.
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
          >
            Sign out
          </button>
        </form>
      </main>
    );
  }

  if (user.roles.includes("admin")) {
    redirect("/overview");
  }
  if (user.roles.includes("staff")) {
    redirect("/queue");
  }
  redirect("/dashboard");
}