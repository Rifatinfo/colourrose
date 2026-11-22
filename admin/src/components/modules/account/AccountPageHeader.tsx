import type { ReactNode } from "react";

type AccountPageHeaderProps = {
    /** Small tracked line above the title, e.g. "YOUR ORDERS". */
    eyebrow?: string;
    title: ReactNode;
    subtitle?: string;
    /** The three short lines set into the right edge on the wider pages. */
    accent?: readonly string[];
};

/**
 * The banner every account page opens with.
 *
 * One component rather than a block per page: the pages were drawn with the
 * same band at the same height, and repeating it is how the eyebrow ends up
 * a different size on one of them.
 */
export function AccountPageHeader({
    eyebrow,
    title,
    subtitle,
    accent,
}: AccountPageHeaderProps) {
    return (
        <header className="relative flex min-h-[132px] items-center overflow-hidden bg-[#e9e9e9] px-6 py-8 font-dm-sans sm:min-h-[168px] sm:px-10">
            <div className="relative z-10 max-w-[560px]">
                {eyebrow && (
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#6f6f6f]">
                        {eyebrow}
                    </p>
                )}
                <h1 className="mt-2 text-[22px] leading-tight tracking-[-0.01em] text-[#1a1a1a] sm:text-[30px]">
                    {title}
                </h1>
                {subtitle && (
                    <p className="mt-2 text-[12px] leading-relaxed text-[#6f6f6f] sm:text-[13px]">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Decorative, and the first thing to go when the band gets narrow:
                it sits behind the title at tablet widths otherwise. */}
            {accent && (
                <div
                    aria-hidden="true"
                    className="absolute right-8 top-1/2 hidden -translate-y-1/2 text-right lg:block"
                >
                    {accent.map((line) => (
                        <p
                            key={line}
                            className="text-[9px] uppercase leading-[1.9] tracking-[0.24em] text-[#8a8a8a]"
                        >
                            {line}
                        </p>
                    ))}
                    <span className="mt-2 ml-auto block h-px w-8 bg-[#a5a5a5]" />
                </div>
            )}
        </header>
    );
}
