"use client";

import { useActionState, useState, useTransition } from "react";
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type DocumentStatus,
} from "@sb/shared";

import {
  issueFranchiseAction,
  recordPaymentAction,
  updateApplicationStatusAction,
  updateDocumentStatusAction,
  type StaffFormState,
} from "../../actions";

const inputClass = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";
const labelClass = "text-sm font-medium";

const initialState: StaffFormState = {};

export function StatusForm({
  applicationId,
  currentStatus,
  allowedStatuses,
}: {
  applicationId: string;
  currentStatus: string;
  allowedStatuses: ApplicationStatus[];
}) {
  const [state, formAction, pending] = useActionState(
    updateApplicationStatusAction,
    initialState
  );
  const options = allowedStatuses.filter((status) => status !== currentStatus);

  if (options.length === 0) {
    return <p className="text-sm text-zinc-500">No status changes available.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="space-y-1">
        <label className={labelClass} htmlFor={`status-${applicationId}`}>
          New status
        </label>
        <select
          id={`status-${applicationId}`}
          name="status"
          className={inputClass}
          defaultValue={options[0]}
        >
          {options.map((status) => (
            <option key={status} value={status}>
              {APPLICATION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className={labelClass} htmlFor={`remarks-${applicationId}`}>
          Remarks (optional)
        </label>
        <textarea
          id={`remarks-${applicationId}`}
          name="remarks"
          rows={2}
          className={inputClass}
        />
      </div>
      <StateFeedback state={state} pending={pending} label="Update status" />
    </form>
  );
}

export function DocumentReviewActions({
  documentId,
  documentType,
  status,
}: {
  documentId: string;
  documentType: string;
  status: DocumentStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [remarks, setRemarks] = useState("");

  function act(next: "verified" | "rejected" | "pending") {
    setError(null);
    startTransition(async () => {
      const result = await updateDocumentStatusAction({
        documentId,
        status: next,
        remarks,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setRemarks("");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => act("verified")}
          disabled={pending}
          className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 disabled:opacity-50"
        >
          Verify
        </button>
        <button
          type="button"
          onClick={() => act("rejected")}
          disabled={pending}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
        >
          Return
        </button>
        {status !== "pending" ? (
          <button
            type="button"
            onClick={() => act("pending")}
            disabled={pending}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 disabled:opacity-50"
          >
            Reset
          </button>
        ) : null}
      </div>
      <input
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder={`Remarks for ${documentType.replace(/_/g, " ")}`}
        aria-label={`Remarks for ${documentType}`}
        className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs"
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function PaymentForm({
  applicationId,
  defaultAmount,
}: {
  applicationId: string;
  defaultAmount: number;
}) {
  const [state, formAction, pending] = useActionState(
    recordPaymentAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className={labelClass} htmlFor={`orNo-${applicationId}`}>
            OR number
          </label>
          <input id={`orNo-${applicationId}`} name="orNo" required className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor={`amountPaid-${applicationId}`}>
            Amount (PHP)
          </label>
          <input
            id={`amountPaid-${applicationId}`}
            name="amountPaid"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultAmount}
            required
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor={`datePaid-${applicationId}`}>
            Date paid
          </label>
          <input
            id={`datePaid-${applicationId}`}
            name="datePaid"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </div>
      </div>
      <StateFeedback state={state} pending={pending} label="Record payment" />
    </form>
  );
}

export function FranchiseForm({ applicationId }: { applicationId: string }) {
  const [state, formAction, pending] = useActionState(
    issueFranchiseAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClass} htmlFor={`certificateNo-${applicationId}`}>
            Certificate no. (blank = auto)
          </label>
          <input
            id={`certificateNo-${applicationId}`}
            name="certificateNo"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor={`validUntil-${applicationId}`}>
            Valid until (blank = auto)
          </label>
          <input
            id={`validUntil-${applicationId}`}
            name="validUntil"
            type="date"
            className={inputClass}
          />
        </div>
      </div>
      <StateFeedback state={state} pending={pending} label="Issue franchise" />
    </form>
  );
}

function StateFeedback({
  state,
  pending,
  label,
}: {
  state: StaffFormState;
  pending: boolean;
  label: string;
}) {
  return (
    <div className="space-y-2">
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
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Working..." : label}
      </button>
    </div>
  );
}
