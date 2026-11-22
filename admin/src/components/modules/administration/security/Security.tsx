"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  ClockIcon,
  FingerprintIcon,
  GlobeIcon,
  HashIcon,
  KeyRoundIcon,
  LockIcon,
  LogOutIcon,
  MailIcon,
  MonitorIcon,
  PlusIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerIcon,
  TrashIcon,
  TypeIcon,
  UserRoundCheckIcon,
} from "lucide-react";

import { Toast } from "@/components/shared/Toast/Toast";
import { useAuth } from "@/hooks/use-auth";
import { logout } from "@/services/auth/logoutUser";
import {
  DEFAULT_SECURITY_SETTINGS,
  type ActivityEntry,
  type SecuritySettings,
} from "@/types/administration";
import { fetchActivity } from "@/services/administration/activity";
import { describeThisDevice, signOutEverywhere } from "@/services/administration/sessions";
import { loadSecuritySettings, saveSecuritySettings } from "@/services/administration/store";
import { fetchTeam, type TeamMember } from "@/services/administration/team";
import {
  Avatar,
  GhostButton,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatGrid,
  Th,
} from "../shared/ui";
import { NumberRow, SelectRow, ToggleRow } from "./SettingRow";
import { RecommendationsCard, recommendationsFor, SecurityLogCard } from "./SecurityAside";

/* =========================================================================
   Security.

   The policy on this screen is saved for this dashboard; the API has no
   endpoint for it yet, and the note at the foot of the page says so rather
   than letting an admin believe a switch has changed how sign-in works.
   Everything read from the API — the roster, the log, this session — is live.
   ========================================================================= */

const TIMEOUTS = [15, 30, 60, 120, 480].map((minutes) => ({
  value: String(minutes),
  label: minutes >= 60 ? `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}` : `${minutes} minutes`,
}));

