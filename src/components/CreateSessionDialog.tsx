import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Clock, Users, Bell } from "lucide-react";

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateSessionDialog = ({ open, onOpenChange }: CreateSessionDialogProps) => {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"timed" | "open">("timed");
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(true);
  const [durationHours, setDurationHours] = useState(2);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationThreshold, setNotificationThreshold] = useState(10);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error("Please enter a session title");
      return;
    }

    setLoading(true);

    const startTime = new Date();
    // Only set end_time if time limit is enabled
    const endTime = timeLimitEnabled 
      ? new Date(startTime.getTime() + durationHours * 60 * 60 * 1000)
      : null;

    const { error } = await supabase.from("sessions").insert({
      title: title.trim(),
      qr_token: generateToken(),
      created_by: user?.id,
      start_time: startTime.toISOString(),
      end_time: endTime?.toISOString() || null,
      mode: mode,
      time_limit_enabled: timeLimitEnabled,
      notification_threshold: notificationsEnabled ? notificationThreshold : null,
      notification_email: notificationsEnabled ? notificationEmail.trim() || null : null,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to create session");
      console.error(error);
    } else {
      toast.success("Session created successfully!");
      setTitle("");
      setMode("timed");
      setTimeLimitEnabled(true);
      setDurationHours(2);
      setNotificationsEnabled(false);
      setNotificationThreshold(10);
      setNotificationEmail("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
          <DialogDescription>
            Create a new attendance session with a unique QR code
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

            <div className="space-y-3">
              <Label>Session Mode</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as "timed" | "open")}>
                <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="timed" id="timed" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="timed" className="flex items-center gap-2 font-medium cursor-pointer">
                      <Clock className="h-4 w-4 text-primary" />
                      Timed Check-in
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      For meetings with scheduled start/end times
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="open" id="open" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="open" className="flex items-center gap-2 font-medium cursor-pointer">
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
                  <Label htmlFor="timeLimit" className="font-medium">Time Limit</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-close submissions after duration
                  </p>
                </div>
                <Switch
                  id="timeLimit"
                  checked={timeLimitEnabled}
                  onCheckedChange={setTimeLimitEnabled}
                />
              </div>

              {timeLimitEnabled && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="duration">Duration (hours)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={0.5}
                    max={24}
                    step={0.5}
                    value={durationHours}
                    onChange={(e) => setDurationHours(parseFloat(e.target.value) || 2)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications" className="font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when attendance reaches a threshold
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>

              {notificationsEnabled && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="threshold">Attendance Threshold</Label>
                    <Input
                      id="threshold"
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
                    <Label htmlFor="email">Notification Email</Label>
                    <Input
                      id="email"
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
              {loading ? "Creating..." : "Create Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
