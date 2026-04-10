import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Якутск центр: 62.0355, 129.6755
const YAKUTSK_LAT = 62.0355;
const YAKUTSK_LNG = 129.6755;
const MAX_RADIUS_KM = 50;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

    const { address } = await req.json();
    console.log("[geocode-address] address:", address);
    if (!address || typeof address !== "string") {
      return new Response(JSON.stringify({ error: "Address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geocodeUrl = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(address)}&format=json&results=1`;
    const geoRes = await fetch(geocodeUrl);
    const geoData = await geoRes.json();

    const found = geoData?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    if (!found) {
      console.error("[geocode-address] Address not found");
      return new Response(JSON.stringify({ error: "Address not found", message: "Адрес не найден" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geocoderMeta = found.metaDataProperty?.GeocoderMetaData;
    const precision = geocoderMeta?.precision;
    const kind = geocoderMeta?.kind;
    const fullAddress = geocoderMeta?.text || found.name || "";
    const addressComponents = geocoderMeta?.Address?.Components || [];

    // Extract city from components
    const cityComponent = addressComponents.find(
      (c: any) => c.kind === "locality"
    );
    const cityName = cityComponent?.name || "";

    console.log("[geocode-address] fullAddress:", fullAddress);
    console.log("[geocode-address] city:", cityName, "kind:", kind, "precision:", precision);

    // 1. kind must be "house"
    if (kind === "street") {
      return new Response(JSON.stringify({ error: "no_house_number", message: "Укажите номер дома", kind, precision, fullAddress }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (kind === "locality" || kind === "province" || kind === "country" || kind === "district") {
      return new Response(JSON.stringify({ error: "too_broad", message: "Адрес слишком общий. Укажите улицу и номер дома", kind, precision, fullAddress }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (kind !== "house") {
      return new Response(JSON.stringify({ error: "invalid_kind", message: "Адрес не распознан. Уточните адрес", kind, precision, fullAddress }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. precision must be exact, number, or near
    const allowedPrecisions = ["exact", "number", "near"];
    if (!precision || !allowedPrecisions.includes(precision)) {
      return new Response(JSON.stringify({ error: "low_precision", message: "Адрес найден неточно. Уточните номер дома", kind, precision, fullAddress }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Check coordinates are within radius of Yakutsk
    const [lngStr, latStr] = found.Point.pos.split(" ");
    const lat = parseFloat(parseFloat(latStr).toFixed(5));
    const lng = parseFloat(parseFloat(lngStr).toFixed(5));
    const distKm = haversineKm(YAKUTSK_LAT, YAKUTSK_LNG, lat, lng);

    console.log("[geocode-address] lat:", lat, "lng:", lng, "distance from Yakutsk:", distKm.toFixed(1), "km");
    console.log("[geocode-address] found city:", cityName, "fullAddress:", fullAddress);

    if (distKm > MAX_RADIUS_KM) {
      console.error("[geocode-address] Rejected: outside Yakutsk radius, dist=", distKm.toFixed(1), "km, city=", cityName);
      return new Response(JSON.stringify({
        error: "outside_city",
        message: `Адрес не найден в Якутске. Яндекс нашёл: «${fullAddress}». Уточните название улицы`,
        fullAddress,
        cityName,
        distKm: Math.round(distKm),
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ lat, lng, fullAddress }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[geocode-address] unhandled error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
