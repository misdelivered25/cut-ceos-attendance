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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { toast } from "sonner";

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
  const { data: attendees, isLoading } = useQuery({
    queryKey: ["attendees", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendees")
        .select("*")
        .eq("session_id", sessionId)
        .order("scanned_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleExport = () => {
    if (!attendees || attendees.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = attendees.map((attendee) => ({
      Name: attendee.name,
      Phone: attendee.phone,
      "Scan Time": format(new Date(attendee.scanned_at), "MMM d, yyyy h:mm a"),
      "IP Address": attendee.ip_address || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    const fileName = `attendance-${sessionTitle.replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Attendance exported successfully!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{sessionTitle}</DialogTitle>
          <DialogDescription>
            View and export attendance records
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between">
            <p className="text-sm text-muted-foreground">
              Total: {attendees?.length || 0} attendees
            </p>
            <Button onClick={handleExport} disabled={!attendees || attendees.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : attendees && attendees.length > 0 ? (
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Scan Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendees.map((attendee) => (
                    <TableRow key={attendee.id}>
                      <TableCell className="font-medium">{attendee.name}</TableCell>
                      <TableCell>{attendee.phone}</TableCell>
                      <TableCell>
                        {format(new Date(attendee.scanned_at), "MMM d, h:mm a")}
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
  );
};
