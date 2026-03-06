import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { MATCH_THRESHOLD, MATCH_LIMIT, calculateMatchScore } from "../_shared/matching.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth token
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return errorResponse("Missing bearer token", 401);

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return errorResponse("Invalid auth token", 401);
    const userId = String(authData.user.id ?? "").trim();

    // Parse request body
    const body = await req.json();
    const reportId = String(body?.reportId ?? "").trim();
    if (!reportId) return errorResponse("Missing required field: reportId", 400);

    // Get the lost report and verify ownership
    const { data: reportData, error: reportError } = await supabase
      .from("lost_item_reports")
      .select("id, student_id, item_name, description, category, brand, color, lost_location, status")
      .eq("id", reportId)
      .single();
    if (reportError) return errorResponse(`Lost report not found: ${reportError.message}`, 404);
    if (String(reportData.student_id ?? "").trim() !== userId) {
      return errorResponse("You can only update matches for your own reports", 403);
    }
    const report = reportData;

    // Get ALL available found items (no org filter)
    const { data: foundItemsData, error: foundItemsError } = await supabase
      .from("found_items")
      .select("id, office_id, item_name, description, category, brand, color, found_location, status")
      .eq("status", "available");
    if (foundItemsError) return errorResponse(`Failed to query found items: ${foundItemsError.message}`, 500);
    const foundItems = foundItemsData ?? [];

    // Score found items against this report
    const scored = foundItems
      .map((item) => ({ foundItem: item, matchScore: calculateMatchScore(report, item) }))
      .filter((row) => row.matchScore >= MATCH_THRESHOLD)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, MATCH_LIMIT);

    // Clear existing matches for this report
    const { error: clearError } = await supabase
      .from("potential_matches")
      .delete()
      .eq("report_id", reportId);
    if (clearError) return errorResponse(`Failed to clear existing matches: ${clearError.message}`, 500);

    let insertedCount = 0;
    if (scored.length > 0) {
      const rowsToInsert = scored.map((row) => ({
        report_id: reportId,
        lost_item_id: String(row.foundItem.id),
        score: row.matchScore,
      }));
      const { data: insertedRows, error: insertError } = await supabase
        .from("potential_matches")
        .insert(rowsToInsert)
        .select("match_id");
      if (insertError) return errorResponse(`Failed to insert potential matches: ${insertError.message}`, 500);
      insertedCount = (insertedRows ?? []).length;
    }

    console.log("[update-user-matches] complete", {
      userId, reportId, foundItemCount: foundItems.length, keptCount: scored.length, insertedCount,
    });
    return jsonResponse({ ok: true, reportId, foundItemCount: foundItems.length, keptCount: scored.length, insertedCount });
  } catch (err) {
    console.error("update-user-matches error:", err);
    return errorResponse(err instanceof Error ? err.message : "Failed to update potential matches", 500);
  }
});
