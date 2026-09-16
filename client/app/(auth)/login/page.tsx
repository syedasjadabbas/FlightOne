import { Suspense } from "react";
import { AuthShell } from "../components/AuthShell";
import { LoginForm } from "./components/LoginForm";
import { LoginFormSkeleton } from "./components/LoginFormSkeleton";

export const metadata = {
  title: "Log in — FlightOne",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <>
            <p role="status" className="sr-only">
              Loading login form
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
