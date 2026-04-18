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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("YANDEX_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lat, lng } = await req.json();
    if (typeof lat !== "number" || typeof lng !== "number") {
      return new Response(JSON.stringify({ error: "lat/lng required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${lng},${lat}&format=json&results=1&kind=district`;
    const res = await fetch(url);
    const data = await res.json();

    const members = data?.response?.GeoObjectCollection?.featureMember || [];
    let region = "";
    let area = "";
    let locality = "";
    let ulus = "";

    for (const m of members) {
      const components = m.GeoObject?.metaDataProperty?.GeocoderMetaData?.Address?.Components || [];
      for (const c of components) {
        if (c.kind === "province" && !region) region = c.name;
        if (c.kind === "area" && !area) area = c.name;
        if (c.kind === "locality" && !locality) locality = c.name;
      }
    }

    // Try also broader search for province/locality
    if (!region || !locality) {
      const url2 = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${lng},${lat}&format=json&results=1`;
      const res2 = await fetch(url2);
      const data2 = await res2.json();
      const components = data2?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.metaDataProperty?.GeocoderMetaData?.Address?.Components || [];
      for (const c of components) {
        if (c.kind === "province" && !region) region = c.name;
        if (c.kind === "area" && !area) area = c.name;
        if (c.kind === "locality" && !locality) locality = c.name;
      }
    }

    // Determine ulus: area usually contains "улус" or "район"
    if (area) ulus = area;

    console.log("[reverse-geocode]", { lat, lng, region, area, locality });

    return new Response(JSON.stringify({ region, area, locality, ulus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[reverse-geocode] error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
