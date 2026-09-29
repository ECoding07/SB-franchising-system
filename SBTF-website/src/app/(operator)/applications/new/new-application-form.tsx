"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  APPLICATION_TYPES,
  OWNERSHIP_TYPES,
  OWNERSHIP_TYPE_LABELS,
  type ApplicationType,
  type OwnershipType,
} from "@sb/shared";

import { submitApplicationAction, type FormState } from "../../actions";
import type { TodaOption } from "../../profile/profile-form";

type UnitDraft = {
  make: string;
  model: string;
  motorNo: string;
  engineNo: string;
  chassisNo: string;
  plateNo: string;
  certificateOfRegistrationNo: string;
};

const emptyUnit: UnitDraft = {
  make: "",
  model: "",
  motorNo: "",
  engineNo: "",
  chassisNo: "",
  plateNo: "",
  certificateOfRegistrationNo: "",
};

const inputClass = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";
const labelClass = "text-sm font-medium";

const initialState: FormState = {};

export function NewApplicationForm({
  defaultTodaId,
  maxUnits,
  todas,
}: {
  defaultTodaId: string;
  maxUnits: number;
  todas: TodaOption[];
}) {
  const [state, formAction, pending] = useActionState(
    submitApplicationAction,
    initialState
  );
  const [applicationType, setApplicationType] =
    useState<ApplicationType>("new");
  const [ownershipType, setOwnershipType] =
    useState<OwnershipType>("single_proprietorship");
  const [units, setUnits] = useState<UnitDraft[]>([{ ...emptyUnit }]);

  function updateUnit(index: number, field: keyof UnitDraft, value: string) {
    setUnits((prev) =>
      prev.map((unit, i) => (i === index ? { ...unit, [field]: value } : unit))
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="units" value={JSON.stringify(units)} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Application</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClass} htmlFor="applicationType">
              Application type
            </label>
            <select
              id="applicationType"
              name="applicationType"
              value={applicationType}
              onChange={(e) =>
                setApplicationType(e.target.value as ApplicationType)
              }
              className={inputClass}
            >
              {APPLICATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "new" ? "New franchise" : "Renewal"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="todaId">
              TODA
            </label>
            <select
              id="todaId"
              name="todaId"
              defaultValue={defaultTodaId}
              className={inputClass}
            >
              <option value="">Not a member / none</option>
              {todas.map((toda) => (
                <option key={toda.id} value={toda.id}>
                  {toda.name} ({toda.municipality})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="appliedRoute">
              Applied route
            </label>
            <input id="appliedRoute" name="appliedRoute" required className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="registeredOwner">
              Registered owner
            </label>
            <input id="registeredOwner" name="registeredOwner" required className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="ownershipType">
              Ownership type
            </label>
            <select
              id="ownershipType"
              name="ownershipType"
              value={ownershipType}
              onChange={(e) =>
                setOwnershipType(e.target.value as OwnershipType)
              }
              className={inputClass}
            >
              {OWNERSHIP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {OWNERSHIP_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="comTaxCertNo">
              Community tax cert. no.
            </label>
            <input id="comTaxCertNo" name="comTaxCertNo" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="comTaxIssuedAt">
              Community tax issued at
            </label>
            <input id="comTaxIssuedAt" name="comTaxIssuedAt" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="comTaxIssuedOn">
              Community tax issued on
            </label>
            <input id="comTaxIssuedOn" name="comTaxIssuedOn" placeholder="YYYY-MM-DD" className={inputClass} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Vehicle units ({units.length}/{maxUnits})
          </h2>
          <button
            type="button"
            onClick={() =>
              setUnits((prev) =>
                prev.length >= maxUnits ? prev : [...prev, { ...emptyUnit }]
              )
            }
            disabled={units.length >= maxUnits}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Add unit
          </button>
        </div>

        {units.map((unit, index) => (
          <div key={index} className="space-y-4 rounded-md border border-zinc-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Unit {index + 1}</h3>
              {units.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setUnits((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="text-sm text-red-600 underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["make", "Make", true],
                  ["model", "Model", true],
                  ["motorNo", "Motor no.", true],
                  ["engineNo", "Engine no.", false],
                  ["chassisNo", "Chassis no.", true],
                  ["plateNo", "Plate no.", true],
                  [
                    "certificateOfRegistrationNo",
                    "Certificate of registration no.",
                    false,
                  ],
                ] as const
              ).map(([field, label, required]) => (
                <div key={field} className="space-y-1">
                  <span className={labelClass}>{label}</span>
                  <input
                    value={unit[field]}
                    onChange={(e) => updateUnit(index, field, e.target.value)}
                    required={required}
                    aria-label={label}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Submitting..." : "Submit application"}
        </button>
        <Link href="/dashboard" className="text-sm text-zinc-500 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
