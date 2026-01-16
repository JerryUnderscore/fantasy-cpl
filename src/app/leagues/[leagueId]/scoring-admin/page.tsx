import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default function ScoringAdminPage() {
  redirect("/scoring-admin");
}
