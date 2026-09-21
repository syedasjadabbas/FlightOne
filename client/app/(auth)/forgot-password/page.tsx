import { AuthShell } from "../components/AuthShell";
import { ForgotPasswordForm } from "./components/ForgotPasswordForm";

export const metadata = {
  title: "Forgot password — FlightOne",
  description: "Request a one-time code to reset your FlightOne password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
