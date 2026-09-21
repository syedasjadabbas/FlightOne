import dynamic from "next/dynamic";
import { Suspense } from "react";
import { AuthShell } from "../components/AuthShell";
import { AuthSessionGate } from "../components/AuthSessionGate";
import { LoginFormSkeleton } from "./components/LoginFormSkeleton";
import "../auth-form.css";

const LoginForm = dynamic(
  () =>
    import("./components/LoginForm").then((m) => ({ default: m.LoginForm })),
  {
    loading: () => (
      <>
        <p role="status" className="sr-only">
          Loading sign-in form
        </p>
        <LoginFormSkeleton />
      </>
    ),
  },
);

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
        <AuthSessionGate>
          <LoginForm />
        </AuthSessionGate>
      </Suspense>
    </AuthShell>
  );
}
