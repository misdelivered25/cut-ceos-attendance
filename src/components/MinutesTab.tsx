import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  FileText,
  Trash2,
  Loader2,
  Plus,
  Link2,
  Eye,
  Calendar as CalendarIcon,
  Search,
  Upload,
  Sparkles,
} from "lucide-react";
import { z } from "zod";
import mammoth from "mammoth";

const NO_SESSION = "__none__";
const ALL_SESSIONS = "__all__";

const minutesSchema = z.object({
  chairperson: z.string().trim().min(1, "Chairperson is required").max(120),
  venue: z.string().trim().min(1, "Venue is required").max(200),
  meeting_date: z.string().min(1, "Date is required"),
  minutes: z.string().trim().min(1, "Minutes content is required").max(20000),
});

interface SessionOption {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
}

interface MinutesRecord {
  id: string;
  chairperson: string;
  venue: string;
  meeting_date: string;
  minutes: string;
  created_at: string;
  session_id: string | null;
}

export const MinutesTab = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<MinutesRecord[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterSessionId, setFilterSessionId] = useState<string>(ALL_SESSIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    chairperson: "",
    venue: "",
    meeting_date: new Date().toISOString().slice(0, 10),
    minutes: "",
    session_id: NO_SESSION,
  });

  const sessionMap = useMemo(() => {
    const m = new Map<string, string>();
    sessions.forEach((s) => m.set(s.id, s.title));
    return m;
  }, [sessions]);

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("meeting_minutes")
      .select("id, chairperson, venue, meeting_date, minutes, created_at, session_id")
      .order("meeting_date", { ascending: false });
    if (error) {
      toast({ title: "Failed to load minutes", description: error.message, variant: "destructive" });
    } else {
      setRecords(data ?? []);
    }
    setLoading(false);
  };

  const [viewSessionId, setViewSessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, title, start_time, end_time")
      .order("created_at", { ascending: false });
    if (!error && data) setSessions(data);
  };

  useEffect(() => {
    fetchRecords();
    fetchSessions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsed = minutesSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Please check the form",
        description: parsed.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { chairperson, venue, meeting_date, minutes } = parsed.data;
    const { error } = await supabase.from("meeting_minutes").insert([
      {
        chairperson,
        venue,
        meeting_date,
        minutes,
        created_by: user.id,
        session_id: form.session_id === NO_SESSION ? null : form.session_id,
      },
    ]);
    setSaving(false);

    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Minutes saved", description: "Meeting minutes recorded successfully." });
    setForm({
      chairperson: "",
      venue: "",
      meeting_date: new Date().toISOString().slice(0, 10),
      minutes: "",
      session_id: NO_SESSION,
    });
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("meeting_minutes").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: "Minutes entry removed." });
    setRecords((r) => r.filter((x) => x.id !== id));
  };

  const filteredRecords = useMemo(() => {
    if (filterSessionId === ALL_SESSIONS) return records;
    if (filterSessionId === NO_SESSION) return records.filter((r) => !r.session_id);
    return records.filter((r) => r.session_id === filterSessionId);
  }, [records, filterSessionId]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            New Meeting Minutes
          </CardTitle>
          <CardDescription>Record the chair, venue, date, and notes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chairperson">Chair of the Meeting</Label>
              <Input
                id="chairperson"
                value={form.chairperson}
                onChange={(e) => setForm({ ...form, chairperson: e.target.value })}
                placeholder="Enter chairperson name"
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="Enter meeting venue"
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting_date">Meeting Date</Label>
              <Input
                id="meeting_date"
                type="date"
                value={form.meeting_date}
                onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session_link">Link to Session (optional)</Label>
              <Select
                value={form.session_id}
                onValueChange={(v) => setForm({ ...form, session_id: v })}
              >
                <SelectTrigger id="session_link">
                  <SelectValue placeholder="No session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SESSION}>No session</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minutes">Minutes of the Meeting</Label>
              <Textarea
                id="minutes"
                rows={10}
                value={form.minutes}
                onChange={(e) => setForm({ ...form, minutes: e.target.value })}
                placeholder="Write the meeting minutes here..."
                maxLength={20000}
                required
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Save Minutes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Saved Minutes</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading…"
                  : `${filteredRecords.length} of ${records.length} record${records.length === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
            <div className="w-full sm:w-64">
              <Select value={filterSessionId} onValueChange={setFilterSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SESSIONS}>All sessions</SelectItem>
                  <SelectItem value={NO_SESSION}>Unlinked</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No minutes match this filter.
            </p>
          ) : (
            filteredRecords.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border bg-card/50 p-4 space-y-2 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{new Date(r.meeting_date).toLocaleDateString()}</Badge>
                      <span className="text-sm font-semibold">{r.venue}</span>
                      {r.session_id && sessionMap.has(r.session_id) && (
                        <Badge variant="outline" className="gap-1">
                          <Link2 className="h-3 w-3" />
                          {sessionMap.get(r.session_id)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Chair: <span className="font-medium text-foreground">{r.chairperson}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.session_id && sessionMap.has(r.session_id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewSessionId(r.session_id)}
                        aria-label="View session"
                        title="View session"
                      >
                        <Eye className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(r.id)}
                      aria-label="Delete minutes"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="whitespace-pre-wrap text-sm border rounded-md p-3 bg-background/60 max-h-64 overflow-auto">
                  {r.minutes}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <SessionDetailsDialog
        sessionId={viewSessionId}
        sessions={sessions}
        records={records}
        onClose={() => setViewSessionId(null)}
      />
    </div>
  );
};

interface SessionDetailsDialogProps {
  sessionId: string | null;
  sessions: SessionOption[];
  records: MinutesRecord[];
  onClose: () => void;
}

const SessionDetailsDialog = ({ sessionId, sessions, records, onClose }: SessionDetailsDialogProps) => {
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const linkedCount = sessionId ? records.filter((r) => r.session_id === sessionId).length : 0;

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  return (
    <Dialog open={!!sessionId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            {session?.title ?? "Session"}
          </DialogTitle>
          <DialogDescription>Session overview and linked minutes.</DialogDescription>
        </DialogHeader>
        {session ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-[100px_1fr] gap-y-2">
              <span className="text-muted-foreground">Starts</span>
              <span className="font-medium">{fmt(session.start_time)}</span>
              <span className="text-muted-foreground">Ends</span>
              <span className="font-medium">{fmt(session.end_time)}</span>
              <span className="text-muted-foreground">Linked minutes</span>
              <span>
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {linkedCount}
                </Badge>
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Session not found.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
