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
    console.log("[geocode-address] authHeader present:", !!authHeader);
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[geocode-address] Missing or invalid Authorization header");
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
    console.log("[geocode-address] user:", user?.id, "error:", error?.message);
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("YANDEX_MAPS_API_KEY");
    console.log("[geocode-address] YANDEX_MAPS_API_KEY present:", !!apiKey);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { address } = await req.json();
    console.log("[geocode-address] address:", address);
    if (!address || typeof address !== "string") {
      return new Response(JSON.stringify({ error: "Address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geocodeUrl = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(address)}&format=json&results=1`;
    console.log("[geocode-address] calling Yandex geocoder for:", address);
    const geoRes = await fetch(geocodeUrl);
    const geoData = await geoRes.json();
    console.log("[geocode-address] Yandex status:", geoRes.status, "found:", geoData?.response?.GeoObjectCollection?.metaDataProperty?.GeocoderResponseMetaData?.found);

    const found = geoData?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    if (!found) {
      console.error("[geocode-address] Address not found in Yandex response");
      return new Response(JSON.stringify({ error: "Address not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geocoderMeta = found.metaDataProperty?.GeocoderMetaData;
    const precision = geocoderMeta?.precision;
    const kind = geocoderMeta?.kind;
    console.log("[geocode-address] kind:", kind, "precision:", precision);

    // 1. kind must be "house"
    if (kind === "street") {
      console.error("[geocode-address] Rejected: kind=street, need house number");
      return new Response(JSON.stringify({ error: "no_house_number", message: "Укажите номер дома", kind, precision }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (kind === "locality" || kind === "province" || kind === "country" || kind === "district") {
      console.error("[geocode-address] Rejected: kind=", kind);
      return new Response(JSON.stringify({ error: "too_broad", message: "Адрес слишком общий. Укажите улицу и номер дома", kind, precision }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (kind !== "house") {
      console.error("[geocode-address] Rejected: unexpected kind=", kind);
      return new Response(JSON.stringify({ error: "invalid_kind", message: "Адрес не распознан. Уточните адрес", kind, precision }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. precision must be exact, number, or near
    const allowedPrecisions = ["exact", "number", "near"];
    if (!precision || !allowedPrecisions.includes(precision)) {
      console.error("[geocode-address] Rejected: low precision=", precision);
      return new Response(JSON.stringify({ error: "low_precision", message: "Адрес найден неточно. Уточните номер дома", kind, precision }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [lngStr, latStr] = found.Point.pos.split(" ");
    const lat = parseFloat(parseFloat(latStr).toFixed(5));
    const lng = parseFloat(parseFloat(lngStr).toFixed(5));
    console.log("[geocode-address] result: lat=", lat, "lng=", lng);

    return new Response(JSON.stringify({ lat, lng }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[geocode-address] unhandled error:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
