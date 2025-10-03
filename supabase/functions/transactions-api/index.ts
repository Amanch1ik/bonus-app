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

    // GET /transactions-api - Get user transactions with pagination and filters
    if (req.method === "GET" && pathSegments.length === 1) {
      const params = url.searchParams;
      const limit = parseInt(params.get("limit") || "50");
      const offset = parseInt(params.get("offset") || "0");
      const type = params.get("type");

      let query = supabaseClient
        .from("transactions")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (type && ["earned", "spent", "expired"].includes(type)) {
        query = query.eq("type", type);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ data, count }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST /transactions-api/earn - Add points (simulate purchase)
    if (req.method === "POST" && pathSegments[1] === "earn") {
      const body = await req.json();
      const { amount, description } = body;

      if (!amount || amount <= 0) {
        return new Response(
          JSON.stringify({ error: "Invalid amount" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get user's current loyalty level
      const { data: userData } = await supabaseClient
        .from("users")
        .select("points, loyalty_levels(bonus_multiplier)")
        .eq("id", user.id)
        .maybeSingle();

      const multiplier = userData?.loyalty_levels?.bonus_multiplier || 1.0;
      const earnedPoints = Math.floor(amount * multiplier);

      // Create transaction
      const { data: transaction, error: txError } = await supabaseClient
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "earned",
          amount: earnedPoints,
          description: description || `Покупка на сумму ${amount}`,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Update user points
      const { data: updatedUser, error: updateError } = await supabaseClient
        .from("users")
        .update({ points: (userData?.points || 0) + earnedPoints })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ transaction, user: updatedUser }),
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