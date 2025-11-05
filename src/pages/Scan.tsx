import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/cut-ceos-logo.png";

const attendanceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits").max(15, "Phone number is too long"),
});

const Scan = () => {
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("qr_token", token)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const submitAttendance = useMutation({
    mutationFn: async (data: { name: string; phone: string }) => {
      const validation = attendanceSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }

      // Call edge function to mark attendance with IP capture
      const { data: result, error } = await supabase.functions.invoke('mark-attendance', {
        body: {
          session_id: session?.id,
          name: data.name,
          phone: data.phone,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to mark attendance");
      }

      if (result?.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Attendance marked successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendees"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitAttendance.mutate({ name, phone });
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,hsl(var(--muted)),hsl(var(--background)))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,hsl(var(--muted)),hsl(var(--background)))] p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <img src={logo} alt="CUT CEOS" className="mx-auto h-20 w-20 object-contain mb-4" />
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg font-medium text-destructive">Invalid or expired QR code</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if session is inactive or expired (past end_time)
  const isExpired = session.end_time && new Date() > new Date(session.end_time);
  
  if (!session.is_active || isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,hsl(var(--muted)),hsl(var(--background)))] p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <img src={logo} alt="CUT CEOS" className="mx-auto h-20 w-20 object-contain mb-4" />
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg font-medium">This session has {isExpired ? "expired" : "been closed"}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isExpired 
                ? "This session expired after 2 hours. Attendance is no longer being accepted." 
                : "Attendance is no longer being accepted"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,hsl(var(--muted)),hsl(var(--background)))] p-4">
        <Card className="w-full max-w-md text-center shadow-xl">
          <CardContent className="pt-12 pb-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
              <img src={logo} alt="CUT CEOS" className="h-full w-full object-contain" />
            </div>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Attendance Recorded!</h2>
            <p className="text-muted-foreground">
              Your attendance has been successfully marked for {session.title}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,hsl(var(--muted)),hsl(var(--background)))] p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="CUT CEOS" className="h-20 w-20 object-contain" />
          </div>
          <CardTitle className="text-2xl">{session.title}</CardTitle>
          <CardDescription>Please fill in your details to mark attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                maxLength={15}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitAttendance.isPending}>
              {submitAttendance.isPending ? "Submitting..." : "Mark Attendance"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Scan;
