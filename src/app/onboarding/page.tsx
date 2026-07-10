import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { db, userId } = await getAuthContext();
  if (!userId) redirect("/login");
  const { data: business } = await db
    .from("businesses")
    .select("id")
    .maybeSingle();
  if (business) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">Register your business</h1>
        <p className="mb-6 text-sm text-neutral-500">
          This is what your AI receptionist will represent.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
