import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { MATCH_THRESHOLD, MATCH_LIMIT, calculateMatchScore } from "../_shared/matching.ts";
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
    const callerId = String(authData.user.id ?? "").trim();
    // Get caller profile
    const { data: callerProfile, error: callerError } = await supabase.from("profiles").select("id, role, organization_id").eq("id", callerId).single();
    if (callerError) {
      return errorResponse(`Could not load caller profile: ${callerError.message}`, 403);
    }
    const callerRole = String(callerProfile?.role ?? "").toLowerCase();
    if (![
      "staff",
      "admin",
      "owner"
    ].includes(callerRole)) {
      return errorResponse("Only staff/admin/owner can update matches", 403);
    }
    // Parse request body
    const body = await req.json();
    const foundItemId = String(body?.foundItemId ?? "").trim();
    const actor = String(body?.actor ?? "").toLowerCase();
    if (!foundItemId) {
      return errorResponse("Missing required field: foundItemId", 400);
    }
    if (actor !== "admin") {
      return errorResponse("actor must be 'admin'", 400);
    }
    // Get found item
    const { data: foundItemData, error: foundItemError } = await supabase.from("found_items").select("id, office_id, item_name, description, category, brand, color, found_location, status").eq("id", foundItemId).single();
    if (foundItemError) {
      return errorResponse(`Found item not found: ${foundItemError.message}`, 404);
    }
    const foundItem = foundItemData;
    const officeId = String(foundItem?.office_id ?? "").trim();
    if (!officeId) {
      return errorResponse("Found item has no office_id", 400);
    }
    // Get office organization
    const { data: officeData, error: officeError } = await supabase.from("offices").select("organization_id").eq("office_id", officeId).single();
    if (officeError) {
      return errorResponse(`Could not resolve office organization: ${officeError.message}`, 400);
    }
    const organizationId = String(officeData?.organization_id ?? "").trim();
    if (!organizationId) {
      return jsonResponse({
        ok: true,
        foundItemId,
        organizationId: null,
        reportCount: 0,
        keptCount: 0,
        insertedCount: 0,
        reason: "office has no organization_id"
      });
    }
    // Verify caller is in same organization
    if (String(callerProfile?.organization_id ?? "").trim() !== organizationId) {
      return errorResponse("Caller is not in the same organization as the found item office", 403);
    }
    // Get organization profiles
    const { data: orgProfiles, error: profilesError } = await supabase.from("profiles").select("id").eq("organization_id", organizationId);
    if (profilesError) {
      return errorResponse(`Failed to query org profiles: ${profilesError.message}`, 500);
    }
    const studentIds = (orgProfiles ?? []).map((p)=>String(p?.id ?? "").trim()).filter(Boolean);
    if (studentIds.length === 0) {
      return jsonResponse({
        ok: true,
        foundItemId,
        organizationId,
        reportCount: 0,
        keptCount: 0,
        insertedCount: 0
      });
    }
    // Get active lost reports
    const { data: reportsData, error: reportsError } = await supabase.from("lost_item_reports").select("id, student_id, item_name, description, category, brand, color, lost_location, status").in("student_id", studentIds).eq("status", "active");
    if (reportsError) {
      return errorResponse(`Failed to query lost reports: ${reportsError.message}`, 500);
    }
    const reports = reportsData ?? [];
    // Calculate match scores
    const scored = reports.map((report)=>({
        report,
        matchScore: calculateMatchScore(report, foundItem)
      })).filter((row)=>row.matchScore >= MATCH_THRESHOLD).sort((a, b)=>b.matchScore - a.matchScore).slice(0, MATCH_LIMIT);
    const statusCounts = reports.reduce((acc, report)=>{
      const key = String(report.status ?? "null");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    // Clear existing matches for this found item
    const { error: deleteError } = await supabase.from("potential_matches").delete().eq("lost_item_id", foundItemId);
    if (deleteError) {
      return errorResponse(`Failed to clear existing matches: ${deleteError.message}`, 500);
    }
    let insertedCount = 0;
    if (scored.length > 0) {
      const candidateRows = scored.map((row)=>({
          report_id: String(row.report.id),
          lost_item_id: foundItemId
        }));
      const uniqueRows = Array.from(new Map(candidateRows.map((row)=>[
          `${row.report_id}:${row.lost_item_id}`,
          row
        ])).values());
      const reportIds = uniqueRows.map((row)=>row.report_id);
      let rowsToInsert = uniqueRows;
      if (reportIds.length > 0) {
        const { data: existingPairs, error: existingPairsError } = await supabase.from("potential_matches").select("report_id,lost_item_id").eq("lost_item_id", foundItemId).in("report_id", reportIds);
        if (existingPairsError) {
          return errorResponse(`Failed to verify existing matches: ${existingPairsError.message}`, 500);
        }
        const existingSet = new Set((existingPairs ?? []).map((row)=>`${String(row.report_id)}:${String(row.lost_item_id)}`));
        rowsToInsert = uniqueRows.filter((row)=>!existingSet.has(`${row.report_id}:${row.lost_item_id}`));
      }
      if (rowsToInsert.length === 0) {
        return jsonResponse({
          ok: true,
          foundItemId,
          organizationId,
          reportCount: reports.length,
          statusCounts,
          keptCount: scored.length,
          insertedCount: 0,
          skippedExistingCount: uniqueRows.length
        });
      }
      const { data: insertedRows, error: insertError } = await supabase.from("potential_matches").insert(rowsToInsert).select("match_id");
      if (insertError) {
        return errorResponse(`Failed to insert potential matches: ${insertError.message}`, 500);
      }
      insertedCount = (insertedRows ?? []).length;
    }
    console.log("[update-admin-matches] complete", {
      callerId,
      foundItemId,
      organizationId,
      reportCount: reports.length,
      statusCounts,
      keptCount: scored.length,
      insertedCount
    });
    return jsonResponse({
      ok: true,
      foundItemId,
      organizationId,
      reportCount: reports.length,
      statusCounts,
      keptCount: scored.length,
      insertedCount
    });
  } catch (err) {
    console.error("update-admin-matches error:", err);
    return errorResponse(err instanceof Error ? err.message : "Failed to update potential matches", 500);
  }
});
