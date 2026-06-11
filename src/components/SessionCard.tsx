import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Users, Eye, Clock, Trash2, Pencil, Bell, Copy, Power } from "lucide-react";
import { format } from "date-fns";
import { QRCodeDialog } from "./QRCodeDialog";
import { ViewAttendeesDialog } from "./ViewAttendeesDialog";
import { EditSessionDialog } from "./EditSessionDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeAttendees } from "@/hooks/useRealtimeAttendees";
import { useAuth } from "@/components/AuthProvider";
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
import { toast } from "sonner";

interface Session {
  id: string;
  title: string;
  qr_token: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  mode: string;
  time_limit_enabled: boolean;
  notification_threshold: number | null;
  notification_email: string | null;
}

interface SessionCardProps {
  session: Session;
}

export const SessionCard = ({ session }: SessionCardProps) => {
  const [showQR, setShowQR] = useState(false);
  const [showAttendees, setShowAttendees] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: attendeesCount } = useQuery({
    queryKey: ["attendees-count", session.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendees")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id);

      if (error) throw error;
      return count || 0;
    },
  });

  const handleQuickToggle = async () => {
    setIsToggling(true);
    const { error } = await supabase
      .from("sessions")
      .update({ is_active: !session.is_active })
      .eq("id", session.id);
    setIsToggling(false);
    if (error) {
      toast.error("Failed to update session status");
    } else {
      toast.success(session.is_active ? "Session closed" : "Session opened");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  };

  const handleDuplicate = async () => {
    if (!user?.id) {
      toast.error("You must be signed in to duplicate a session");
      return;
    }
    setIsDuplicating(true);
    const generateToken = () =>
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const startTime = new Date();
    const endTime =
      session.time_limit_enabled && session.end_time
        ? new Date(
            startTime.getTime() +
              (new Date(session.end_time).getTime() -
                new Date(session.start_time).getTime())
          )
        : null;

    const { error } = await supabase.from("sessions").insert({
      title: `${session.title} (Copy)`,
      qr_token: generateToken(),
      created_by: user.id,
      start_time: startTime.toISOString(),
      end_time: endTime?.toISOString() || null,
      mode: session.mode as "open" | "timed",
      time_limit_enabled: session.time_limit_enabled,
      notification_threshold: session.notification_threshold,
      notification_email: session.notification_email,
    });
    setIsDuplicating(false);
    if (error) {
      toast.error("Failed to duplicate session");
    } else {
      toast.success("Session duplicated!");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  };

  const handleDeleteSession = async () => {
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", session.id);

    if (error) {
      toast.error("Failed to delete session");
      console.error(error);
    } else {
      toast.success("Session deleted");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
    setShowDeleteConfirm(false);
  };

  const isExpired = session.time_limit_enabled && session.end_time && new Date() > new Date(session.end_time);
  const isOpen = session.mode === "open";

  const getStatusBadge = () => {
    if (!session.is_active) {
      return <Badge variant="secondary">Closed</Badge>;
    }
    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg font-semibold line-clamp-1 flex items-center gap-2">
              {session.is_active && !isExpired && (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
              )}
              {session.title}
            </CardTitle>
            <div className="flex items-center gap-1 shrink-0">
              {getStatusBadge()}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="gap-1 text-xs">
              {isOpen ? (
                <>
                  <Users className="h-3 w-3" />
                  Open
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  Timed
                </>
              )}
            </Badge>
            {!session.time_limit_enabled && (
              <Badge variant="outline" className="text-xs">No Time Limit</Badge>
            )}
            {session.notification_threshold && (
              <Badge variant="outline" className="text-xs gap-1">
                <Bell className="h-3 w-3" />
                {session.notification_threshold}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {format(new Date(session.start_time), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{attendeesCount ?? 0} attendees</span>
          </div>
          {/* Primary actions */}
          <div className="flex gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowQR(true)}
            >
              <QrCode className="mr-2 h-4 w-4" />
              QR
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowAttendees(true)}
            >
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>
          </div>
          {/* Secondary actions */}
          <div className="flex gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon"
              title={session.is_active ? "Close session" : "Open session"}
              onClick={handleQuickToggle}
              disabled={isToggling}
              className={session.is_active ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
            >
              <Power className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Duplicate session"
              onClick={handleDuplicate}
              disabled={isDuplicating}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Edit session"
              onClick={() => setShowEdit(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Delete session"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <QRCodeDialog
        open={showQR}
        onOpenChange={setShowQR}
        session={session}
      />
      <ViewAttendeesDialog
        open={showAttendees}
        onOpenChange={setShowAttendees}
        sessionId={session.id}
        sessionTitle={session.title}
      />
      <EditSessionDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        session={session}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{session.title}"? This will also delete all attendance records for this session. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
