import {
  APPLICATION_DOCUMENTS_BUCKET,
  SIGNED_URL_EXPIRY_SECONDS,
} from "@sb/shared";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function buildDocumentPath(
  operatorId: string,
  applicationId: string,
  documentType: string,
  fileName: string
): string {
  const safeName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);
  return `${operatorId}/${applicationId}/${documentType}-${Date.now()}-${safeName}`;
}

export async function createDocumentUploadUrl(path: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(APPLICATION_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(error?.message ?? "Could not create upload URL");
  }
  return { path, token: data.token, signedUrl: data.signedUrl };
}

export async function createDocumentDownloadUrl(
  path: string
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(APPLICATION_DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error || !data) {
    return null;
  }
  return data.signedUrl;
}

export async function removeDocumentObject(path: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(APPLICATION_DOCUMENTS_BUCKET).remove([path]);
}
