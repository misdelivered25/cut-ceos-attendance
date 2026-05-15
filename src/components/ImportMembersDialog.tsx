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
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, Sparkles, Link } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import { ImportDiffView } from "./ImportDiffView";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface ParsedMember {
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

// Improved PDF parser with multiple strategies
const parsePdfText = (text: string): ParsedMember[] => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const members: ParsedMember[] = [];
  const phoneRegex = /(\+?\d[\d\s\-()]{7,})/;
  const emailRegex = /[\w.\-]+@[\w.\-]+\.\w+/;

  // Strategy 1: Lines with phone numbers
  for (const line of lines) {
    const phoneMatch = line.match(phoneRegex);
    if (!phoneMatch) continue;

    const phone = phoneMatch[1].replace(/[\s\-()]/g, "").trim();
    const beforePhone = line.substring(0, phoneMatch.index).trim();
    const afterPhone = line.substring((phoneMatch.index || 0) + phoneMatch[0].length).trim();

    const name = beforePhone.replace(/^\d+[\.\)]\s*/, "").trim();
    if (!name || name.toLowerCase().includes("name") || name.toLowerCase().includes("phone")) continue;

    const emailMatch = afterPhone.match(emailRegex);
    const email = emailMatch ? emailMatch[0] : "";

    const remaining = emailMatch ? afterPhone.replace(emailMatch[0], "").trim() : afterPhone;
    const parts = remaining.split(/[,\t|]+/).map((p) => p.trim()).filter(Boolean);

    members.push({
      full_name: name,
      phone,
      email,
      program: parts[0] || "",
      department: parts[1] || "",
      status: "pending",
    });
  }

  // Strategy 2: If no phone-based matches, try tab/comma separated
  if (members.length === 0) {
    for (const line of lines) {
      const parts = line.split(/[\t,|]+/).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;

      // Skip header-like rows
      if (parts[0].toLowerCase().includes("name") || parts[0].toLowerCase().includes("#")) continue;

      // Remove leading number
      const name = parts[0].replace(/^\d+[\.\)]\s*/, "").trim();
      if (!name) continue;

      // Find phone in remaining parts
      const phoneIdx = parts.findIndex((p, i) => i > 0 && /\d{7,}/.test(p.replace(/[\s\-()]/g, "")));
      const phone = phoneIdx > 0 ? parts[phoneIdx].replace(/[\s\-()]/g, "") : "";
      if (!phone) continue;

      const emailIdx = parts.findIndex((p) => emailRegex.test(p));
      const email = emailIdx > 0 ? parts[emailIdx] : "";

      const usedIdxs = new Set([0, phoneIdx, emailIdx].filter((i) => i >= 0));
      const extras = parts.filter((_, i) => i > 0 && !usedIdxs.has(i));

      members.push({
        full_name: name,
        phone,
        email,
        program: extras[0] || "",
        department: extras[1] || "",
        status: "pending",
      });
    }
  }

  return members;
};

// Parse CSV text
const parseCsvText = (text: string): ParsedMember[] => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  const getIdx = (keys: string[]) => {
    for (const key of keys) {
      const idx = headers.findIndex((h) => h.includes(key));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const nameIdx = getIdx(["full name", "full_name", "name", "fullname"]);
  const phoneIdx = getIdx(["phone", "tel", "mobile"]);
  const emailIdx = getIdx(["email", "e-mail"]);
  const programIdx = getIdx(["program", "programme", "course"]);
  const deptIdx = getIdx(["department", "dept", "faculty"]);

  if (nameIdx < 0 || phoneIdx < 0) return [];

  return lines.slice(1).map((line) => {
    // Handle quoted CSV fields
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { parts.push(current.trim()); current = ""; continue; }
      current += char;
    }
    parts.push(current.trim());

    return {
      full_name: parts[nameIdx] || "",
      phone: parts[phoneIdx] || "",
      email: emailIdx >= 0 ? parts[emailIdx] || "" : "",
      program: programIdx >= 0 ? parts[programIdx] || "" : "",
      department: deptIdx >= 0 ? parts[deptIdx] || "" : "",
      status: "pending" as const,
    };
  }).filter((m) => m.full_name && m.phone);
};

