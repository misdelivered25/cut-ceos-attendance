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
  session_title: string;
  attendee_count: number;
  threshold: number;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_id, session_title, attendee_count, threshold, email }: NotificationRequest = await req.json();

    console.log(`Sending notification for session ${session_id} to ${email}`);

    const emailResponse = await resend.emails.send({
      from: "CUT CEOS <onboarding@resend.dev>",
      to: [email],
      subject: `🎉 Attendance Milestone: ${attendee_count} attendees for ${session_title}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .milestone { background: #f0f9ff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .milestone .number { font-size: 48px; font-weight: bold; color: #3b82f6; }
            .milestone .label { color: #64748b; }
            .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Attendance Milestone Reached!</h1>
            </div>
            <div class="content">
              <p>Great news! Your session "<strong>${session_title}</strong>" has reached a significant milestone.</p>
              <div class="milestone">
                <div class="number">${attendee_count}</div>
                <div class="label">Attendees (Threshold: ${threshold})</div>
              </div>
              <p>Keep up the great work with CUT CEOS!</p>
            </div>
            <div class="footer">
              <p>CUT CEOS Attendance System</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Mark notification as sent
    await supabase
      .from("sessions")
      .update({ notification_sent: true })
      .eq("id", session_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
