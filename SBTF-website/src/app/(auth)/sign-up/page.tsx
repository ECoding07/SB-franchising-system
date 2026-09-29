import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Create an account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Register as a tricycle operator
        </p>
      </div>
      <SignUpForm />
      <p className="text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-zinc-900 underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}