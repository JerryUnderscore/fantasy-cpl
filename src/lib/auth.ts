import { createClient } from "@/lib/supabase/server";

export async function getSupabaseUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function requireSupabaseUser() {
  const user = await getSupabaseUser();

  if (!user) {
    const error = new Error("Unauthorized");
    (error as { status?: number }).status = 401;
    throw error;
  }

  return user;
}
