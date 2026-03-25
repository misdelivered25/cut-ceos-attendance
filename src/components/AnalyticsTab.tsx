import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Area, AreaChart } from "recharts";
import { Loader2, TrendingUp, Users, Calendar, Award } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, eachWeekOfInterval, subMonths } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(350 80% 55%)",
];

export const AnalyticsTab = () => {
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["analytics-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: attendees, isLoading: attendeesLoading } = useQuery({
    queryKey: ["analytics-attendees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendees")
        .select("*, member:members(id, full_name, member_id)")
        .order("scanned_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = sessionsLoading || attendeesLoading;

  // Attendance over time (weekly trend)
  const trendData = useMemo(() => {
    if (!attendees?.length) return [];
    const dates = attendees.map((a) => parseISO(a.scanned_at));
    const sixMonthsAgo = subMonths(new Date(), 6);
    const start = dates[0] > sixMonthsAgo ? sixMonthsAgo : dates[0];
    const weeks = eachWeekOfInterval({ start, end: new Date() });

    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart);
      const count = attendees.filter((a) => {
        const d = parseISO(a.scanned_at);
        return d >= weekStart && d <= weekEnd;
      }).length;
      return {
        week: format(weekStart, "MMM dd"),
        attendees: count,
      };
    });
  }, [attendees]);

  // Most active members (top 10)
  const topMembers = useMemo(() => {
    if (!attendees?.length) return [];
    const freq: Record<string, { name: string; count: number }> = {};
    attendees.forEach((a) => {
      const key = a.phone;
      const name = (a.member as any)?.full_name || a.name;
      if (!freq[key]) freq[key] = { name, count: 0 };
      freq[key].count++;
    });
    return Object.values(freq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [attendees]);

  // Session comparison (attendance per session)
  const sessionComparison = useMemo(() => {
    if (!sessions?.length || !attendees?.length) return [];
    return sessions.map((s) => ({
      name: s.title.length > 15 ? s.title.slice(0, 15) + "…" : s.title,
      fullName: s.title,
      attendees: attendees.filter((a) => a.session_id === s.id).length,
      mode: s.mode,
    }));
  }, [sessions, attendees]);

  // Mode distribution
  const modeDistribution = useMemo(() => {
    if (!sessions?.length) return [];
    const timed = sessions.filter((s) => s.mode === "timed").length;
    const open = sessions.filter((s) => s.mode === "open").length;
    return [
      { name: "Timed", value: timed },
      { name: "Open", value: open },
    ].filter((d) => d.value > 0);
  }, [sessions]);

  // Summary stats
  const stats = useMemo(() => {
    const totalSessions = sessions?.length || 0;
    const totalAttendees = attendees?.length || 0;
    const uniquePhones = new Set(attendees?.map((a) => a.phone)).size;
    const avgPerSession = totalSessions ? Math.round(totalAttendees / totalSessions) : 0;
    return { totalSessions, totalAttendees, uniquePhones, avgPerSession };
  }, [sessions, attendees]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sessions?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg text-muted-foreground">No data yet</p>
          <p className="text-sm text-muted-foreground">Create sessions and collect attendance to see analytics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSessions}</p>
                <p className="text-xs text-muted-foreground">Sessions</p>
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
                <p className="text-2xl font-bold">{stats.totalAttendees}</p>
                <p className="text-xs text-muted-foreground">Check-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Award className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.uniquePhones}</p>
                <p className="text-xs text-muted-foreground">Unique People</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <TrendingUp className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgPerSession}</p>
                <p className="text-xs text-muted-foreground">Avg/Session</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Attendance Trend
          </CardTitle>
          <CardDescription>Weekly attendance over the past 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ attendees: { label: "Attendees", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="attendeeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="attendees" stroke="hsl(var(--primary))" fill="url(#attendeeGradient)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Most Active Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5" />
              Most Active Members
            </CardTitle>
            <CardDescription>Top 10 by attendance frequency</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={Object.fromEntries(topMembers.map((m, i) => [`member${i}`, { label: m.name, color: CHART_COLORS[i % CHART_COLORS.length] }]))}
              className="h-[300px] w-full"
            >
              <BarChart data={topMembers} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {topMembers.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Session Mode Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Session Modes
            </CardTitle>
            <CardDescription>Distribution of session types</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ChartContainer
              config={{
                Timed: { label: "Timed", color: CHART_COLORS[0] },
                Open: { label: "Open", color: CHART_COLORS[1] },
              }}
              className="h-[300px] w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={modeDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                  {modeDistribution.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Session Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Session Comparison
          </CardTitle>
          <CardDescription>Attendance count per session</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ attendees: { label: "Attendees", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
            <BarChart data={sessionComparison} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 10, angle: -35, textAnchor: "end" }} className="fill-muted-foreground" interval={0} />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="attendees" radius={[4, 4, 0, 0]}>
                {sessionComparison.map((entry, i) => (
                  <Cell key={i} fill={entry.mode === "timed" ? CHART_COLORS[0] : CHART_COLORS[1]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};