export const ImportMembersDialog = ({ open, onOpenChange }: ImportMembersDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedMember[]>([]);
  const [originalData, setOriginalData] = useState<ParsedMember[] | null>(null);
  const [correctedData, setCorrectedData] = useState<ParsedMember[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);

  const reset = () => {
    setParsedData([]);
    setOriginalData(null);
    setCorrectedData(null);
    setImporting(false);
    setImported(false);
    setParsing(false);
    setAnalyzing(false);
    setShowDiff(false);
    setShowUrlInput(false);
    setFetchingUrl(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAICorrection = async () => {
    if (parsedData.length === 0) return;
    setAnalyzing(true);
    try {
      const membersToAnalyze = parsedData.map((m) => ({
        full_name: m.full_name,
        phone: m.phone,
        email: m.email,
        program: m.program,
        department: m.department,
      }));

      const { data, error } = await supabase.functions.invoke("analyze-import-data", {
        body: { members: membersToAnalyze },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const corrected = data.corrected as Array<{
        full_name: string;
        phone: string;
        email: string;
        program: string;
        department: string;
      }>;

      if (corrected && corrected.length === parsedData.length) {
        // Save original for diff view
        setOriginalData([...parsedData]);
        const newCorrected = parsedData.map((m, i) => ({
          ...m,
          full_name: corrected[i].full_name || m.full_name,
          phone: corrected[i].phone || m.phone,
          email: corrected[i].email || m.email,
          program: corrected[i].program || m.program,
          department: corrected[i].department || m.department,
        }));
        setCorrectedData(newCorrected);
        setShowDiff(true);
        toast.success("AI analysis complete — review changes below");
      } else {
        toast.warning("AI returned unexpected data. Original data preserved.");
      }
    } catch (err: any) {
      toast.error(err.message || "AI analysis failed");
    }
    setAnalyzing(false);
  };

  const acceptDiff = () => {
    if (correctedData) {
      setParsedData(correctedData);
    }
    setShowDiff(false);
    setOriginalData(null);
    setCorrectedData(null);
    toast.success("AI corrections applied");
  };

  const revertDiff = () => {
    setShowDiff(false);
    setCorrectedData(null);
    setOriginalData(null);
    toast.info("Changes reverted to original data");
  };

  const parseExcelFile = (data: ArrayBuffer) => {
    const workbook = XLSX.read(new Uint8Array(data), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    if (rows.length === 0) {
      toast.error("No data found in file");
      return [];
    }

    return rows.map((row) => {
      const get = (keys: string[]) => {
        for (const key of keys) {
          const match = Object.keys(row).find((k) => k.toLowerCase().trim() === key.toLowerCase());
          if (match && row[match]) return String(row[match]).trim();
        }
        return "";
      };

      return {
        full_name: get(["full name", "full_name", "name", "fullname", "student name", "member name"]),
        phone: get(["phone", "phone number", "phone_number", "tel", "mobile", "cell", "contact"]),
        email: get(["email", "email address", "e-mail", "mail"]),
        program: get(["program", "programme", "course", "degree", "major"]),
        department: get(["department", "dept", "faculty", "school"]),
        status: "pending" as const,
      };
    }).filter((m) => m.full_name && m.phone);
  };

  const parsePdfFile = async (data: ArrayBuffer): Promise<ParsedMember[]> => {
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    return parsePdfText(fullText);
  };

  const processFileData = async (file: File | Blob, fileName: string) => {
    const data = await file.arrayBuffer();
    let members: ParsedMember[] = [];
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith(".pdf")) {
      members = await parsePdfFile(data);
    } else if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
      const text = new TextDecoder().decode(new Uint8Array(data));
      members = parseCsvText(text);
      if (members.length === 0) members = parseExcelFile(data);
    } else {
      members = parseExcelFile(data);
    }

    return members;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const members = await processFileData(file, file.name);
      if (members.length === 0) {
        toast.error("No valid members found. Ensure data includes names and phone numbers.");
        setParsing(false);
        return;
      }
      setParsedData(members);
      setImported(false);
      setShowDiff(false);
      setOriginalData(null);
      setCorrectedData(null);
      toast.success(`${members.length} members parsed from file`);
    } catch {
      toast.error("Failed to parse file. Please use a valid Excel, CSV, or PDF file.");
    }
    setParsing(false);
  };

  const handleUrlImport = async () => {
    const url = urlInputRef.current?.value?.trim();
    if (!url) { toast.error("Please enter a URL"); return; }

    setFetchingUrl(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch file");
      const blob = await response.blob();
      const fileName = url.split("/").pop() || "file.xlsx";
      const members = await processFileData(blob, fileName);
      if (members.length === 0) {
        toast.error("No valid members found in the file from URL.");
        setFetchingUrl(false);
        return;
      }
      setParsedData(members);
      setImported(false);
      setShowDiff(false);
      setShowUrlInput(false);
      toast.success(`${members.length} members parsed from URL`);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch or parse file from URL");
    }
    setFetchingUrl(false);
  };

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);
    const updated = [...parsedData];

    // Pre-load existing members for AI-style duplicate detection (name fuzzy + email)
    const { data: existing } = await supabase
      .from("members")
      .select("id, member_id, full_name, email")
      .eq("created_by", user.id);

    const normalize = (s: string) =>
      (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    const tokenSet = (s: string) => normalize(s).split(" ").filter(Boolean).sort().join(" ");
    const lev = (a: string, b: string): number => {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
      for (let i = 0; i <= a.length; i++) dp[i][0] = i;
      for (let j = 0; j <= b.length; j++) dp[0][j] = j;
      for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
      return dp[a.length][b.length];
    };
    const sim = (a: string, b: string) => {
      const m = Math.max(a.length, b.length);
      return m ? 1 - lev(a, b) / m : 1;
    };

    const findExistingMatch = (m: ParsedMember) => {
      if (!existing) return null;
      const emailLc = (m.email || "").toLowerCase().trim();
      if (emailLc) {
        const byEmail = existing.find((e) => (e.email || "").toLowerCase().trim() === emailLc);
        if (byEmail) return { row: byEmail, method: "email" };
      }
      const targetTokens = tokenSet(m.full_name);
      const targetNorm = normalize(m.full_name);
      let best: { row: typeof existing[number]; score: number } | null = null;
      for (const e of existing) {
        if (tokenSet(e.full_name) === targetTokens && targetTokens) {
          return { row: e, method: "name" };
        }
        const score = sim(targetNorm, normalize(e.full_name));
        if (!best || score > best.score) best = { row: e, score };
      }
      if (best && best.score >= 0.88) return { row: best.row, method: `name(${best.score.toFixed(2)})` };
      return null;
    };

    for (let i = 0; i < updated.length; i++) {
      const m = updated[i];
      try {
        // AI-style pre-check: skip if matches an existing member
        const match = findExistingMatch(m);
        if (match) {
          updated[i] = {
            ...m,
            status: "duplicate",
            message: `Matched existing member ${match.row.member_id} (${match.method})`,
          };
          setParsedData([...updated]);
          continue;
        }

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
          // Add the freshly inserted member to the in-memory existing list so
          // subsequent rows in the same batch can match against it.
          existing?.push({ id: "", member_id: memberId, full_name: m.full_name, email: m.email || null });
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Members
          </DialogTitle>
          <DialogDescription>
            Upload Excel, CSV, or PDF files with member data (Full Name and Phone required). You can also import from a URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing || parsing}>
              {parsing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Parsing...</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" />{parsedData.length > 0 ? "Choose Another File" : "Select File"}</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowUrlInput(!showUrlInput)}
              disabled={importing || parsing}
            >
              <Link className="mr-2 h-4 w-4" />
              Import from URL
            </Button>
            {parsedData.length > 0 && !showDiff && (
              <>
                <Badge variant="secondary">{parsedData.length} members found</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAICorrection}
                  disabled={analyzing || importing || imported}
                >
                  {analyzing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />AI Correct Data</>
                  )}
                </Button>
              </>
            )}
          </div>

          {/* URL input */}
          {showUrlInput && (
            <div className="flex items-center gap-2">
              <input
                ref={urlInputRef}
                type="url"
                placeholder="https://example.com/members.xlsx"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" onClick={handleUrlImport} disabled={fetchingUrl}>
                {fetchingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
              </Button>
            </div>
          )}

          {/* Diff view */}
          {showDiff && originalData && correctedData && (
            <ImportDiffView
              original={originalData}
              corrected={correctedData}
              onAccept={acceptDiff}
              onRevert={revertDiff}
            />
          )}

          {/* Regular table view */}
          {parsedData.length > 0 && !showDiff && (
            <div className="flex-1 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Dept</TableHead>
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
                      <TableCell className="text-sm">{m.department || "—"}</TableCell>
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
          {parsedData.length > 0 && !imported && !showDiff && (
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
