"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInSchema, signUpSchema } from "@sb/shared";

import { syncUserFromAuth } from "@/lib/auth/sync";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
  email?: string;
};

async function getRequestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;
  const meta = await getRequestMeta();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    await prisma.loginAttempt.create({
      data: { email, success: false, ...meta },
    });
    return { error: "Invalid email or password." };
  }

  const user = await syncUserFromAuth(data.user);
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await prisma.loginAttempt.create({
      data: {
        email,
        userId: user.id,
        success: true,
        ...meta,
      },
    });
  }

  redirect("/");
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;
  const meta = await getRequestMeta();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    await syncUserFromAuth(data.user);
    await prisma.loginAttempt.create({
      data: { email, userId: (await prisma.user.findUnique({ where: { email } }))?.id ?? undefined, success: true, ...meta },
    });
  }

  if (data.session) {
    redirect("/");
  }

  return {
    message: "Account created. Check your email to confirm before signing in.",
    email,
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}