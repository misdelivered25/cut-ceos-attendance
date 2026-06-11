import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Clock, Users } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/cut-ceos-logo.png";

const attendanceSchema = z.object({
  name: z.string().trim().min(1, "Full name is required").max(100, "Name is too long"),
  student_id: z.string().trim().min(1, "Student ID is required").max(50, "Student ID is too long"),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits").max(15, "Phone number is too long"),
  email: z.string().trim().email("Invalid email").max(254),
});

const Scan = () => {
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session", token],
    queryFn: async () => {
      console.log("[Scan] Received token from URL:", token);

      const { data, error } = await supabase
        .from("sessions")
        .select("id, title, is_active, mode, start_time, end_time, time_limit_enabled, qr_token")
        .eq("qr_token", token!)
        .maybeSingle();

      if (error) {
        console.error("[Scan] Session lookup error:", error);
        throw error;
      }

      console.log("[Scan] Session lookup result:", data);
      return data;
    },
    enabled: !!token,
  });


  const submitAttendance = useMutation({
    mutationFn: async (data: { name: string; student_id: string; phone: string; email: string }) => {
      const validation = attendanceSchema.safeParse(data);
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }

      const { data: result, error } = await supabase.functions.invoke('mark-attendance', {
        body: {
          qr_token: token,
          name: data.name,
          student_id: data.student_id,
          phone: data.phone,
          email: data.email,
        },
      });


      if (error) {
        throw new Error(error.message || "Failed to mark attendance");
      }

      if (result?.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: (result: any) => {
      setSubmitted(true);
      if (result?.matched) {
        toast.success("Attendance marked — linked to your member profile!");
      } else {
        toast.success("Attendance marked successfully!");
      }
      queryClient.invalidateQueries({ queryKey: ["attendees"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitAttendance.mutate({ name, student_id: studentId, phone, email });
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

  // Check if session is closed or expired based on time_limit_enabled
  const now = new Date();
  const isTimeLimitEnabled = session.time_limit_enabled;
  const isExpired = isTimeLimitEnabled && session.end_time && now > new Date(session.end_time);
  const hasNotStarted = isTimeLimitEnabled && session.start_time && now < new Date(session.start_time);
  
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
                ? "The time limit for this session has passed. Attendance is no longer being accepted." 
                : "Attendance is no longer being accepted"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasNotStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,hsl(var(--muted)),hsl(var(--background)))] p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <img src={logo} alt="CUT CEOS" className="mx-auto h-20 w-20 object-contain mb-4" />
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg font-medium">Session hasn't started yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait for the session to begin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    const whatsappMsg = encodeURIComponent(
      `📋 I just marked my attendance for *${session.title}*!\nYou can too — scan the QR code or use this link:\n${window.location.href}`
    );
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
            <h2 className="mb-2 text-2xl font-bold">Thank you for Submitting your Attendance</h2>
            <p className="text-muted-foreground">
              Your attendance has been recorded for {session.title}.
            </p>
            <div className="mt-6">
              <p className="text-sm text-muted-foreground mb-3">Know someone who hasn't marked attendance yet?</p>
              <a
                href={`https://wa.me/?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Share with Friends
              </a>
            </div>
            <p className="mt-8 text-xs text-muted-foreground">
              Powered by IMI Technologies | All rights reserved
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sessionMode = session.mode as "timed" | "open";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,hsl(var(--muted)),hsl(var(--background)))] p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="CUT CEOS" className="h-20 w-20 object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl">{session.title}</CardTitle>
            <div className="flex justify-center mt-2">
              <Badge variant={sessionMode === "timed" ? "default" : "secondary"} className="gap-1">
                {sessionMode === "timed" ? (
                  <>
                    <Clock className="h-3 w-3" />
                    Timed Check-in
                  </>
                ) : (
                  <>
                    <Users className="h-3 w-3" />
                    Open Check-in
                  </>
                )}
              </Badge>
            </div>
          </div>
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
              <Label htmlFor="student_id">Student ID</Label>
              <Input
                id="student_id"
                type="text"
                placeholder="e.g. C12345"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+263771234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                maxLength={15}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitAttendance.isPending}>
              {submitAttendance.isPending ? "Submitting..." : "Submit Attendance"}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Powered by IMI Technologies | All rights reserved
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Scan;
