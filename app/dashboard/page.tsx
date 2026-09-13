import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Dashboard } from "./dashboard";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <Dashboard userName={user.name} />;
}
