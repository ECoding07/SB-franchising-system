"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUpAction, type AuthFormState } from "../actions";

const initialState: AuthFormState = {};

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    initialState
  );

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-emerald-600">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating account..." : "Create account"}
      </button>
      <p className="text-xs text-zinc-400">
        Already registered?{" "}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}