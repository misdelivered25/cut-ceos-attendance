import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Calendar, Activity, TrendingUp, Clock, CheckCircle2, Radio } from "lucide-react";
import { format, isToday, startOfDay, endOfDay } from "date-fns";

export const OverviewTab = () => {
  // Active sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["overview-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
  });

  // All attendees (for today's count + recent activity)
  const { data: attendees, isLoading: attendeesLoading } = useQuery({
    queryKey: ["overview-attendees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendees")
        .select("*, session:sessions(title)")
        .order("scanned_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
  });

  // Total members
  const { data: members } = useQuery({
    queryKey: ["overview-members"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const isLoading = sessionsLoading || attendeesLoading;

  const stats = useMemo(() => {
    const now = new Date();
    const activeSessions = sessions?.filter((s) => {
      if (!s.is_active) return false;
      if (s.time_limit_enabled && s.end_time && new Date(s.end_time) < now) return false;
      return true;
    }) ?? [];

    const todayCheckins = attendees?.filter((a) => isToday(new Date(a.scanned_at))).length ?? 0;
    const recentActivity = attendees?.slice(0, 10) ?? [];
    const totalSessions = sessions?.length ?? 0;

    return { activeSessions, todayCheckins, recentActivity, totalSessions };
  }, [sessions, attendees]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Radio className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeSessions.length}</p>
                <p className="text-xs text-muted-foreground">Active Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.todayCheckins}</p>
                <p className="text-xs text-muted-foreground">Check-ins Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Users className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSessions}</p>
                <p className="text-xs text-muted-foreground">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              Live Sessions
            </CardTitle>
            <CardDescription>Sessions currently accepting attendance</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.activeSessions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No active sessions right now</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.activeSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                  >
                    <div>
                      <p className="font-medium text-sm">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Started {format(new Date(s.start_time), "h:mm a")}
                        {s.time_limit_enabled && s.end_time && (
                          <> · Closes {format(new Date(s.end_time), "h:mm a")}</>
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-green-700 border-green-300 dark:text-green-400 text-xs">
                      {s.mode}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Recent Check-ins
            </CardTitle>
            <CardDescription>Latest 10 attendance submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No attendance recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.recentActivity.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{(a.session as any)?.title ?? "—"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(a.scanned_at), "h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
