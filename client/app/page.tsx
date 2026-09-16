import { redirect } from "next/navigation";

/** Product home is the Ava chat landing — no separate marketing shell. */
export default function HomePage() {
  redirect("/chat");
}
