import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { FileText, Trash2, Loader2, Plus } from "lucide-react";
import { z } from "zod";

const minutesSchema = z.object({
  chairperson: z.string().trim().min(1, "Chairperson is required").max(120),
  venue: z.string().trim().min(1, "Venue is required").max(200),
  meeting_date: z.string().min(1, "Date is required"),
  minutes: z.string().trim().min(1, "Minutes content is required").max(20000),
});

interface MinutesRecord {
  id: string;
  chairperson: string;
  venue: string;
  meeting_date: string;
  minutes: string;
  created_at: string;
}

export const MinutesTab = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<MinutesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    chairperson: "",
    venue: "",
    meeting_date: new Date().toISOString().slice(0, 10),
    minutes: "",
  });

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("meeting_minutes")
      .select("id, chairperson, venue, meeting_date, minutes, created_at")
      .order("meeting_date", { ascending: false });
    if (error) {
      toast({ title: "Failed to load minutes", description: error.message, variant: "destructive" });
    } else {
      setRecords(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
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
    const { error } = await supabase.from("meeting_minutes").insert([
      { ...parsed.data, created_by: user.id },
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
          <CardTitle>Saved Minutes</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${records.length} record${records.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No minutes recorded yet. Save your first one on the left.
            </p>
          ) : (
            records.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border bg-card/50 p-4 space-y-2 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{new Date(r.meeting_date).toLocaleDateString()}</Badge>
                      <span className="text-sm font-semibold">{r.venue}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Chair: <span className="font-medium text-foreground">{r.chairperson}</span>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(r.id)}
                    aria-label="Delete minutes"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="whitespace-pre-wrap text-sm border rounded-md p-3 bg-background/60 max-h-64 overflow-auto">
                  {r.minutes}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
