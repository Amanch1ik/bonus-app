import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    // GET /users-api - Get current user profile
    if (req.method === "GET" && pathSegments.length === 1) {
      const { data, error } = await supabaseClient
        .from("users")
        .select(`
          *,
          loyalty_levels (
            name,
            min_points,
            bonus_multiplier,
            description
          )
        `)
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // PUT /users-api - Update user profile
    if (req.method === "PUT" && pathSegments.length === 1) {
      const body = await req.json();
      const { full_name } = body;

      const { data, error } = await supabaseClient
        .from("users")
        .update({ full_name })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST /users-api/register - Create user profile after auth signup
    if (req.method === "POST" && pathSegments[1] === "register") {
      const body = await req.json();
      const { full_name, email } = body;

      // Get the default loyalty level (Bronze)
      const { data: defaultLevel } = await supabaseClient
        .from("loyalty_levels")
        .select("id")
        .eq("name", "Bronze")
        .maybeSingle();

      const { data, error } = await supabaseClient
        .from("users")
        .insert({
          id: user.id,
          full_name,
          email,
          loyalty_level_id: defaultLevel?.id,
          points: 0,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});