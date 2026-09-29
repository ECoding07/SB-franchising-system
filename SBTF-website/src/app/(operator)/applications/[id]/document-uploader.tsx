"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { APPLICATION_DOCUMENTS_BUCKET } from "@sb/shared";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  registerDocumentAction,
  requestDocumentUploadAction,
} from "../../actions";

export function DocumentUploader({
  applicationId,
  documentType,
}: {
  applicationId: string;
  documentType: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const target = await requestDocumentUploadAction({
        applicationId,
        documentType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      if ("error" in target) {
        setError(target.error);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(APPLICATION_DOCUMENTS_BUCKET)
        .uploadToSignedUrl(target.path, target.token, file);
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const registered = await registerDocumentAction({
        applicationId,
        documentType,
        path: target.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      if ("error" in registered) {
        setError(registered.error);
        return;
      }

      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void handleFile(file);
          }
        }}
        className="text-sm"
      />
      {busy ? <span className="text-xs text-zinc-500">Uploading...</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
