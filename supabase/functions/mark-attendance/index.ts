import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

const lev = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
};
const similarity = (a: string, b: string) => {
  const max = Math.max(a.length, b.length);
  if (!max) return 1;
  return 1 - lev(a, b) / max;
};
const tokenSetEqual = (a: string, b: string) => {
  const ta = a.split(" ").filter(Boolean).sort().join(" ");
  const tb = b.split(" ").filter(Boolean).sort().join(" ");
  return ta === tb && !!ta;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { qr_token, name, phone, email, student_id } = await req.json();

    if (!qr_token || !name || !phone || !student_id || !email) {
      return new Response(
        JSON.stringify({ error: 'QR token, full name, Student ID, phone, and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve session strictly via QR token (never trust client-supplied session_id)
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, is_active, start_time, end_time, time_limit_enabled, created_by')
      .eq('qr_token', String(qr_token))
      .maybeSingle();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: 'Invalid QR code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = Date.now();
    const isExpired = session.time_limit_enabled && session.end_time && now > new Date(session.end_time).getTime();
    const hasNotStarted = session.time_limit_enabled && session.start_time && now < new Date(session.start_time).getTime();
    if (!session.is_active || isExpired || hasNotStarted) {
      return new Response(JSON.stringify({ error: 'Session is not currently accepting attendance' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const session_id = session.id;
    const trimmedName = String(name).trim();
    const trimmedPhone = String(phone).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedStudentId = String(student_id).trim();

    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return new Response(JSON.stringify({ error: 'Invalid name length' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!/^[0-9+\-\s()]{10,15}$/.test(trimmedPhone)) {
      return new Response(JSON.stringify({ error: 'Invalid phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail) || trimmedEmail.length > 254) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (trimmedStudentId.length < 1 || trimmedStudentId.length > 50) {
      return new Response(JSON.stringify({ error: 'Invalid Student ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: dupes, error: dupErr } = await supabase
      .from('attendees')
      .select('id, student_id, email, phone')
      .eq('session_id', session_id);

    if (dupErr) {
      console.error('Dup check error:', dupErr);
    } else if (dupes && dupes.length) {
      const match = dupes.find((a: any) =>
        (a.student_id && a.student_id.toLowerCase() === trimmedStudentId.toLowerCase()) ||
        (a.email && a.email.toLowerCase() === trimmedEmail) ||
        (a.phone && a.phone === trimmedPhone)
      );
      if (match) {
        return new Response(
          JSON.stringify({ error: 'You have already submitted your attendance for this session.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const ip_address = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                       req.headers.get('x-real-ip') || 'unknown';

    let member_id: string | null = null;
    let match_method: string | null = null;

    const { data: phoneMember } = await supabase
      .from('members').select('id').eq('phone', trimmedPhone).eq('is_active', true).maybeSingle();
    if (phoneMember) { member_id = phoneMember.id; match_method = 'phone'; }

    if (!member_id && trimmedEmail && session.created_by) {
      const { data: emailMember } = await supabase
        .from('members').select('id').ilike('email', trimmedEmail)
        .eq('created_by', session.created_by).eq('is_active', true).maybeSingle();
      if (emailMember) { member_id = emailMember.id; match_method = 'email'; }
    }

    if (!member_id && session.created_by) {
      const { data: candidates } = await supabase
        .from('members').select('id, full_name')
        .eq('created_by', session.created_by).eq('is_active', true);
      if (candidates && candidates.length) {
        const target = normalizeName(trimmedName);
        let best: { id: string; score: number } | null = null;
        for (const c of candidates) {
          const cand = normalizeName(c.full_name);
          if (tokenSetEqual(target, cand)) { best = { id: c.id, score: 1 }; break; }
          const score = similarity(target, cand);
          if (!best || score > best.score) best = { id: c.id, score };
        }
        if (best && best.score >= 0.88) {
          member_id = best.id;
          match_method = `name(${best.score.toFixed(2)})`;
        }
      }
    }

    const { error } = await supabase.from('attendees').insert({
      session_id,
      name: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
      student_id: trimmedStudentId,
      ip_address,
      member_id,
    });

    if (error) {
      console.error('Database error:', error);
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'You have already submitted your attendance for this session.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: 'Failed to mark attendance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Thank you for Submitting your Attendance', matched: !!member_id, match_method }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in mark-attendance function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
