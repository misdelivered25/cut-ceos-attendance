import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useRealtimeAttendees = (sessionId?: string) => {
  const queryClient = useQueryClient();
  const [liveCount, setLiveCount] = useState<number | null>(null);

  useEffect(() => {
    // Subscribe to realtime changes on attendees table
    const channel = supabase
      .channel(`attendees-${sessionId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendees",
          ...(sessionId && { filter: `session_id=eq.${sessionId}` }),
        },
        async (payload) => {
          console.log("Realtime attendee update:", payload);
          
          // Invalidate relevant queries
          if (sessionId) {
            queryClient.invalidateQueries({ queryKey: ["attendees", sessionId] });
            queryClient.invalidateQueries({ queryKey: ["attendees-count", sessionId] });
          } else {
            queryClient.invalidateQueries({ queryKey: ["attendees"] });
          }

          // Fetch updated count
          if (sessionId) {
            const { count } = await supabase
              .from("attendees")
              .select("*", { count: "exact", head: true })
              .eq("session_id", sessionId);
            
            setLiveCount(count || 0);
          }
        }
      )
      .subscribe();

    // Get initial count
    if (sessionId) {
      supabase
        .from("attendees")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .then(({ count }) => {
          setLiveCount(count || 0);
        });
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  return { liveCount };
};
