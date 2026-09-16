import { Suspense } from "react";
import { AuthShell } from "../components/AuthShell";
import { LoginFormSkeleton } from "../login/components/LoginFormSkeleton";
import { SignupForm } from "./components/SignupForm";

export const metadata = {
  title: "Sign up — FlightOne",
};

export default function SignupPage() {
  return (
    <AuthShell>
      <Suspense
        fallback={
          <>
            <p role="status" className="sr-only">
              Loading signup form
            </p>
            <LoginFormSkeleton />
          </>
        }
      >
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
