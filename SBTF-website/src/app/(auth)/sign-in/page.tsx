import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">
          SBTF System — Municipality of Mabini, Batangas
        </p>
      </div>
      <SignInForm />
    </main>
  );
}