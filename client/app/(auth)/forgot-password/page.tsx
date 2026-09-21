import { Suspense } from "react";
import { AuthShell } from "../components/AuthShell";
import { AuthSessionGate } from "../components/AuthSessionGate";
import { ForgotPasswordForm } from "./components/ForgotPasswordForm";
import "../auth-form.css";

export const metadata = {
  title: "Forgot password — FlightOne",
  description: "Request a one-time code to reset your FlightOne password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <p role="status" className="sr-only">
            Loading password recovery
          </p>
        }
      >
        <AuthSessionGate>
          <ForgotPasswordForm />
        </AuthSessionGate>
      </Suspense>
    </AuthShell>
  );
}
