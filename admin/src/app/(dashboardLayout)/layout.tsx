

import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { Header } from "@/components/sidebar/Header";
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import LogoutSuccessToast from "@/components/modules/auth/LogoutSuccessToast";
import { NotificationsProvider } from "@/contexts/NotificationsContext";

import { cookies } from "next/headers";
import { ReactNode, Suspense } from "react";

// Nothing behind the dashboard is publishable HTML: every page is per-admin
// and reads live data. Prerendering it also made `next build` fetch the API,
// so a deploy failed whenever the API happened to be down at build time.
export const dynamic = "force-dynamic";

const DashboardLayout = async ({children} : {children : ReactNode}) => {
    // The sidebar writes its expanded/collapsed choice to this cookie. Reading
    // it here renders the page in that state from the first byte, instead of
    // opening wide and snapping shut after hydration.
    const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

    return (
        <div>
            <Suspense>
                <LogoutSuccessToast />
            </Suspense>
            <NotificationsProvider>
                <SidebarProvider
                    defaultOpen={sidebarOpen}
                    style={
                        {
                            "--sidebar-width": "calc(var(--spacing) * 61)",
                            // The collapsed icon bar.
                            "--sidebar-width-icon": "calc(var(--spacing) * 16)",
                            "--header-height": "calc(var(--spacing) * 12)",
                        } as React.CSSProperties
                    }
                >
                    <AppSidebar  />
                    <SidebarInset>
                        <Header />
                        <div className="flex flex-1 flex-col bg-[#f3f5f9]">
                            <div className="@container/main flex flex-1 flex-col gap-2">
                                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 ">
                                    {children}
                                </div>
                            </div>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </NotificationsProvider>
        </div>
    );
};

export default DashboardLayout;