import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Clock, Users, Bell } from "lucide-react";

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

interface EditSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session;
}

export const EditSessionDialog = ({ open, onOpenChange, session }: EditSessionDialogProps) => {
  const [title, setTitle] = useState(session.title);
  const [mode, setMode] = useState<"timed" | "open">(session.mode as "timed" | "open");
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(session.time_limit_enabled);
  const [isActive, setIsActive] = useState(session.is_active);
  const [notificationsEnabled, setNotificationsEnabled] = useState(!!session.notification_threshold);
  const [notificationThreshold, setNotificationThreshold] = useState(session.notification_threshold || 10);
  const [notificationEmail, setNotificationEmail] = useState(session.notification_email || "");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setTitle(session.title);
      setMode(session.mode as "timed" | "open");
      setTimeLimitEnabled(session.time_limit_enabled);
      setIsActive(session.is_active);
      setNotificationsEnabled(!!session.notification_threshold);
      setNotificationThreshold(session.notification_threshold || 10);
      setNotificationEmail(session.notification_email || "");
    }
  }, [open, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error("Please enter a session title");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("sessions")
      .update({
        title: title.trim(),
        mode: mode,
        time_limit_enabled: timeLimitEnabled,
        is_active: isActive,
        notification_threshold: notificationsEnabled ? notificationThreshold : null,
        notification_email: notificationsEnabled ? notificationEmail.trim() || null : null,
      })
      .eq("id", session.id);

    setLoading(false);

    if (error) {
      toast.error("Failed to update session");
      console.error(error);
    } else {
      toast.success("Session updated successfully!");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Session</DialogTitle>
          <DialogDescription>
            Update session settings and notification preferences
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Session Title</Label>
              <Input
                id="title"
                placeholder="e.g., Weekly Meeting - Jan 15"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="isActive" className="font-medium">Session Active</Label>
                <p className="text-sm text-muted-foreground">
                  Allow new submissions
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="space-y-3">
              <Label>Session Mode</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as "timed" | "open")}>
                <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="timed" id="edit-timed" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="edit-timed" className="flex items-center gap-2 font-medium cursor-pointer">
                      <Clock className="h-4 w-4 text-primary" />
                      Timed Check-in
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      For meetings with scheduled start/end times
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="open" id="edit-open" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="edit-open" className="flex items-center gap-2 font-medium cursor-pointer">
                      <Users className="h-4 w-4 text-accent" />
                      Open Check-in
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      For recruitment drives with no time limit
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="editTimeLimit" className="font-medium">Time Limit</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-close submissions after duration
                  </p>
                </div>
                <Switch
                  id="editTimeLimit"
                  checked={timeLimitEnabled}
                  onCheckedChange={setTimeLimitEnabled}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="editNotifications" className="font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when attendance reaches a threshold
                  </p>
                </div>
                <Switch
                  id="editNotifications"
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>

              {notificationsEnabled && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="editThreshold">Attendance Threshold</Label>
                    <Input
                      id="editThreshold"
                      type="number"
                      min={1}
                      max={1000}
                      value={notificationThreshold}
                      onChange={(e) => setNotificationThreshold(parseInt(e.target.value) || 10)}
                      placeholder="e.g., 50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Send notification when this many attendees check in
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEmail">Notification Email</Label>
                    <Input
                      id="editEmail"
                      type="email"
                      value={notificationEmail}
                      onChange={(e) => setNotificationEmail(e.target.value)}
                      placeholder="admin@example.com"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
