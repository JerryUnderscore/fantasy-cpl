import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type UseDraftRealtimeOptions = {
  draftId: string | null;
  onChange: () => void;
};

export const useDraftRealtime = ({ draftId, onChange }: UseDraftRealtimeOptions) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!draftId) {
      setIsConnected(false);
      return undefined;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`draft-${draftId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Draft",
          filter: `id=eq.${draftId}`,
        },
        () => onChange(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "DraftPick",
          filter: `draftId=eq.${draftId}`,
        },
        () => onChange(),
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [draftId, onChange]);

  return { isConnected };
};
