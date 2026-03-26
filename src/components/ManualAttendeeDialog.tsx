import { useState } from "react";
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
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ManualAttendeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionTitle: string;
}

export const ManualAttendeeDialog = ({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
}: ManualAttendeeDialogProps) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    const phone = formData.phone.trim();

    if (!name || !phone) {
      toast.error("Name and phone are required");
      return;
    }

    if (phone.length < 10 || phone.length > 15) {
      toast.error("Phone number must be 10-15 digits");
      return;
    }

    setLoading(true);
    try {
      // Look up member by phone
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("phone", phone)
        .eq("is_active", true)
        .maybeSingle();

      const { error } = await supabase.from("attendees").insert({
        session_id: sessionId,
        name,
        phone,
        member_id: member?.id || null,
        ip_address: "manual-entry",
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("This phone number is already registered for this session");
        } else {
          throw error;
        }
      } else {
        toast.success(`${name} added to session`);
        setFormData({ name: "", phone: "" });
        queryClient.invalidateQueries({ queryKey: ["attendees", sessionId] });
        queryClient.invalidateQueries({ queryKey: ["attendees-count", sessionId] });
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add attendee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Manual Entry
          </DialogTitle>
          <DialogDescription>
            Manually add a participant to "{sessionTitle}"
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
};
