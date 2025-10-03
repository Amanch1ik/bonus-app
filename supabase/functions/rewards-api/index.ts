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

    // GET /rewards-api - Get available rewards
    if (req.method === "GET" && pathSegments.length === 1) {
      const { data, error } = await supabaseClient
        .from("rewards")
        .select("*")
        .eq("is_available", true)
        .order("points_cost", { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ data }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST /rewards-api/redeem - Redeem a reward
    if (req.method === "POST" && pathSegments[1] === "redeem") {
      const body = await req.json();
      const { reward_id } = body;

      if (!reward_id) {
        return new Response(
          JSON.stringify({ error: "Reward ID is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get reward details
      const { data: reward, error: rewardError } = await supabaseClient
        .from("rewards")
        .select("*")
        .eq("id", reward_id)
        .maybeSingle();

      if (rewardError) throw rewardError;

      if (!reward) {
        return new Response(
          JSON.stringify({ error: "Reward not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!reward.is_available) {
        return new Response(
          JSON.stringify({ error: "Reward is not available" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (reward.stock !== null && reward.stock <= 0) {
        return new Response(
          JSON.stringify({ error: "Reward is out of stock" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get user points
      const { data: userData, error: userError } = await supabaseClient
        .from("users")
        .select("points")
        .eq("id", user.id)
        .maybeSingle();

      if (userError) throw userError;

      if (!userData || userData.points < reward.points_cost) {
        return new Response(
          JSON.stringify({ error: "Insufficient points" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create user_reward record
      const { data: userReward, error: urError } = await supabaseClient
        .from("user_rewards")
        .insert({
          user_id: user.id,
          reward_id: reward_id,
          status: "pending",
        })
        .select()
        .single();

      if (urError) throw urError;

      // Create transaction
      const { data: transaction, error: txError } = await supabaseClient
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "spent",
          amount: -reward.points_cost,
          description: `Обмен на награду: ${reward.name}`,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Update user points
      const { data: updatedUser, error: updateError } = await supabaseClient
        .from("users")
        .update({ points: userData.points - reward.points_cost })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update stock if applicable
      if (reward.stock !== null) {
        await supabaseClient
          .from("rewards")
          .update({ stock: reward.stock - 1 })
          .eq("id", reward_id);
      }

      return new Response(
        JSON.stringify({ userReward, transaction, user: updatedUser }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // GET /rewards-api/my-rewards - Get user's redeemed rewards
    if (req.method === "GET" && pathSegments[1] === "my-rewards") {
      const { data, error } = await supabaseClient
        .from("user_rewards")
        .select(`
          *,
          rewards (
            name,
            description,
            points_cost,
            image_url
          )
        `)
        .eq("user_id", user.id)
        .order("redeemed_at", { ascending: false });

      if (error) throw error;

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