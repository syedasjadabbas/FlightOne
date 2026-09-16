import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_PRESENCE_COOKIE } from "@/store/auth.store";

/** Product home: authenticated users land on the Dashboard; guests land on Chat. */
export default async function HomePage() {
  const cookieStore = await cookies();
  const hasAuth =
    cookieStore.get(AUTH_PRESENCE_COOKIE)?.value === "1" ||
    cookieStore.get("fo_auth")?.value === "1" ||
    Boolean(cookieStore.get("fo_access")?.value);

  if (hasAuth) {
    redirect("/dashboard");
  }

  redirect("/chat");
}
