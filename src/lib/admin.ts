import { prisma } from "@/lib/prisma";
import { requireSupabaseUser } from "@/lib/auth";

export const requireAdminUser = async () => {
  const user = await requireSupabaseUser();

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, isAdmin: true },
  });

  if (!profile) {
    const error = new Error("Unauthorized");
    (error as { status?: number }).status = 401;
    throw error;
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const isAdmin =
    profile.isAdmin ||
    (adminEmail && user.email && user.email.toLowerCase() === adminEmail);

  if (!isAdmin) {
    const error = new Error("Forbidden");
    (error as { status?: number }).status = 403;
    throw error;
  }

  return { user, profile };
};
