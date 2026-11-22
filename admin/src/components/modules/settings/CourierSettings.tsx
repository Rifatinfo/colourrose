"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  Loader2Icon,
  PlugZapIcon,
  ServerIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/modules/dashboard/SectionCard";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  deleteCourierCredential,
  listCourierCredentials,
  saveCourierCredential,
  testCourierCredential,
  type CourierCredential,
  type CredentialTest,
} from "@/services/courier/credentials";
import { SettingsField, settingsInputClass } from "./SettingsField";

/**
 * Courier credentials.
 *
 * Secrets are write-only: the server sends a masked preview and never the
 * value, so a field that is already set shows "qncb••••••uinj" and an empty
 * box. Leaving that box empty on save means "leave it alone" — which is what
 * makes it safe to edit one field without retyping the others.
 *
 * Each courier can be tested against its own API before anyone relies on it,
 * because an API key is a string nobody can check by looking at it.
 */
export function CourierSettings({ canEdit }: { canEdit: boolean }) {
  const [couriers, setCouriers] = useState<CourierCredential[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setCouriers(await listCourierCredentials());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load courier settings.");
      setCouriers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <SectionCard title="Couriers" subtitle="Delivery partner API credentials">
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      </SectionCard>
    );
  }

  if (!couriers) {
    return (
      <SectionCard title="Couriers" subtitle="Delivery partner API credentials">
        <div className="space-y-3">
          {[0, 1].map((row) => (
            <div key={row} className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {couriers.map((courier) => (
        <CourierCard
          key={courier.courier}
          courier={courier}
          canEdit={canEdit}
          onChanged={(next) =>
            setCouriers((current) =>
              (current ?? []).map((row) => (row.courier === next.courier ? next : row)),
            )
          }
        />
      ))}
    </div>
  );
}

const SOURCE_META: Record<
  CourierCredential["source"],
  { label: string; icon: typeof DatabaseIcon; className: string }
> = {
  database: { label: "Saved here", icon: DatabaseIcon, className: "bg-indigo-50 text-indigo-700" },
  environment: { label: "From .env", icon: ServerIcon, className: "bg-slate-100 text-slate-600" },
  mixed: { label: "Partly saved here", icon: DatabaseIcon, className: "bg-amber-50 text-amber-700" },
  none: { label: "Not set", icon: AlertTriangleIcon, className: "bg-slate-100 text-slate-600" },
};

function CourierCard({
  courier,
  canEdit,
  onChanged,
}: {
  courier: CourierCredential;
  canEdit: boolean;
  onChanged: (next: CourierCredential) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [result, setResult] = useState<CredentialTest | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");

  const source = SOURCE_META[courier.source];
  const dirty = Object.values(draft).some((value) => value.trim() !== "");
  const storedHere = courier.fields.some((field) => field.inDatabase);

  const run = async (
    work: () => Promise<CourierCredential>,
    setBusy: (busy: boolean) => void,
    message: string,
  ) => {
    setBusy(true);
    setFailure("");
    setNotice("");
    setResult(null);
    try {
      onChanged(await work());
      setDraft({});
      setNotice(message);
      setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title={courier.label}
      subtitle={
        courier.configured
          ? "Credentials are in place."
          : `Not usable yet — missing ${courier.missing.join(", ")}.`
      }
    >
      {/* Status row */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            courier.configured
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700",
          )}
        >
          {courier.configured ? (
            <CheckCircle2Icon className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <AlertTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {courier.configured ? "Configured" : "Incomplete"}
        </span>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            source.className,
          )}
          title="Values saved here override the server's environment variables."
        >
          <source.icon className="h-3.5 w-3.5" aria-hidden="true" />
          {source.label}
        </span>

        <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
          Available for dispatch
          <ToggleSwitch
            label={`Make ${courier.label} available for dispatch`}
            checked={courier.enabled}
            disabled={!canEdit || saving}
            onChange={(enabled: boolean) =>
              void run(
                () => saveCourierCredential(courier.courier, { enabled }),
                setSaving,
                enabled ? `${courier.label} switched on.` : `${courier.label} switched off.`,
              )
            }
          />
        </label>
      </div>

      {/* Fields */}
      <div className="grid gap-4 @lg:grid-cols-2">
        {courier.fields.map((field) => {
          const id = `${courier.courier}-${field.key}`;

          return (
            <SettingsField
              key={field.key}
              label={field.label + (field.required ? "" : " (optional)")}
              htmlFor={id}
              hint={
                field.secret && field.set
                  ? // The preview is the whole point: it says "a key is here"
                    // without being usable as one.
                    `Currently ${field.preview}. Leave blank to keep it.`
                  : (field.hint ?? undefined)
              }
            >
              <input
                id={id}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                disabled={!canEdit}
                placeholder={
                  field.secret && field.set
                    ? "••••••••"
                    : (field.placeholder ?? `Falls back to ${field.env}`)
                }
                value={draft[field.key] ?? (field.secret ? "" : (field.value ?? ""))}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                }
                className={settingsInputClass}
              />
            </SettingsField>
          );
        })}
      </div>

      {/* Outcome */}
      {result && (
        <p
          className={cn(
            "mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
            result.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {result.ok ? (
            <CheckCircle2Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <XCircleIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {result.message}
            {result.detail ? ` ${result.detail}` : ""}
          </span>
        </p>
      )}

      {notice && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </p>
      )}

      {failure && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {failure}
        </p>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <button
          type="button"
          disabled={!canEdit || saving || !dirty}
          onClick={() =>
            void run(
              () => saveCourierCredential(courier.courier, { values: draft }),
              setSaving,
              "Credentials saved.",
            )
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving && <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Save credentials"}
        </button>

        <button
          type="button"
          disabled={testing || !courier.configured}
          title={
            courier.configured
              ? "Calls the courier with these credentials. Nothing is booked."
              : "Fill in the required fields first."
          }
          onClick={async () => {
            setTesting(true);
            setNotice("");
            setFailure("");
            try {
              setResult(await testCourierCredential(courier.courier));
            } catch (err) {
              setFailure(err instanceof Error ? err.message : "Couldn't run the test.");
            } finally {
              setTesting(false);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-slate-50 hover:text-ink disabled:opacity-40"
        >
          {testing ? (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <PlugZapIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {testing ? "Testing…" : "Test connection"}
        </button>

        {dirty && !saving && (
          <button
            type="button"
            onClick={() => setDraft({})}
            className="rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Discard changes
          </button>
        )}

        {/* Only offered when there is something here to remove; deleting what
            the environment provides is not something this screen can do. */}
        {storedHere && canEdit && (
          <div className="ml-auto flex items-center gap-2">
            {confirmRemove ? (
              <>
                <span className="text-xs text-ink-muted">
                  Remove saved keys and fall back to {courier.fields[0]?.env.split("_")[0]} env vars?
                </span>
                <button
                  type="button"
                  disabled={removing}
                  onClick={() =>
                    void run(
                      () => deleteCourierCredential(courier.courier),
                      setRemoving,
                      "Saved credentials removed.",
                    ).then(() => setConfirmRemove(false))
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {removing && <Loader2Icon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  {removing ? "Removing…" : "Yes, remove"}
                </button>
                <button
                  type="button"
                  disabled={removing}
                  onClick={() => setConfirmRemove(false)}
                  className="rounded-lg px-2 py-2 text-sm text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
