import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

interface ManualAttendeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionTitle: string;
}

interface ParsedRow {
  name: string;
  phone: string;
  student_id: string;
  email: string;
}

const pick = (row: Record<string, any>, keys: string[]) => {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[^a-z]/g, "");
    if (keys.includes(norm)) {
      const v = row[k];
      return v === undefined || v === null ? "" : String(v).trim();
    }
  }
  return "";
};

export const ManualAttendeeDialog = ({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
}: ManualAttendeeDialogProps) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", student_id: "", email: "" });
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["attendees", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["attendees-count", sessionId] });
  };

  const findMemberId = async (phone: string, email: string) => {
    let query = supabase.from("members").select("id").eq("is_active", true).limit(1);
    if (phone) query = query.eq("phone", phone);
    else if (email) query = query.eq("email", email);
    else return null;
    const { data } = await query.maybeSingle();
    return data?.id ?? null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    const phone = formData.phone.trim();
    const student_id = formData.student_id.trim();
    const email = formData.email.trim().toLowerCase();

    if (!name || !phone) {
      toast.error("Name and phone are required");
      return;
    }

    setLoading(true);
    try {
      const memberId = await findMemberId(phone, email);
      const { error } = await supabase.from("attendees").insert({
        session_id: sessionId,
        name,
        phone,
        student_id: student_id || null,
        email: email || null,
        member_id: memberId,
        ip_address: "manual-entry",
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("This participant is already registered for this session");
        } else {
          throw error;
        }
      } else {
        toast.success(`${name} added to session`);
        setFormData({ name: "", phone: "", student_id: "", email: "" });
        refresh();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add attendee");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      const parsed: ParsedRow[] = json
        .map((r) => ({
          name: pick(r, ["name", "fullname", "participant", "participantname"]),
          phone: pick(r, ["phone", "phonenumber", "mobile", "contact", "cell"]),
          student_id: pick(r, ["studentid", "studentnumber", "regnumber", "registrationnumber", "id"]),
          email: pick(r, ["email", "emailaddress"]).toLowerCase(),
        }))
        .filter((r) => r.name);

      if (parsed.length === 0) {
        toast.error("No valid rows found. Ensure the sheet has a Name column.");
        return;
      }
      setRows(parsed);
      toast.success(`${parsed.length} rows ready to import`);
    } catch (e: any) {
      toast.error("Could not read that file");
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    let added = 0;
    let skipped = 0;

    for (const row of rows) {
      const memberId = await findMemberId(row.phone, row.email);
      const { error } = await supabase.from("attendees").insert({
        session_id: sessionId,
        name: row.name,
        phone: row.phone || "N/A",
        student_id: row.student_id || null,
        email: row.email || null,
        member_id: memberId,
        ip_address: "manual-import",
      });
      if (error) skipped++;
      else added++;
    }

    setImporting(false);
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
    refresh();
    toast.success(`Imported ${added} participant${added === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} duplicate/invalid` : ""}`);
    if (added > 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Participants
          </DialogTitle>
          <DialogDescription>
            Add participants to "{sessionTitle}" manually or from a spreadsheet
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Single Entry
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Import File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="attendee-name">Full Name *</Label>
                  <Input
                    id="attendee-name"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee-phone">Phone Number *</Label>
                  <Input
                    id="attendee-phone"
                    type="tel"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee-student-id">Student ID</Label>
                  <Input
                    id="attendee-student-id"
                    placeholder="Enter student ID"
                    value={formData.student_id}
                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attendee-email">Email Address</Label>
                  <Input
                    id="attendee-email"
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Add Participant
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="import">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="attendee-file">Excel or CSV file</Label>
                <Input
                  id="attendee-file"
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Columns recognised: Name, Phone, Student ID, Email. Duplicates are skipped automatically.
                </p>
              </div>

              {rows.length > 0 && (
                <div className="rounded-md border max-h-52 overflow-auto text-sm">
                  <div className="sticky top-0 bg-background border-b px-3 py-2">
                    <Badge variant="outline">{rows.length} rows ready</Badge>
                  </div>
                  <ul className="divide-y">
                    {rows.slice(0, 50).map((r, i) => (
                      <li key={i} className="px-3 py-1.5 flex justify-between gap-2">
                        <span className="font-medium truncate">{r.name}</span>
                        <span className="text-muted-foreground truncate">{r.phone || r.student_id || r.email || "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={importing || rows.length === 0}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import {rows.length > 0 ? `${rows.length} ` : ""}Participants
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
