import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  session_id: string;
  attendee_count: number;
  threshold: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = (await req.json()) as NotificationRequest;
    const { session_id, attendee_count, threshold } = body;
    if (!session_id || typeof attendee_count !== "number" || typeof threshold !== "number") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch session and ensure caller owns it; pull destination email from DB only
    const { data: session, error: sErr } = await adminClient
      .from("sessions")
      .select("id, title, notification_email, created_by")
      .eq("id", session_id)
      .maybeSingle();

    if (sErr || !session || session.created_by !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!session.notification_email) {
      return new Response(JSON.stringify({ error: "No notification email configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeTitle = String(session.title).slice(0, 200).replace(/[<>]/g, "");
    const safeCount = Math.max(0, Math.floor(attendee_count));
    const safeThreshold = Math.max(0, Math.floor(threshold));

    const emailResponse = await resend.emails.send({
      from: "CUT CEOS <onboarding@resend.dev>",
      to: [session.notification_email],
      subject: `Attendance Milestone: ${safeCount} attendees for ${safeTitle}`,
      html: `
        <!DOCTYPE html>
        <html><body style="font-family: sans-serif; background:#f5f5f5; padding:20px;">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;padding:30px;text-align:center;">
              <h1 style="margin:0;">Attendance Milestone Reached</h1>
            </div>
            <div style="padding:30px;">
              <p>Your session "<strong>${safeTitle}</strong>" has reached a milestone.</p>
              <div style="background:#f0f9ff;border-radius:8px;padding:20px;text-align:center;">
                <div style="font-size:48px;font-weight:bold;color:#3b82f6;">${safeCount}</div>
                <div style="color:#64748b;">Attendees (Threshold: ${safeThreshold})</div>
              </div>
            </div>
          </div>
        </body></html>
      `,
    });

    console.log("Email sent:", emailResponse);

    await adminClient
      .from("sessions")
      .update({ notification_sent: true })
      .eq("id", session_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
