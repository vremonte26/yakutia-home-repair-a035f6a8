import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user with their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Use service role to delete all user data and auth account
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Delete in order respecting foreign keys
    await adminClient.from("complaints").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    await adminClient.from("reviews").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    await adminClient.from("responses").delete().eq("master_id", userId);
    
    // Delete responses to user's tasks
    const { data: userTasks } = await adminClient.from("tasks").select("id").eq("client_id", userId);
    if (userTasks && userTasks.length > 0) {
      const taskIds = userTasks.map((t) => t.id);
      await adminClient.from("responses").delete().in("task_id", taskIds);
    }
    
    await adminClient.from("tasks").delete().eq("client_id", userId);
    await adminClient.from("profiles").delete().eq("id", userId);

    // Delete the auth user (also unlinks all OAuth identities)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
