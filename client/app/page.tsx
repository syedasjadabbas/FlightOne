import { redirect } from "next/navigation";

/** Product home: opens Dashboard directly for all visitors. */
export default function HomePage() {
  redirect("/dashboard");
}

