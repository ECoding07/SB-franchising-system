"use client";

import { useActionState } from "react";

import { signInAction, type AuthFormState } from "../actions";

const initialState: AuthFormState = {};

export function SignInForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
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
          autoComplete="current-password"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}