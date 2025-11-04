import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Download, Users, Eye } from "lucide-react";
import { format } from "date-fns";
import { QRCodeDialog } from "./QRCodeDialog";
import { ViewAttendeesDialog } from "./ViewAttendeesDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Session {
  id: string;
  title: string;
  qr_token: string;
  start_time: string;
  is_active: boolean;
}

interface SessionCardProps {
  session: Session;
}

export const SessionCard = ({ session }: SessionCardProps) => {
  const [showQR, setShowQR] = useState(false);
  const [showAttendees, setShowAttendees] = useState(false);

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

  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg font-semibold">{session.title}</CardTitle>
            <Badge variant={session.is_active ? "default" : "secondary"}>
              {session.is_active ? "Active" : "Closed"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(session.start_time), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{attendeesCount ?? 0} attendees</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowQR(true)}
            >
              <QrCode className="mr-2 h-4 w-4" />
              QR Code
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
    </>
  );
};
