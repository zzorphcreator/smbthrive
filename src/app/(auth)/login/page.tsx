"use client";

import { AuthForm } from "../auth-form";
import { signIn } from "../actions";

export default function LoginPage() {
  return (
    <AuthForm
      title="Sign in to your dashboard"
      action={signIn}
      submitLabel="Sign in"
      alt={{ prompt: "No account?", href: "/signup", label: "Sign up" }}
    />
  );
}
