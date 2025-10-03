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

    // GET /campaigns-api - Get active campaigns
    if (req.method === "GET" && pathSegments.length === 1) {
      const now = new Date().toISOString();
      
      const { data, error } = await supabaseClient
        .from("campaigns")
        .select("*")
        .eq("is_active", true)
        .lte("start_date", now)
        .gte("end_date", now)
        .order("start_date", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // GET /campaigns-api/:id - Get specific campaign
    if (req.method === "GET" && pathSegments.length === 2) {
      const campaignId = pathSegments[1];

      const { data, error } = await supabaseClient
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return new Response(
          JSON.stringify({ error: "Campaign not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ data }),
        {
          status: 200,
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