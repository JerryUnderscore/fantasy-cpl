"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ProfileSyncProps = {
  isAuthenticated: boolean;
};

export default function ProfileSync({ isAuthenticated }: ProfileSyncProps) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      sessionStorage.removeItem("profile-sync-done");
      return;
    }

    const alreadySynced = sessionStorage.getItem("profile-sync-done");
    if (alreadySynced) return;

    sessionStorage.setItem("profile-sync-done", "1");

    const runSync = async () => {
      try {
        await fetch("/api/profile/sync", { method: "POST" });
      } finally {
        router.refresh();
      }
    };

    void runSync();
  }, [isAuthenticated, router]);

  return null;
}
