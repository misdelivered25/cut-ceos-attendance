import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Loader2, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import imiLogoSrc from "@/assets/imi-logo.png";

interface CrossSessionComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AttendeeFrequency {
  name: string;
  phone: string;
  frequency: number;
  sessions: string[];
}

export const CrossSessionComparisonDialog = ({
  open,
  onOpenChange,
}: CrossSessionComparisonDialogProps) => {
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [step, setStep] = useState<"select" | "results">("select");

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions-for-comparison"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, title, start_time")
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: ["cross-session-comparison", selectedSessions],
    queryFn: async () => {
      if (selectedSessions.length < 2) return [];

      const { data, error } = await supabase
        .from("attendees")
        .select("name, phone, session_id, sessions(title)")
        .in("session_id", selectedSessions);

      if (error) throw error;

      const frequencyMap = new Map<string, AttendeeFrequency>();
      data?.forEach((a: any) => {
        const key = a.phone;
        if (!frequencyMap.has(key)) {
          frequencyMap.set(key, {
            name: a.name,
            phone: a.phone,
            frequency: 0,
            sessions: [],
          });
        }
        const entry = frequencyMap.get(key)!;
        entry.frequency++;
        const sessionTitle = a.sessions?.title || "Unknown";
        if (!entry.sessions.includes(sessionTitle)) {
          entry.sessions.push(sessionTitle);
        }
      });

      return Array.from(frequencyMap.values()).sort(
        (a, b) => b.frequency - a.frequency
      );
    },
    enabled: step === "results" && selectedSessions.length >= 2,
  });

  const toggleSession = (id: string) => {
    setSelectedSessions((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleCompare = () => {
    if (selectedSessions.length < 2) {
      toast.error("Select at least 2 sessions to compare");
      return;
    }
    setStep("results");
  };

  const handleBack = () => {
    setStep("select");
  };

  const loadImiLogo = (): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve("");
      img.src = imiLogoSrc;
    });
  };

  const handleExportExcel = () => {
    if (!comparisonData || comparisonData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = comparisonData.map((entry, index) => ({
      "#": index + 1,
      Name: entry.name,
      Phone: entry.phone,
      Frequency: entry.frequency,
      Sessions: entry.sessions.join(", "),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison");

    const fileName = `session-comparison-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Exported to Excel!");
  };

  const handleExportPDF = async () => {
    if (!comparisonData || comparisonData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header with logo
    const logoData = await loadImiLogo();
    if (logoData) {
      doc.addImage(logoData, "PNG", 14, 8, 20, 20);
    }
    doc.setFontSize(16);
    doc.text("IMI Technologies", 38, 18);
    doc.setFontSize(10);
    doc.text("Inquire . Motivate . Inspire", 38, 24);

    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(14, 32, pageWidth - 14, 32);

    doc.setFontSize(14);
    doc.text("Cross-Session Attendance Comparison", 14, 42);
    doc.setFontSize(10);
    doc.text(`Date: ${format(new Date(), "MMMM d, yyyy")}`, 14, 50);
    doc.text(`Sessions compared: ${selectedSessions.length}`, 14, 56);
    doc.text(`Unique attendees: ${comparisonData.length}`, 14, 62);

    const tableData = comparisonData.map((entry, index) => [
      index + 1,
      entry.name,
      entry.phone,
      entry.frequency,
      entry.sessions.join(", "),
    ]);

    autoTable(doc, {
      startY: 68,
      head: [["#", "Name", "Phone", "Frequency", "Sessions Attended"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      margin: { bottom: 30 },
    });

    // Footer on each page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text("Powered by IMI Technologies", 14, pageHeight - 12);
      doc.text(
        `© ${new Date().getFullYear()} IMI Technologies. All rights reserved.`,
        14,
        pageHeight - 7
      );
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, {
        align: "right",
      });
      doc.setTextColor(0, 0, 0);
    }

    doc.save(`session-comparison-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("Exported to PDF!");
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      setStep("select");
      setSelectedSessions([]);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Cross-Session Comparison
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Select sessions to compare attendance frequency"
              : "Attendees ranked by frequency across selected sessions"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="space-y-4 flex-1 overflow-auto">
            {sessionsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {sessions?.map((session) => (
                    <label
                      key={session.id}
                      className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedSessions.includes(session.id)}
                        onCheckedChange={() => toggleSession(session.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(session.start_time), "MMM d, yyyy")}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <Button
                  onClick={handleCompare}
                  disabled={selectedSessions.length < 2}
                  className="w-full"
                >
                  Compare {selectedSessions.length} Sessions
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={handleBack}>
                ← Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={!comparisonData || comparisonData.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={!comparisonData || comparisonData.length === 0}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>

            {comparisonLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : comparisonData && comparisonData.length > 0 ? (
              <div className="flex-1 overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="w-20">Frequency</TableHead>
                      <TableHead>Sessions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.map((entry, index) => (
                      <TableRow key={entry.phone}>
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.name}
                        </TableCell>
                        <TableCell>{entry.phone}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              entry.frequency >= selectedSessions.length
                                ? "default"
                                : "secondary"
                            }
                          >
                            {entry.frequency}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {entry.sessions.join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No attendance data found
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
