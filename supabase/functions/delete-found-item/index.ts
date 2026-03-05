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
      return errorResponse("Only staff/admin/owner can delete found items", 403);
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
    const { data: foundItemData, error: foundItemError } = await supabase.from("found_items").select("id, office_id").eq("id", foundItemId).single();
    if (foundItemError) {
      return errorResponse(`Found item not found: ${foundItemError.message}`, 404);
    }
    const officeId = String(foundItemData?.office_id ?? "").trim();
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
      return errorResponse("Found item office has no organization_id", 400);
    }
    // Verify caller is in same organization
    if (String(callerProfile?.organization_id ?? "").trim() !== organizationId) {
      return errorResponse("Caller is not in the same organization as the found item office", 403);
    }
    // Delete potential matches first
    const { data: deletedMatches, error: deleteMatchesError } = await supabase.from("potential_matches").delete().eq("lost_item_id", foundItemId).select("match_id");
    if (deleteMatchesError) {
      return errorResponse(`Failed to delete related potential matches: ${deleteMatchesError.message}`, 500);
    }
    // Delete the found item
    const { data: deletedItem, error: deleteItemError } = await supabase.from("found_items").delete().eq("id", foundItemId).select("*").single();
    if (deleteItemError) {
      return errorResponse(`Failed to delete found item: ${deleteItemError.message}`, 500);
    }
    console.log("[delete-found-item] complete", {
      callerId,
      foundItemId,
      organizationId,
      deletedPotentialMatchCount: (deletedMatches ?? []).length
    });
    return jsonResponse({
      ok: true,
      foundItemId,
      organizationId,
      deletedPotentialMatchCount: (deletedMatches ?? []).length,
      deletedItem
    });
  } catch (err) {
    console.error("delete-found-item error:", err);
    return errorResponse(err instanceof Error ? err.message : "Failed to delete found item", 500);
  }
});
