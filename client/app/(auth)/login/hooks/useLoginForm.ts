"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoginMutation } from "@/lib/api/auth.api";

/** Colocated to `/login` only — do not import this outside the login page. */
export function useLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [login, { isLoading, error }] = useLoginMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await login({ email, password }).unwrap();
      router.replace(searchParams.get("redirect") || "/chat");
    } catch {
      // Failure surfaces via `error` below — nothing else to do here.
    }
  }

  const errorKind: "credentials" | "unverified" | "unknown" | null = !error
    ? null
    : "status" in error && error.status === 401
      ? "credentials"
      : "status" in error && error.status === 403
        ? "unverified"
        : "unknown";

  const errorMessage =
    errorKind === "credentials"
      ? "Incorrect email or password."
      : errorKind === "unverified"
        ? "Email address not verified. Please verify your email to log in."
        : errorKind === "unknown"
          ? "Something went wrong — please try again."
          : null;

  return {
    email,
    setEmail,
    password,
    setPassword,
    handleSubmit,
    isLoading,
    errorMessage,
    errorKind,
  };
}
