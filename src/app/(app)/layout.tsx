import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business } = await requireBusiness();

  return (
    <>
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <nav className="mx-auto flex w-full max-w-4xl items-center gap-6 px-6 py-3 text-sm">
          <span className="font-semibold">{business.name}</span>
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/catalog" className="hover:underline">
            Catalog
          </Link>
          <form action={signOut} className="ml-auto">
            <button className="text-neutral-500 hover:underline">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        {children}
      </div>
    </>
  );
}