const EXPIRY = [
  { value: "0", label: "Never" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
];

const ATTEMPTS = [3, 5, 10].map((count) => ({
  value: String(count),
  label: `${count} attempts`,
}));

const LOCKOUTS = [5, 15, 30, 60].map((minutes) => ({
  value: String(minutes),
  label: `${minutes} minutes`,
}));

export function Security() {
  const { user } = useAuth();

  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [log, setLog] = useState<ActivityEntry[]>([]);
  const [device, setDevice] = useState("This browser");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // Both are browser-only reads, so they cannot happen during render
    // without the server and the client disagreeing on the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSecuritySettings());
    setDevice(describeThisDevice());

    fetchTeam()
      .then(({ members }) => setTeam(members.filter((member) => member.status !== "DELETED")))
      .catch(() => setTeam([]));

    fetchActivity()
      .then(({ entries }) =>
        setLog(entries.filter((entry) => entry.module === "Administration"))
      )
      .catch(() => setLog([]));
  }, []);

  /** Every change is saved as it is made; there is nothing to submit. */
  const update = (patch: Partial<SecuritySettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSecuritySettings(next);
      return next;
    });
  };

  const counts = useMemo(
    () => ({
      active: team.filter((member) => member.status === "ACTIVE").length,
      inactive: team.filter((member) => member.status === "INACTIVE").length,
      pending: team.filter((member) => member.status === "PENDING").length,
    }),
    [team]
  );

  const strongPassword =
    settings.minLength >= 8 &&
    settings.requireUppercase &&
    settings.requireLowercase &&
    settings.requireNumber &&
    settings.requireSpecial;

  const addIp = async () => {
    const result = await Swal.fire({
      title: "Allow an IP address",
      input: "text",
      inputLabel: "IPv4 address or CIDR range",
      inputPlaceholder: "203.0.113.4 or 203.0.113.0/24",
      showCancelButton: true,
      confirmButtonText: "Add",
      confirmButtonColor: "#0b0b0b",
      inputValidator: (value) => {
        const trimmed = value.trim();
        if (!/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(trimmed)) {
          return "Enter an IPv4 address, optionally with a /24 style range.";
        }
        if (settings.allowedIps.includes(trimmed)) return "That address is already allowed.";
        return null;
      },
    });
    if (!result.isConfirmed || !result.value) return;
    update({ allowedIps: [...settings.allowedIps, result.value.trim()] });
    Toast.fire({ icon: "success", title: "IP address added." });
  };

  const removeIp = (ip: string) => {
    update({ allowedIps: settings.allowedIps.filter((entry) => entry !== ip) });
  };

  const endAllSessions = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Sign out of every device?",
      text: "Every session for your account ends, including this one. You will be asked to sign in again.",
      showCancelButton: true,
      confirmButtonText: "Sign out everywhere",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    });
    if (!result.isConfirmed) return;

    setSigningOut(true);
    try {
      await signOutEverywhere();
      await logout();
    } catch (err: unknown) {
      setSigningOut(false);
      Toast.fire({
        icon: "error",
        title: err instanceof Error ? err.message : "Could not end the sessions",
      });
    }
  };

  return (
    <PageShell>
      <PageHeader
        crumb="Security"
        title="Security"
        description="Manage access security, authentication and system protection for Windrise."
      />

      <StatGrid>
        <StatCard
          icon={ShieldCheckIcon}
          label="Two-Factor"
          status={
            settings.twoFactor
              ? { label: "Enabled", dot: "bg-emerald-500" }
              : { label: "Disabled", dot: "bg-rose-500" }
          }
          caption="Emailed code at staff sign-in"
        />
        <StatCard
          icon={KeyRoundIcon}
          label="Password Policy"
          status={
            strongPassword
              ? { label: "Strong", dot: "bg-emerald-500" }
              : { label: "Weak", dot: "bg-amber-500" }
          }
          caption={`At least ${settings.minLength} characters`}
        />
        <StatCard
          icon={UserRoundCheckIcon}
          label="Accounts With Access"
          value={counts.active}
          caption={`${counts.pending} pending · ${counts.inactive} suspended`}
        />
        <StatCard
          icon={TimerIcon}
          label="Session Timeout"
          value={`${settings.sessionTimeout}m`}
          caption="Idle sessions are signed out"
        />
      </StatGrid>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <SectionCard
              title="Authentication Settings"
              description="Configure how users sign in to the system."
              bodyClassName="divide-y divide-slate-100 border-t border-slate-100"
            >
              <ToggleRow
                icon={FingerprintIcon}
                title="Two-Factor Authentication (2FA)"
                description="Require a code emailed at sign-in, on top of the password."
                checked={settings.twoFactor}
                onChange={(twoFactor) => update({ twoFactor })}
              />
              <ToggleRow
                icon={MailIcon}
                title="Login with Email"
                description="Allow staff to sign in with an email address and password."
                checked={settings.emailLogin}
                onChange={(emailLogin) => update({ emailLogin })}
              />
              <SelectRow
                icon={ClockIcon}
                title="Session Timeout"
                description="Automatically sign out inactive users."
                value={String(settings.sessionTimeout)}
                options={TIMEOUTS}
                onChange={(value) => update({ sessionTimeout: Number(value) })}
              />
              <ToggleRow
                icon={MonitorIcon}
                title="Remember Me"
                description="Let users stay signed in on trusted devices."
                checked={settings.rememberMe}
                onChange={(rememberMe) => update({ rememberMe })}
              />
            </SectionCard>

            <SectionCard
              title="Password Policy"
              description="Set rules for creating a strong password."
              bodyClassName="divide-y divide-slate-100 border-t border-slate-100"
            >
              <NumberRow
                icon={HashIcon}
                title="Minimum Length"
                description="Characters a password must have."
                value={settings.minLength}
                min={6}
                max={64}
                onChange={(minLength) => update({ minLength })}
              />
              <ToggleRow
                icon={TypeIcon}
                title="Require Uppercase"
                description="At least one uppercase letter (A–Z)."
                checked={settings.requireUppercase}
                onChange={(requireUppercase) => update({ requireUppercase })}
              />
              <ToggleRow
                icon={TypeIcon}
                title="Require Lowercase"
                description="At least one lowercase letter (a–z)."
                checked={settings.requireLowercase}
                onChange={(requireLowercase) => update({ requireLowercase })}
              />
              <ToggleRow
                icon={HashIcon}
                title="Require Number"
                description="At least one digit (0–9)."
                checked={settings.requireNumber}
                onChange={(requireNumber) => update({ requireNumber })}
              />
              <ToggleRow
                icon={SparklesIcon}
                title="Require Special Character"
                description="At least one symbol, such as ! @ # $."
                checked={settings.requireSpecial}
                onChange={(requireSpecial) => update({ requireSpecial })}
              />
              <SelectRow
                icon={TimerIcon}
                title="Password Expiry"
                description="Force a password change after a period."
                value={String(settings.passwordExpiry)}
                options={EXPIRY}
                onChange={(value) => update({ passwordExpiry: Number(value) })}
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Access Control"
            description="Manage access restrictions and login behaviour."
            bodyClassName="divide-y divide-slate-100 border-t border-slate-100"
          >
            <ToggleRow
              icon={GlobeIcon}
              title="Restrict Login by IP"
              description="Allow access only from specific IP addresses."
              checked={settings.restrictByIp}
              onChange={(restrictByIp) => update({ restrictByIp })}
            />

            <div className="flex flex-wrap items-start gap-3.5 px-5 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                <LockIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-900">Allowed IP Addresses</p>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Add trusted addresses or ranges.
                </p>
                {settings.allowedIps.length > 0 && (
                  <ul className="mt-2.5 flex flex-wrap gap-2">
                    {settings.allowedIps.map((ip) => (
                      <li
                        key={ip}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 py-1 pr-1 pl-2.5 text-[12px] font-medium tabular-nums text-slate-700"
                      >
                        {ip}
                        <button
                          type="button"
                          onClick={() => removeIp(ip)}
                          aria-label={`Remove ${ip}`}
                          className="grid h-5 w-5 cursor-pointer place-items-center rounded text-slate-400 transition-colors hover:bg-white hover:text-rose-600"
                        >
                          <TrashIcon className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <GhostButton onClick={addIp} className="shrink-0">
                <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Add IP
              </GhostButton>
            </div>

            <ToggleRow
              icon={ShieldAlertIcon}
              title="Block Suspicious Activity"
              description="Automatically block repeated failed sign-ins."
              checked={settings.blockSuspicious}
              onChange={(blockSuspicious) => update({ blockSuspicious })}
            />
            <SelectRow
              icon={ShieldAlertIcon}
              title="Max Failed Attempts"
              description="Failed sign-ins before a temporary lock."
              value={String(settings.maxFailedAttempts)}
              options={ATTEMPTS}
              onChange={(value) => update({ maxFailedAttempts: Number(value) })}
            />
            <SelectRow
              icon={TimerIcon}
              title="Lockout Duration"
              description="How long a locked account stays locked."
              value={String(settings.lockoutDuration)}
              options={LOCKOUTS}
              onChange={(value) => update({ lockoutDuration: Number(value) })}
            />
          </SectionCard>

          {/* ---------------------------- Sessions --------------------------- */}
          <SectionCard
            title="Active Sessions"
            description="The session you are signed in with right now."
            action={
              <GhostButton onClick={endAllSessions} disabled={signingOut}>
                <LogOutIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Sign out everywhere
              </GhostButton>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-y border-slate-200/80 bg-slate-50/80">
                    <Th>User</Th>
                    <Th>Device</Th>
                    <Th>Role</Th>
                    <Th>Last Active</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={user?.name ?? "You"} size={30} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-slate-900">
                            {user?.name ?? "You"}
                          </p>
                          <p className="truncate text-[12px] text-slate-500">
                            {user?.email ?? ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-slate-600">{device}</td>
                    <td className="px-5 py-3.5 text-[13px] text-slate-600">
                      {user?.role ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
                        <span
                          className="h-[7px] w-[7px] rounded-full bg-emerald-500"
                          aria-hidden="true"
                        />
                        Now
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-5 py-3.5 text-[12px] text-slate-400">
              Other devices are not listed: the API can end every session for an account, but it
              cannot yet say which ones are open.
            </p>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SecurityLogCard entries={log} />
          <RecommendationsCard
            items={recommendationsFor(settings, {
              pendingInvites: counts.pending,
              inactiveUsers: counts.inactive,
            })}
          />
        </div>
      </div>

      <p className="text-[12px] text-slate-400">
        These policies are saved in this browser. Staff sign-in already requires an emailed
        one-time code; the rest takes effect once the security API is in place.
      </p>
    </PageShell>
  );
}

export default Security;
