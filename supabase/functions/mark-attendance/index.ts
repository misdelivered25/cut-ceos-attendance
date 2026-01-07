import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_id, name, phone } = await req.json();

    // Validate input
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

    // Extract IP address from request headers
    const ip_address = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                       req.headers.get('x-real-ip') || 
                       'unknown';

    console.log('Marking attendance with IP:', ip_address);

    // Look up member by phone number to link attendance
    const trimmedPhone = phone.trim();
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('phone', trimmedPhone)
      .eq('is_active', true)
      .maybeSingle();

    const member_id = member?.id || null;
    console.log('Member lookup result:', member_id ? `Found member ${member_id}` : 'No matching member');

    // Insert attendance record
    const { error } = await supabase
      .from('attendees')
      .insert({
        session_id,
        name: name.trim(),
        phone: trimmedPhone,
        ip_address,
        member_id,
      });

    if (error) {
      console.error('Database error:', error);
      
      // Check for duplicate phone number constraint
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
      JSON.stringify({ success: true, message: 'Attendance marked successfully' }), 
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