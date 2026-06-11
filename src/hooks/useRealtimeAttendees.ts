import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Polls attendee counts every 5s. Realtime broadcasting of the attendees
 * table was disabled for privacy reasons (any subscriber could otherwise
 * receive live attendee PII).
 */
export const useRealtimeAttendees = (sessionId?: string) => {
  const queryClient = useQueryClient();
  const [liveCount, setLiveCount] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ["attendees-count", sessionId ?? "all"],
    queryFn: async () => {
      const query = supabase.from("attendees").select("*", { count: "exact", head: true });
      if (sessionId) query.eq("session_id", sessionId);
      const { count } = await query;
      return count ?? 0;
    },
    refetchInterval: 5000,
    enabled: true,
  });

  useEffect(() => {
    if (typeof data === "number") {
      setLiveCount(data);
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ["attendees", sessionId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["attendees"] });
      }
    }
  }, [data, sessionId, queryClient]);

  return { liveCount };
};
