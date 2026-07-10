"use client";

import { AuthForm } from "../auth-form";
import { signUp } from "../actions";

export default function SignupPage() {
  return (
    <AuthForm
      title="Create your owner account"
      action={signUp}
      submitLabel="Sign up"
      alt={{ prompt: "Already registered?", href: "/login", label: "Sign in" }}
    />
  );
}
