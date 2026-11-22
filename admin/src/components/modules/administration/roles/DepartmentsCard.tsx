"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import {
  Building2Icon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
  type Department,
} from "@/services/administration/departments";
import { CARD, GhostButton, PrimaryButton, RowMenu } from "../shared/ui";
import { cn } from "@/lib/utils";

/* =========================================================================
   Departments — the teams an account can belong to.

   They sit beside roles rather than inside them: a role decides what someone
   may do, a department says who they sit with, and an Accounts hire and an
   MIS hire can hold the same role. Created here, chosen on the Add User form.
   ========================================================================= */

const FIELD =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400";

function DepartmentDialog({
  department,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  /** null creates a new one. */
  department: Department | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string }) => void;
}) {
  const [name, setName] = useState(department?.name ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setFieldError("A department name needs at least 2 characters.");
      return;
    }
    setFieldError("");
    onSubmit({ name: trimmed, description: description.trim() });
  };

  const message = fieldError || error;

  return (
    <div className="fixed inset-0 z-60 grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-900/20 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-dialog-title"
        className="relative w-full max-w-[420px] rounded-xl bg-white shadow-[0_24px_60px_-15px_rgb(16_24_40/0.35)]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <h2 id="department-dialog-title" className="text-[19px] font-semibold text-slate-900">
              {department ? "Edit Department" : "Create Department"}
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              {department
                ? "Rename the team or change how it is described."
                : "Name a team, then pick it on the Add User form."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-col gap-4 px-6 pb-5">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Name<span className="ml-0.5 text-rose-500">*</span>
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. MIS, Accounts"
              className={FIELD}
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this team is responsible for"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
            />
          </label>

          {message && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700"
            >
              {message}
            </p>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
          <GhostButton onClick={onClose} className="flex-1 justify-center">
            Cancel
          </GhostButton>
          <PrimaryButton onClick={submit} disabled={saving} className="flex-1 justify-center">
            {saving && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {department ? "Save changes" : "Create Department"}
          </PrimaryButton>
        </footer>
      </div>
    </div>
  );
}

export function DepartmentsCard({
  onChanged,
}: {
  /** Lets the page above refresh anything that lists departments. */
  onChanged?: () => void;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dialogFor, setDialogFor] = useState<Department | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = async () => {
    try {
      setDepartments(await getDepartments());
      setLoadError("");
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Could not load departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const submit = async (values: { name: string; description: string }) => {
    setSaving(true);
    setSaveError("");
    try {
      if (dialogFor && dialogFor !== "new") {
        await updateDepartment(dialogFor.id, values);
        Toast.fire({ icon: "success", title: `${values.name} updated.` });
      } else {
        await createDepartment(values);
        Toast.fire({ icon: "success", title: `${values.name} created.` });
      }
      setDialogFor(null);
      await load();
      onChanged?.();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const remove = (department: Department) => {
    Swal.fire({
      icon: "warning",
      title: `Remove ${department.name}?`,
      text: department.userCount
        ? `${department.userCount} ${
            department.userCount === 1 ? "account is" : "accounts are"
          } in it. They keep working — they are simply left without a department.`
        : "The team is removed. Nobody is in it.",
      showCancelButton: true,
      confirmButtonText: "Remove",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await deleteDepartment(department.id);
        Toast.fire({ icon: "success", title: `${department.name} removed.` });
        await load();
        onChanged?.();
      } catch (err: unknown) {
        Toast.fire({
          icon: "error",
          title: err instanceof Error ? err.message : "Could not remove the department",
        });
      }
    });
  };

  return (
    <>
      <section className={cn(CARD, "overflow-hidden")}>
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-[17px] font-semibold text-slate-900">Departments</h2>
          <p className="mt-1 text-[13px] text-slate-500">
            Teams an account can belong to. Chosen on the Add User form.
          </p>
        </div>

        {loadError && (
          <p
            role="alert"
            className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700"
          >
            {loadError}
          </p>
        )}

        {loading ? (
          <div className="flex flex-col gap-2 px-5 pb-4">
            {[0, 1, 2].map((row) => (
              <span key={row} className="h-9 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-slate-500">
            No departments yet. Create one — MIS, Accounts, Operations — and it becomes a choice
            when you add someone.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {departments.map((department) => (
              <li key={department.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                  <Building2Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-900">
                    {department.name}
                  </p>
                  <p className="truncate text-[12px] text-slate-500">
                    {department.userCount}{" "}
                    {department.userCount === 1 ? "person" : "people"}
                    {department.description ? ` · ${department.description}` : ""}
                  </p>
                </div>
                <RowMenu
                  label={`Actions for ${department.name}`}
                  items={[
                    {
                      label: "Edit department",
                      icon: PencilIcon,
                      onSelect: () => {
                        setSaveError("");
                        setDialogFor(department);
                      },
                    },
                    {
                      label: "Remove department",
                      icon: Trash2Icon,
                      tone: "danger" as const,
                      onSelect: () => remove(department),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={() => {
              setSaveError("");
              setDialogFor("new");
            }}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Create Department
          </button>
        </div>
      </section>

      {dialogFor && (
        <DepartmentDialog
          department={dialogFor === "new" ? null : dialogFor}
          saving={saving}
          error={saveError}
          onClose={() => setDialogFor(null)}
          onSubmit={submit}
        />
      )}
    </>
  );
}
