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
    const callerId = String(authData.user.id ?? "").trim();

    // Verify caller is staff/admin/owner
    const { data: callerProfile, error: callerError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", callerId)
      .single();
    if (callerError) return errorResponse(`Could not load caller profile: ${callerError.message}`, 403);
    const callerRole = String(callerProfile?.role ?? "").toLowerCase();
    if (!["staff", "admin", "owner"].includes(callerRole)) {
      return errorResponse("Only staff/admin/owner can update matches", 403);
    }

    // Parse request body
    const body = await req.json();
    const foundItemId = String(body?.foundItemId ?? "").trim();
    const actor = String(body?.actor ?? "").toLowerCase();
    if (!foundItemId) return errorResponse("Missing required field: foundItemId", 400);
    if (actor !== "admin") return errorResponse("actor must be 'admin'", 400);

    // Get found item
    const { data: foundItemData, error: foundItemError } = await supabase
      .from("found_items")
      .select("id, office_id, item_name, description, category, brand, color, found_location, status")
      .eq("id", foundItemId)
      .single();
    if (foundItemError) return errorResponse(`Found item not found: ${foundItemError.message}`, 404);
    const foundItem = foundItemData;

    // Get ALL active lost reports (no org filter)
    const { data: reportsData, error: reportsError } = await supabase
      .from("lost_item_reports")
      .select("id, student_id, item_name, description, category, brand, color, lost_location, status")
      .eq("status", "active");
    if (reportsError) return errorResponse(`Failed to query lost reports: ${reportsError.message}`, 500);
    const reports = reportsData ?? [];

    // Score reports against this found item
    const scored = reports
      .map((report) => ({ report, matchScore: calculateMatchScore(report, foundItem) }))
      .filter((row) => row.matchScore >= MATCH_THRESHOLD)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, MATCH_LIMIT);

    // Clear existing matches for this found item
    const { error: deleteError } = await supabase
      .from("potential_matches")
      .delete()
      .eq("lost_item_id", foundItemId);
    if (deleteError) return errorResponse(`Failed to clear existing matches: ${deleteError.message}`, 500);

    let insertedCount = 0;
    if (scored.length > 0) {
      const rowsToInsert = scored.map((row) => ({
        report_id: String(row.report.id),
        lost_item_id: foundItemId,
        score: row.matchScore,
      }));
      const { data: insertedRows, error: insertError } = await supabase
        .from("potential_matches")
        .insert(rowsToInsert)
        .select("match_id");
      if (insertError) return errorResponse(`Failed to insert potential matches: ${insertError.message}`, 500);
      insertedCount = (insertedRows ?? []).length;
    }

    console.log("[update-admin-matches] complete", {
      callerId, foundItemId, reportCount: reports.length, keptCount: scored.length, insertedCount,
    });
    return jsonResponse({ ok: true, foundItemId, reportCount: reports.length, keptCount: scored.length, insertedCount });
  } catch (err) {
    console.error("update-admin-matches error:", err);
    return errorResponse(err instanceof Error ? err.message : "Failed to update potential matches", 500);
  }
});
