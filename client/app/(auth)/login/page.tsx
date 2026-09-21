import { Suspense } from "react";
import { AuthShell } from "../components/AuthShell";
import { LoginForm } from "./components/LoginForm";
import { LoginFormSkeleton } from "./components/LoginFormSkeleton";
import "../auth-form.css";

export const metadata = {
  title: "Log in — FlightOne",
  description: "Sign in to FlightOne to access your trips and bookings.",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <>
            <p role="status" className="sr-only">
              Loading sign-in form
            </p>
            <LoginFormSkeleton />
          </>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
