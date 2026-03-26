import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

interface ParsedMember {
  full_name: string;
  phone: string;
  email: string;
  program: string;
  department: string;
  status: "pending" | "success" | "error" | "duplicate";
  message?: string;
}

interface ImportMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportMembersDialog = ({ open, onOpenChange }: ImportMembersDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedMember[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const reset = () => {
    setParsedData([]);
    setImporting(false);
    setImported(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

        if (rows.length === 0) {
          toast.error("No data found in file");
          return;
        }

        const members: ParsedMember[] = rows.map((row) => {
          // Flexible column matching (case-insensitive)
          const get = (keys: string[]) => {
            for (const key of keys) {
              const match = Object.keys(row).find((k) => k.toLowerCase().trim() === key.toLowerCase());
              if (match && row[match]) return String(row[match]).trim();
            }
            return "";
          };

          return {
            full_name: get(["full name", "full_name", "name", "fullname"]),
            phone: get(["phone", "phone number", "phone_number", "tel", "mobile"]),
            email: get(["email", "email address", "e-mail"]),
            program: get(["program", "programme", "course"]),
            department: get(["department", "dept", "faculty"]),
            status: "pending" as const,
          };
        }).filter((m) => m.full_name && m.phone);

        if (members.length === 0) {
          toast.error("No valid members found. Ensure columns include 'Full Name' and 'Phone'.");
          return;
        }

        setParsedData(members);
        setImported(false);
        toast.success(`${members.length} members parsed from file`);
      } catch {
        toast.error("Failed to parse file. Please use a valid Excel or CSV file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);

    const updated = [...parsedData];

    for (let i = 0; i < updated.length; i++) {
      const m = updated[i];
      try {
        // Generate member ID
        const { data: memberId, error: idError } = await supabase.rpc("generate_member_id");
        if (idError) throw idError;

        const { error } = await supabase.from("members").insert({
          member_id: memberId,
          full_name: m.full_name,
          phone: m.phone,
          email: m.email || null,
          program: m.program || null,
          department: m.department || null,
          created_by: user.id,
        });

        if (error) {
          if (error.code === "23505") {
            updated[i] = { ...m, status: "duplicate", message: "Already exists" };
          } else {
            throw error;
          }
        } else {
          updated[i] = { ...m, status: "success", message: memberId };
        }
      } catch (err: any) {
        updated[i] = { ...m, status: "error", message: err.message };
      }
      setParsedData([...updated]);
    }

    setImporting(false);
    setImported(true);
    queryClient.invalidateQueries({ queryKey: ["members"] });

    const successCount = updated.filter((m) => m.status === "success").length;
    const dupCount = updated.filter((m) => m.status === "duplicate").length;
    toast.success(`Imported ${successCount} members${dupCount ? `, ${dupCount} duplicates skipped` : ""}`);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const statusIcon = (status: ParsedMember["status"]) => {
    switch (status) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error": return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "duplicate": return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Members
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file with columns: Full Name, Phone, Email (optional), Program (optional), Department (optional)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* File input */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload className="mr-2 h-4 w-4" />
              {parsedData.length > 0 ? "Choose Another File" : "Select File"}
            </Button>
            {parsedData.length > 0 && (
              <Badge variant="secondary">{parsedData.length} members found</Badge>
            )}
          </div>

          {/* Preview table */}
          {parsedData.length > 0 && (
            <div className="flex-1 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{m.full_name}</TableCell>
                      <TableCell>{m.phone}</TableCell>
                      <TableCell className="text-sm">{m.email || "—"}</TableCell>
                      <TableCell className="text-sm">{m.program || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {statusIcon(m.status)}
                          <span className="text-xs text-muted-foreground">
                            {m.status === "pending" ? "Ready" : m.message}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {imported ? "Close" : "Cancel"}
          </Button>
          {parsedData.length > 0 && !imported && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />Import {parsedData.length} Members</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
