"use client";

import { useEffect, useRef, useState } from "react";
import {
  CameraIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  Loader2Icon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";

import Link from "next/link";

import { FieldSelect } from "@/components/ui/field-select";
import type { Department } from "@/services/administration/departments";
import type { RoleDefinition } from "@/types/administration";
import { generatePassword, type TeamMember } from "@/services/administration/team";
import { GhostButton, PrimaryButton, resolveAvatarUrl, initialsOf } from "../shared/ui";
import { cn } from "@/lib/utils";

/* =========================================================================
   Add / edit a team member.

   A slide-over rather than a centre dialog: the roster stays on screen
   behind it, so an admin adding three people can see who is already there.
   ========================================================================= */

export type UserPanelPayload = {
  name: string;
  email: string;
  phone: string;
  /** The id of the role row the account holds. */
  roleId: string;
  /** Empty string means no department. */
  departmentId: string;
  password: string;
  file: File | null;
};

/** The select reads "" as "nothing chosen", so "none" has to be a real value. */
const NO_DEPARTMENT = "none";

// Bangladesh first: the store, its couriers and its support team are all there.
const DIAL_CODES = [
  { value: "+880", label: "+880" },
  { value: "+91", label: "+91" },
  { value: "+971", label: "+971" },
  { value: "+44", label: "+44" },
  { value: "+1", label: "+1" },
];

const FIELD =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </span>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 px-6 py-5 first:border-t-0">
      <h3 className="mb-4 text-[15px] font-semibold text-slate-900">{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function UserPanel({
  member,
  roles,
  departments,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  /** null opens the panel for a new account. */
  member: TeamMember | null;
  /** The roles that exist, for the Role field. */
  roles: RoleDefinition[];
  /** The teams that exist, for the Department field. */
  departments: Department[];
  submitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: UserPanelPayload) => void;
}) {
  const isEdit = Boolean(member);
  // The owner is the one account whose role the server will not move.
  const lockedRole = Boolean(member?.isOwner);

  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [dial, setDial] = useState("+880");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState(member?.roleId ?? "");
  /*
    "No department" carries a sentinel rather than an empty string: the select
    treats "" as "nothing chosen" and falls back to the placeholder, so an
    option with that value could never be picked or shown. It is mapped back
    to "" on submit, which is what the API reads as "clear it".
  */
  const [departmentId, setDepartmentId] = useState(member?.departmentId ?? NO_DEPARTMENT);

  const roleOptions = roles
    .filter((role) => role.status === "ACTIVE" || role.id === member?.roleId)
    .map((role) => ({ value: role.id, label: role.name }));

  const departmentOptions = [
    { value: NO_DEPARTMENT, label: "No department" },
    ...departments.map((department) => ({
      value: department.id,
      label: department.name,
    })),
  ];
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    firstFieldRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // The object URL has to be released when the choice changes, which is
    // what keeps this in an effect rather than deriving it during render.
    const objectUrl = file ? URL.createObjectURL(file) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(objectUrl);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const avatar = preview ?? resolveAvatarUrl(member?.avatar);

  const submit = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.replace(/\s|-/g, "");

    if (trimmedName.length < 2) return setFieldError("Enter a full name of at least 2 characters.");
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return setFieldError("Enter a valid email address.");
    // The API takes the number as one string and wants at least 11 digits,
    // which a local number plus its dial code always clears.
    if (trimmedPhone && `${dial}${trimmedPhone}`.length < 11) {
      return setFieldError("Enter a full phone number, or leave it blank.");
    }
    if (!isEdit && password.length < 8) {
      return setFieldError("The temporary password needs at least 8 characters.");
    }

    setFieldError("");
    onSubmit({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone ? `${dial}${trimmedPhone}` : "",
      roleId,
      departmentId: departmentId === NO_DEPARTMENT ? "" : departmentId,
      password,
      file,
    });
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the field is visible either way.
    }
  };

  const message = fieldError || error;

  return (
    <div className="fixed inset-0 z-60 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-900/20 backdrop-blur-[1px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-panel-title"
        className="relative flex h-full w-full max-w-[440px] flex-col bg-white shadow-[0_0_60px_-12px_rgb(16_24_40/0.35)]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <h2 id="user-panel-title" className="text-[21px] font-semibold text-slate-900">
              {isEdit ? "Edit User" : "Add New User"}
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              {isEdit
                ? "Update this team member's details and access."
                : "Create a new team member and set their access."}
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Group title="Basic Information">
            <div className="flex items-center gap-4">
              <span className="relative">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-[15px] font-semibold text-slate-500">
                    {name.trim() ? initialsOf(name) : "?"}
                  </span>
                )}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-300"
                >
                  <CameraIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {avatar ? "Change photo" : "Add photo"}
                </button>
                <p className="mt-1.5 text-[12px] text-slate-400">Optional. JPG or PNG.</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <label className="block">
              <Label required>Full Name</Label>
              <input
                ref={firstFieldRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter full name"
                className={FIELD}
              />
            </label>

            <label className="block">
              <Label required>Email Address</Label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@thewindrise.com"
                className={FIELD}
              />
            </label>

            {!isEdit && (
              <div>
                <Label>Phone Number</Label>
                <div className="flex gap-2">
                  <FieldSelect
                    value={dial}
                    onValueChange={setDial}
                    options={DIAL_CODES}
                    label="Country dialling code"
                    className="w-24 shrink-0"
                  />
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Enter phone number (optional)"
                    className={FIELD}
                  />
                </div>
              </div>
            )}
          </Group>

          <Group title="Access & Role">
            <div>
              <Label required>Role</Label>
              <FieldSelect
                value={roleId}
                onValueChange={setRoleId}
                options={roleOptions}
                label="Role"
                disabled={lockedRole}
              />
              {lockedRole ? (
                <p className="mt-1.5 text-[12px] text-slate-400">
                  The owner account keeps its role — it is what restores the others.
                </p>
              ) : (
                isEdit && (
                  <p className="mt-1.5 text-[12px] text-slate-400">
                    Changing this moves the account to the new role straight away.
                  </p>
                )
              )}
            </div>

            <div>
              <Label>Department</Label>
              <FieldSelect
                value={departmentId}
                onValueChange={setDepartmentId}
                options={departmentOptions}
                label="Department"
              />
              <p className="mt-1.5 text-[12px] text-slate-400">
                {departments.length === 0 ? (
                  <>
                    No departments yet — create them under{" "}
                    <Link
                      href="/admin/roles-permissions"
                      className="underline underline-offset-2 transition-colors hover:text-slate-600"
                    >
                      Roles &amp; Permissions
                    </Link>
                    .
                  </>
                ) : (
                  "Which team they sit with. Separate from what the role can do."
                )}
              </p>
            </div>

            <div className="flex gap-3 rounded-lg bg-slate-50 px-3.5 py-3">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <p className="text-[12px] leading-relaxed text-slate-500">
                <span className="font-medium text-slate-700">Role determines permissions.</span>{" "}
                The selected role grants access to specific modules and features. Adjust what each
                role can reach in Roles &amp; Permissions.
              </p>
            </div>
          </Group>

          {!isEdit && (
            <Group title="Account Settings">
              <div>
                <Label required>Temporary password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className={cn(FIELD, "pr-10")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-slate-400 transition-colors hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOffIcon className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <EyeIcon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(generatePassword());
                      setShowPassword(true);
                    }}
                    className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-300"
                  >
                    <RefreshCwIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={copyPassword}
                    disabled={!password}
                    aria-label="Copy password"
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copied ? (
                      <CheckIcon className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <CopyIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[12px] text-slate-400">
                  Share it with them directly. They can sign in with it straight away, and are
                  asked to set their own password the first time they do.
                </p>
              </div>
            </Group>
          )}
        </div>

        {message && (
          <p
            role="alert"
            className="mx-6 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700"
          >
            {message}
          </p>
        )}

        <footer className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
          <GhostButton onClick={onClose} className="flex-1 justify-center">
            Cancel
          </GhostButton>
          <PrimaryButton onClick={submit} disabled={submitting} className="flex-1 justify-center">
            {submitting && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isEdit ? "Save changes" : "Create User"}
          </PrimaryButton>
        </footer>
      </div>
    </div>
  );
}
