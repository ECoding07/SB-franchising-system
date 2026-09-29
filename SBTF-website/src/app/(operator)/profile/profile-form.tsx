"use client";

import { useActionState } from "react";
import {
  CITIZENSHIPS,
  PERSON_TYPES,
  PERSON_TYPE_LABELS,
  type Citizenship,
  type PersonType,
} from "@sb/shared";

import { saveOperatorProfileAction, type FormState } from "../actions";

export type ProfileDefaults = {
  personType: PersonType;
  firstName: string;
  middleName: string;
  lastName: string;
  citizenship: Citizenship;
  addressBarangay: string;
  addressTownProvince: string;
  contactNo: string;
  ctcNo: string;
  ctcIssuedAt: string;
  ctcIssuedOn: string;
  licenseNo: string;
  todaId: string;
};

export type TodaOption = {
  id: string;
  name: string;
  municipality: string;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";
const labelClass = "text-sm font-medium";

const initialState: FormState = {};

export function ProfileForm({
  profile,
  todas,
}: {
  profile: ProfileDefaults;
  todas: TodaOption[];
}) {
  const [state, formAction, pending] = useActionState(
    saveOperatorProfileAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClass} htmlFor="personType">
            I am registering as
          </label>
          <select
            id="personType"
            name="personType"
            defaultValue={profile.personType}
            className={inputClass}
          >
            {PERSON_TYPES.map((type) => (
              <option key={type} value={type}>
                {PERSON_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="citizenship">
            Citizenship
          </label>
          <select
            id="citizenship"
            name="citizenship"
            defaultValue={profile.citizenship}
            className={inputClass}
          >
            {CITIZENSHIPS.map((c) => (
              <option key={c} value={c}>
                {c === "filipino" ? "Filipino" : "Foreign"}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="firstName">
            First name
          </label>
          <input id="firstName" name="firstName" defaultValue={profile.firstName} required className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="middleName">
            Middle name
          </label>
          <input id="middleName" name="middleName" defaultValue={profile.middleName} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="lastName">
            Last name
          </label>
          <input id="lastName" name="lastName" defaultValue={profile.lastName} required className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="contactNo">
            Contact number
          </label>
          <input id="contactNo" name="contactNo" defaultValue={profile.contactNo} required className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="addressBarangay">
            Barangay
          </label>
          <input id="addressBarangay" name="addressBarangay" defaultValue={profile.addressBarangay} required className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="addressTownProvince">
            Town / Province
          </label>
          <input id="addressTownProvince" name="addressTownProvince" defaultValue={profile.addressTownProvince} required className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="todaId">
            TODA
          </label>
          <select id="todaId" name="todaId" defaultValue={profile.todaId} className={inputClass}>
            <option value="">Not a member / none</option>
            {todas.map((toda) => (
              <option key={toda.id} value={toda.id}>
                {toda.name} ({toda.municipality})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="licenseNo">
            Driver&apos;s license no. (if driver)
          </label>
          <input id="licenseNo" name="licenseNo" defaultValue={profile.licenseNo} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="ctcNo">
            CTC no.
          </label>
          <input id="ctcNo" name="ctcNo" defaultValue={profile.ctcNo} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="ctcIssuedAt">
            CTC issued at
          </label>
          <input id="ctcIssuedAt" name="ctcIssuedAt" defaultValue={profile.ctcIssuedAt} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass} htmlFor="ctcIssuedOn">
            CTC issued on
          </label>
          <input id="ctcIssuedOn" name="ctcIssuedOn" defaultValue={profile.ctcIssuedOn} placeholder="YYYY-MM-DD" className={inputClass} />
        </div>
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
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
