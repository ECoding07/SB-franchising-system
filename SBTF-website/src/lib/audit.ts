import { headers } from "next/headers";
import { ROLES } from "@sb/shared";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";

export async function getRequestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}

type JsonValue = string | number | boolean | null;

/** Records an entry in the activity log for auditing. */
export async function logActivity(params: {
  user: SessionUser;
  module: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, JsonValue>;
  requestMeta?: { ipAddress?: string; userAgent?: string };
}) {
  const userRole = ROLES.find((role) => params.user.roles.includes(role));

  await prisma.activityLog.create({
    data: {
      userId: params.user.id,
      userEmail: params.user.email,
      userRole: userRole ?? null,
      module: params.module,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata,
      ipAddress: params.requestMeta?.ipAddress,
      userAgent: params.requestMeta?.userAgent,
    },
  });
}

/** Sends an in-app notification to a user. */
export async function notifyUser(params: {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link,
    },
  });
}
