import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, FileText, Loader2, Trash2, UserCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ManualAttendeeDialog } from "./ManualAttendeeDialog";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import imiLogoSrc from "@/assets/imi-logo.png";

interface ViewAttendeesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionTitle: string;
}

export const ViewAttendeesDialog = ({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
}: ViewAttendeesDialogProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const queryClient = useQueryClient();

  const { data: attendees, isLoading, refetch } = useQuery({
    queryKey: ["attendees", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendees")
        .select(`
          *,
          member:members(id, member_id, full_name)
        `)
        .eq("session_id", sessionId)
        .order("scanned_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
    refetchInterval: open ? 5000 : false, // Live refresh every 5 seconds when dialog is open
  });

  const handleExportExcel = () => {
    if (!attendees || attendees.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = attendees.map((attendee, index) => ({
      "#": index + 1,
      Name: attendee.name,
      Phone: attendee.phone,
      "Member ID": attendee.member?.member_id || "N/A",
      "Submission Time": format(new Date(attendee.scanned_at), "MMM d, yyyy h:mm a"),
      "IP Address": attendee.ip_address || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    const fileName = `attendance-${sessionTitle.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Exported to Excel successfully!");
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

  const handleExportPDF = async () => {
    if (!attendees || attendees.length === 0) {
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
    doc.text("CUT CEOS Attendance Report", 14, 42);
    doc.setFontSize(10);
    doc.text(`Session: ${sessionTitle}`, 14, 50);
    doc.text(`Date: ${format(new Date(), "MMMM d, yyyy")}`, 14, 56);
    doc.text(`Total Attendees: ${attendees.length}`, 14, 62);

    const tableData = attendees.map((attendee, index) => [
      index + 1,
      attendee.name,
      attendee.phone,
      attendee.member?.member_id || "N/A",
      format(new Date(attendee.scanned_at), "MMM d, yyyy h:mm a"),
    ]);

    autoTable(doc, {
      startY: 68,
      head: [["#", "Name", "Phone", "Member ID", "Submission Time"]],
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

    const fileName = `attendance-${sessionTitle.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(fileName);
    toast.success("Exported to PDF successfully!");
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("attendees")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast.error("Failed to delete entry");
      console.error(error);
    } else {
      toast.success("Entry deleted");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["attendees-count", sessionId] });
    }
    setDeleteId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{sessionTitle}</DialogTitle>
            <DialogDescription>
              View and manage attendance records (auto-refreshes every 5 seconds)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Total: <span className="font-semibold text-foreground">{attendees?.length || 0}</span> attendees
                </span>
                <span>
                  Members: <span className="font-semibold text-foreground">{attendees?.filter(a => a.member_id).length || 0}</span>
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowManualEntry(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExportExcel} 
                  disabled={!attendees || attendees.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExportPDF} 
                  disabled={!attendees || attendees.length === 0}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : attendees && attendees.length > 0 ? (
              <div className="flex-1 overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Submission Time</TableHead>
                      <TableHead className="w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendees.map((attendee, index) => (
                      <TableRow key={attendee.id}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{attendee.name}</TableCell>
                        <TableCell>{attendee.phone}</TableCell>
                        <TableCell>
                          {attendee.member ? (
                            <Badge variant="secondary" className="gap-1">
                              <UserCheck className="h-3 w-3" />
                              {attendee.member.member_id}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(attendee.scanned_at), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(attendee.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No attendance records yet
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attendance record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManualAttendeeDialog
        open={showManualEntry}
        onOpenChange={setShowManualEntry}
        sessionId={sessionId}
        sessionTitle={sessionTitle}
      />
    </>
  );
};
