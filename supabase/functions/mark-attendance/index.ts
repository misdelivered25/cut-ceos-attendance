import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize a name for comparison: lowercase, trim, collapse spaces, strip punctuation
const normalizeName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

// Levenshtein distance
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

// Returns the same set of tokens regardless of order ("John Doe" === "Doe John")
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_id, name, phone, email } = await req.json();

    if (!session_id || !name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Name is too long' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (phone.length < 10 || phone.length > 15) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number length' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ip_address = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                       req.headers.get('x-real-ip') ||
                       'unknown';

    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();
    const trimmedEmail = (email || "").trim().toLowerCase();

    // Find session owner so we only match against their member directory
    const { data: sessionRow } = await supabase
      .from('sessions')
      .select('created_by')
      .eq('id', session_id)
      .maybeSingle();

    let member_id: string | null = null;
    let match_method: string | null = null;

    // 1. Exact phone match (highest confidence)
    const { data: phoneMember } = await supabase
      .from('members')
      .select('id')
      .eq('phone', trimmedPhone)
      .eq('is_active', true)
      .maybeSingle();

    if (phoneMember) {
      member_id = phoneMember.id;
      match_method = 'phone';
    }

    // 2. Email match (if phone failed)
    if (!member_id && trimmedEmail && sessionRow?.created_by) {
      const { data: emailMember } = await supabase
        .from('members')
        .select('id')
        .ilike('email', trimmedEmail)
        .eq('created_by', sessionRow.created_by)
        .eq('is_active', true)
        .maybeSingle();
      if (emailMember) {
        member_id = emailMember.id;
        match_method = 'email';
      }
    }

    // 3. Fuzzy name match (only if phone & email failed)
    if (!member_id && sessionRow?.created_by) {
      const { data: candidates } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('created_by', sessionRow.created_by)
        .eq('is_active', true);

      if (candidates && candidates.length) {
        const target = normalizeName(trimmedName);
        let best: { id: string; score: number } | null = null;
        for (const c of candidates) {
          const cand = normalizeName(c.full_name);
          // Token-set equal = treated as exact match (handles word order)
          if (tokenSetEqual(target, cand)) {
            best = { id: c.id, score: 1 };
            break;
          }
          const score = similarity(target, cand);
          if (!best || score > best.score) best = { id: c.id, score };
        }
        // High confidence threshold: 0.88
        if (best && best.score >= 0.88) {
          member_id = best.id;
          match_method = `name(${best.score.toFixed(2)})`;
        }
      }
    }

    console.log('Attendance match:', match_method || 'none', member_id || '');

    const { error } = await supabase
      .from('attendees')
      .insert({
        session_id,
        name: trimmedName,
        phone: trimmedPhone,
        ip_address,
        member_id,
      });

    if (error) {
      console.error('Database error:', error);
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'You have already marked attendance for this session' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to mark attendance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Attendance marked successfully', matched: !!member_id, match_method }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in mark-attendance function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
