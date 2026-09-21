import { Suspense } from "react";
import { AuthShell } from "../components/AuthShell";
import { SignupForm } from "./components/SignupForm";
import { SignupFormSkeleton } from "./components/SignupFormSkeleton";
import "../auth-form.css";
import "./signup.css";

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
            <SignupFormSkeleton />
          </>
        }
      >
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
