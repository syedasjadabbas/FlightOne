import { Suspense } from "react";
import { AuthShell } from "../components/AuthShell";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { ResetPasswordFormSkeleton } from "./components/ResetPasswordFormSkeleton";

export const metadata = {
  title: "Reset password — FlightOne",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <>
            <p role="status" className="sr-only">
              Loading reset form
            </p>
            <ResetPasswordFormSkeleton />
          </>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
