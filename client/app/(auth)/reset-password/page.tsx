import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { AuthShell } from "../components/AuthShell";
import { ResetPasswordForm } from "./components/ResetPasswordForm";

export const metadata = {
  title: "Reset password — FlightOne",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <div className="fo-auth__loading" role="status">
            <Spinner label="Loading reset form" />
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
