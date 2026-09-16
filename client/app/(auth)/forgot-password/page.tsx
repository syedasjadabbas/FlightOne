import { AuthShell } from "../components/AuthShell";
import { ForgotPasswordForm } from "./components/ForgotPasswordForm";

export const metadata = {
  title: "Forgot password — FlightOne",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
