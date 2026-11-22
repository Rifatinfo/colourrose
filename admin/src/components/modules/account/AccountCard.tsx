import type { ReactNode } from "react";

/**
 * The bordered panel the account pages are built from — a titled section with
 * an optional control on the right of its header.
 */
export function AccountCard({
    title,
    action,
    children,
    className = "",
}: {
    title?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={`rounded-lg border border-[#e6e6e6] bg-white ${className}`}
        >
            {(title || action) && (
                <header className="flex items-center justify-between gap-4 border-b border-[#efefef] px-5 py-4">
                    {title && (
                        <h2 className="text-[14px] font-medium text-[#1a1a1a]">
                            {title}
                        </h2>
                    )}
                    {action}
                </header>
            )}
            <div className="px-5 py-5">{children}</div>
        </section>
    );
}

/** A label above its value, which is how every read-only field here is set. */
export function FieldValue({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    return (
        <div>
            <dt className="text-[11px] text-[#9a9a9a]">{label}</dt>
            <dd className="mt-1 text-[13px] text-[#1a1a1a]">
                {value?.trim() ? value : "N/A"}
            </dd>
        </div>
    );
}

/** The empty state each list page falls back to. */
export function AccountEmptyState({
    icon,
    title,
    description,
    action,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4f4f4] text-[#8f8f8f]">
                {icon}
            </span>
            <p className="text-[13px] font-medium text-[#1a1a1a]">{title}</p>
            <p className="max-w-[320px] text-[12px] leading-relaxed text-[#8f8f8f]">
                {description}
            </p>
            {action}
        </div>
    );
}
