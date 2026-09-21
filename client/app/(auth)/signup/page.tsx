import { Suspense } from "react";
import dynamic from "next/dynamic";
import { AuthShell } from "../components/AuthShell";
import { AuthSessionGate } from "../components/AuthSessionGate";
import { SignupFormSkeleton } from "./components/SignupFormSkeleton";
import "../auth-form.css";
import "./signup.css";

const SignupForm = dynamic(
  () =>
    import("./components/SignupForm").then((m) => ({ default: m.SignupForm })),
  {
    loading: () => (
      <>
        <p role="status" className="sr-only">
          Loading signup form
        </p>
        <SignupFormSkeleton />
      </>
    ),
  },
);

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
        <AuthSessionGate>
          <SignupForm />
        </AuthSessionGate>
      </Suspense>
    </AuthShell>
  );
}
