import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
Deno.serve(async (req)=>{
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Validate auth token
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return errorResponse("Missing bearer token", 401);
    }
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return errorResponse("Invalid auth token", 401);
    }
    const userId = String(authData.user.id ?? "").trim();
    // Get reportId from query params or request body
    const url = new URL(req.url);
    let reportId = url.searchParams.get("reportId")?.trim() ?? "";
    if (!reportId && req.method === "POST") {
      const body = await req.json().catch(()=>({}));
      reportId = String(body?.reportId ?? "").trim();
    }
    if (!reportId) {
      return errorResponse("Missing required param: reportId", 400);
    }
    // Verify user owns the report
    const { data: reportData, error: reportError } = await supabase.from("lost_item_reports").select("id, student_id, item_name, description, category, brand, color, lost_location, status").eq("id", reportId).single();
    if (reportError) {
      return errorResponse(`Lost report not found: ${reportError.message}`, 404);
    }
    if (String(reportData?.student_id ?? "").trim() !== userId) {
      return errorResponse("You can only read matches for your own reports", 403);
    }
    // Get potential matches
    const { data: pmRows, error: pmError } = await supabase.from("potential_matches").select("match_id, report_id, lost_item_id").eq("report_id", reportId);
    if (pmError) {
      return errorResponse(`Failed to load potential matches: ${pmError.message}`, 500);
    }
    const foundItemIds = Array.from(new Set((pmRows ?? []).map((row)=>String(row?.lost_item_id ?? "").trim()).filter(Boolean)));
    if (foundItemIds.length === 0) {
      return jsonResponse({
        ok: true,
        reportId,
        matches: []
      });
    }
    // Get found items with office info
    const { data: foundItemsData, error: foundItemsError } = await supabase.from("found_items").select(`
        *,
        office:offices!office_id(
          office_id,
          office_name,
          building_name,
          office_address
        )
      `).in("id", foundItemIds);
    if (foundItemsError) {
      return errorResponse(`Failed to load matched found items: ${foundItemsError.message}`, 500);
    }
    const foundById = new Map((foundItemsData ?? []).map((item)=>[
        String(item.id),
        item
      ]));
    const matches = (pmRows ?? []).map((pm)=>{
      const foundItemId = String(pm?.lost_item_id ?? "");
      const foundItem = foundById.get(foundItemId);
      if (!foundItem) return null;
      return {
        matchId: String(pm?.match_id ?? `${reportId}:${foundItemId}`),
        reportId: String(pm?.report_id ?? reportId),
        foundItemId,
        foundItem
      };
    }).filter(Boolean);
    return jsonResponse({
      ok: true,
      reportId,
      matches
    });
  } catch (err) {
    console.error("get-user-matches error:", err);
    return errorResponse(err instanceof Error ? err.message : "Failed to load potential matches", 500);
  }
});
