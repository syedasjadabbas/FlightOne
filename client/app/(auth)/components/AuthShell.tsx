import type { ReactNode } from "react";
import { SiteChromeFooter } from "@/components/SiteChromeFooter";
import { SiteNav } from "@/components/SiteNav";

/** Shared chrome for login / signup / password flows — one job, brand atmosphere. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="fo-auth relative flex min-h-screen flex-col">
      <div className="fo-auth__atmosphere" aria-hidden>
        <span className="fo-auth__horizon" />
        <span className="fo-auth__routes" />
      </div>
      <div className="fo-auth__chrome relative z-10 flex min-h-dvh flex-1 flex-col justify-between">
        <SiteNav />
        <div className="fo-auth__frame">
          <div className="fo-auth__column">{children}</div>
        </div>
        <SiteChromeFooter variant="auth" />
      </div>
    </main>
  );
}
