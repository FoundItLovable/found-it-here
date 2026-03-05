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
    // Parse request body
    const body = await req.json();
    const reportId = String(body?.reportId ?? "").trim();
    if (!reportId) {
      return errorResponse("Missing required field: reportId", 400);
    }
    // Verify user owns the report
    const { data: reportData, error: reportError } = await supabase.from("lost_item_reports").select("id, student_id").eq("id", reportId).single();
    if (reportError) {
      return errorResponse(`Lost report not found: ${reportError.message}`, 404);
    }
    if (String(reportData?.student_id ?? "").trim() !== userId) {
      return errorResponse("You can only delete your own reports", 403);
    }
    // Delete potential matches first
    const { error: deleteMatchesError } = await supabase.from("potential_matches").delete().eq("report_id", reportId);
    if (deleteMatchesError) {
      return errorResponse(`Failed to delete report potential matches: ${deleteMatchesError.message}`, 500);
    }
    // Delete the report
    const { error: deleteReportError } = await supabase.from("lost_item_reports").delete().eq("id", reportId).eq("student_id", userId);
    if (deleteReportError) {
      return errorResponse(`Failed to delete report: ${deleteReportError.message}`, 500);
    }
    console.log("[delete-lost-report] complete", {
      userId,
      reportId
    });
    return jsonResponse({
      ok: true,
      reportId
    });
  } catch (err) {
    console.error("delete-lost-report error:", err);
    return errorResponse(err instanceof Error ? err.message : "Failed to delete report", 500);
  }
});
