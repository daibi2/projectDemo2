import { AuthForm } from "@/app/auth-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
