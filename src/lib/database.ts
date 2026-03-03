import { supabase } from "./supabase";

// --------------------------------------------
// Shared types
// --------------------------------------------

export interface OfficeRow {
  office_id: string;
  office_name: string;
  building_name?: string | null;
  office_address?: string | null;
}

export type FoundItemStatus = "available" | "claimed" | string;

export interface FoundItemRow {
  id: string;
  office_id?: string;
  staff_id?: string;
  item_name?: string | null;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  color?: string | null;
  found_location?: string | null;
  current_location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  image_urls?: string[] | null;
  status?: FoundItemStatus;
  show_in_public_catalog?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export interface CreateFoundItemInput {
  item_name?: string;
  description?: string;
  category?: string;
  brand?: string;
  color?: string;
  found_location?: string;
  current_location?: string;
  latitude?: number | null;
  longitude?: number | null;
  image_urls?: string[];
  status?: FoundItemStatus;
  show_in_public_catalog?: boolean;
  [k: string]: unknown;
}

export type UpdateFoundItemInput = Partial<CreateFoundItemInput>;

export interface LostItemReportRow {
  id: string;
  student_id: string;
  item_name?: string | null;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  color?: string | null;
  lost_location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  created_at?: string;
  [k: string]: unknown;
}

export interface ClaimRow {
  id: string;
  found_item_id: string;
  claimant_id: string;
  claim_message?: string | null;
  verification_answers?: unknown;
  review_status?: string | null;
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  [k: string]: unknown;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  is_read: boolean;
  created_at?: string;
  [k: string]: unknown;
}

// --------------------------------------------
// OFFICES
// --------------------------------------------

export const getAllOffices = async (): Promise<OfficeRow[]> => {
  const { data, error } = await supabase.from("offices").select("*").order("office_name");
  if (error) throw error;
  return (data ?? []) as OfficeRow[];
};

export const getOffice = async (officeId: string): Promise<OfficeRow> => {
  const { data, error } = await supabase
    .from("offices")
    .select("*")
    .eq("office_id", officeId)
    .single();
  if (error) throw error;
  return data as OfficeRow;
};

// --------------------------------------------
// FOUND ITEMS
// --------------------------------------------

export const getFoundItems = async (limit = 20, offset = 0): Promise<FoundItemRow[]> => {
  const { data, error } = await supabase
    .from("found_items")
    .select(
      `
      *,
      staff:profiles!staff_id(
        full_name,
        email,
        phone_number,
        office:offices!office_id(
          office_id,
          office_name,
          building_name,
          office_address
        )
      )
    `
    )
    .eq("status", "available")
    .eq("show_in_public_catalog", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as FoundItemRow[];
};

export const getOfficeFoundItems = async (
  officeId: string,
  limit = 200,
  offset = 0
): Promise<FoundItemRow[]> => {
  if (!officeId) throw new Error("officeId is required");

  const { data, error } = await supabase
    .from("found_items")
    .select("*")
    .eq("office_id", officeId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as FoundItemRow[];
};

export const searchFoundItems = async (
  searchQuery: string,
  category: string | null = null
): Promise<FoundItemRow[]> => {
  let query = supabase
    .from("found_items")
    .select(
      `
      *,
      staff:profiles!staff_id(
        full_name,
        office:offices!office_id(office_name, building_name)
      )
    `
    )
    .eq("status", "available")
    .eq("show_in_public_catalog", true);

  if (category) query = query.eq("category", category);

  if (searchQuery) {
    query = query.or(
      `item_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%,color.ilike.%${searchQuery}%`
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FoundItemRow[];
};

export interface PublicCatalogFilters {
  search?: string;
  category?: string;
  officeId?: string;
  color?: string;
  brand?: string;
  dateFrom?: string;
  dateTo?: string;
}

const PAGE_SIZE = 24;

export const getPublicCatalogItems = async (
  filters: PublicCatalogFilters = {},
  offset = 0
): Promise<{ items: FoundItemRow[]; hasMore: boolean }> => {
  let query = supabase
    .from("found_items")
    .select(
      `
      *,
      office:offices!office_id(
        office_id,
        office_name,
        building_name,
        office_address
      )
    `,
      { count: "exact" }
    )
    .eq("status", "available")
    .eq("show_in_public_catalog", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    query = query.or(
      `item_name.ilike.%${q}%,description.ilike.%${q}%,brand.ilike.%${q}%,color.ilike.%${q}%`
    );
  }
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.officeId) query = query.eq("office_id", filters.officeId);
  if (filters.brand?.trim()) query = query.ilike("brand", `%${filters.brand.trim()}%`);
  if (filters.color?.trim()) query = query.ilike("color", `%${filters.color.trim()}%`);
  if (filters.dateFrom) query = query.gte("found_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("found_date", filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;

  const items = (data ?? []) as FoundItemRow[];
  const hasMore = items.length === PAGE_SIZE;

  return { items, hasMore };
};

export const getFoundItem = async (itemId: string): Promise<FoundItemRow> => {
  const { data, error } = await supabase
    .from("found_items")
    .select(
      `
      *,
      staff:profiles!staff_id(
        full_name,
        email,
        phone_number,
        office:offices!office_id(
          office_id,
          office_name,
          building_name,
          office_address
        )
      )
    `
    )
    .eq("id", itemId)
    .single();

  if (error) throw error;
  return data as FoundItemRow;
};

export const createFoundItem = async (itemData: CreateFoundItemInput): Promise<FoundItemRow> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("office_id")
    .eq("id", user.id)
    .single();
  if (profileError) throw profileError;
  const officeId = String((profile as any)?.office_id ?? "").trim();
  if (!officeId) throw new Error("Current staff profile is missing office_id");

  const normalizedCurrentLocation =
    typeof itemData.current_location === "string" && itemData.current_location.trim()
      ? itemData.current_location.trim()
      : null;

  const { data, error } = await supabase
    .from("found_items")
    .insert([
      {
        office_id: officeId,
        ...itemData,
        current_location: normalizedCurrentLocation,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as FoundItemRow;
};

export const updateFoundItem = async (
  itemId: string,
  updates: UpdateFoundItemInput
): Promise<FoundItemRow> => {
  const { data, error } = await supabase
    .from("found_items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single();

  if (error) throw error;
  return data as FoundItemRow;
};

export const deleteFoundItem = async (id: string): Promise<FoundItemRow> => {
  const { data: existing, error: existingError } = await supabase
    .from("found_items")
    .select("image_urls")
    .eq("id", id)
    .single();

  if (existingError) throw existingError;

  const imageUrls = Array.isArray((existing as any)?.image_urls)
    ? ((existing as any).image_urls as unknown[]).map((u) => String(u ?? "")).filter(Boolean)
    : [];

  const { data, error } = await supabase.from("found_items").delete().eq("id", id).select().single();
  if (error) throw error;

  if (imageUrls.length > 0) {
    const results = await Promise.allSettled(imageUrls.map((url) => deleteImage(url)));
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.warn(`deleteFoundItem: deleted row ${id} but failed to delete ${failed.length} image(s) from storage`);
    }
  }

  return data as FoundItemRow;
};

// --------------------------------------------
// LOST ITEM REPORTS
// --------------------------------------------

export const createLostItemReport = async (
  reportData: Partial<LostItemReportRow>
): Promise<LostItemReportRow> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("lost_item_reports")
    .insert([{ student_id: user.id, ...reportData }])
    .select()
    .single();

  if (error) throw error;
  return data as LostItemReportRow;
};

export interface LostReportFilters {
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const getUserLostReports = async (filters: LostReportFilters = {}): Promise<LostItemReportRow[]> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  let query = supabase.from("lost_item_reports").select("*").eq("student_id", user.id);

  if (filters.status) query = query.eq("status", filters.status);

  if (filters.search) {
    query = query.or(
      `item_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`
    );
  }

  const sortBy = filters.sortBy ?? "created_at";
  const sortOrder = filters.sortOrder ?? "desc";
  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LostItemReportRow[];
};

export const updateLostItemReport = async (
  reportId: string,
  updates: Partial<LostItemReportRow>
): Promise<LostItemReportRow> => {
  const { data, error } = await supabase
    .from("lost_item_reports")
    .update(updates)
    .eq("id", reportId)
    .select()
    .single();

  if (error) throw error;
  return data as LostItemReportRow;
};

export const deleteLostItemReport = async (reportId: string): Promise<void> => {
  const { error } = await supabase.from("lost_item_reports").delete().eq("id", reportId);
  if (error) throw error;
};

// --------------------------------------------
// ALL LOST REPORTS (for metrics)
// --------------------------------------------

export const getAllLostReports = async (): Promise<LostItemReportRow[]> => {
  const { data, error } = await supabase
    .from("lost_item_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LostItemReportRow[];
};

// --------------------------------------------
// CLAIMS
// --------------------------------------------

export const getOfficeClaims = async (
  officeId: string,
  limit = 200,
  offset = 0
): Promise<any[]> => {
  if (!officeId) throw new Error("officeId is required");

  const { data, error } = await supabase
    .from("claims")
    .select(
      `
      *,
      found_items!inner(
        id,
        item_name,
        category,
        color,
        brand,
        found_location,
        description,
        office_id
      ),
      profiles!claims_claimant_id_fkey(
        id,
        full_name,
        email,
        phone_number
      )
    `
    )
    .eq("found_items.office_id", officeId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error:", error);
    throw error;
  }
  return data ?? [];
};

export interface CreateClaimInput {
  message: string;
  verificationAnswers: unknown;
}

export const createClaim = async (
  foundItemId: string,
  claimData: CreateClaimInput
): Promise<ClaimRow> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("claims")
    .insert([
      {
        found_item_id: foundItemId,
        claimant_id: user.id,
        claim_message: claimData.message,
        verification_answers: claimData.verificationAnswers,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as ClaimRow;
};

export const getUserClaims = async (): Promise<any[]> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("claims")
    .select(
      `
      *,
      found_item:found_items(
        item_name,
        category,
        image_urls,
        current_location
      )
    `
    )
    .eq("claimant_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const getClaimsForItem = async (foundItemId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from("claims")
    .select(
      `
      *,
      student:profiles!student_id(
        full_name,
        email,
        phone_number,
        student_id
      ),
      found_item:found_items(item_name, category)
    `
    )
    .eq("found_item_id", foundItemId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export interface ReviewClaimInput {
  status: string;
  notes?: string;
}

export const reviewClaim = async (claimId: string, reviewData: ReviewClaimInput): Promise<ClaimRow> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("claims")
    .update({
      review_status: reviewData.status,
      review_notes: reviewData.notes,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .select()
    .single();

  if (error) throw error;
  return data as ClaimRow;
};

export const approveClaim = async (claimId: string, foundItemId: string) => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const { data: claimData, error: claimError } = await supabase
    .from("claims")
    .update({
      review_status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .select()
    .single();

  if (claimError) throw claimError;

  const { data: itemData, error: itemError } = await supabase
    .from("found_items")
    .update({ status: "claimed" })
    .eq("id", foundItemId)
    .select()
    .single();

  if (itemError) throw itemError;

  return { claim: claimData, item: itemData };
};

export const rejectClaim = async (claimId: string, foundItemId: string): Promise<ClaimRow> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("claims")
    .update({
      review_status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .select()
    .single();

  if (error) throw error;

  const { error: itemError } = await supabase.from("found_items").update({ status: "available" }).eq("id", foundItemId);
  if (itemError) throw itemError;

  return data as ClaimRow;
};

// --------------------------------------------
// NOTIFICATIONS
// --------------------------------------------

export const getUserNotifications = async (): Promise<NotificationRow[]> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as NotificationRow[];
};

export const markNotificationAsRead = async (notificationId: string): Promise<NotificationRow> => {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .select()
    .single();

  if (error) throw error;
  return data as NotificationRow;
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw error;
};

export const getUnreadNotificationCount = async (): Promise<number | null> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw error;
  return count ?? null;
};

// --------------------------------------------
// MATCHING ALGORITHM
// --------------------------------------------

export const findPotentialMatches = async (lostItemData: Partial<LostItemReportRow>) => {
  const { data: foundItems, error } = await supabase
    .from("found_items")
    .select(
      `
      *,
      office:offices!office_id(
        office_id,
        office_name,
        building_name,
        office_address
      )
    `
    )
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const matches = (foundItems ?? []).map((foundItem: any) => {
    const score = calculateMatchScore(lostItemData, foundItem);
    return { ...foundItem, matchScore: score };
  });

  return matches
    .filter((item: any) => item.matchScore >= 0.45)
    .sort((a: any, b: any) => b.matchScore - a.matchScore)
    .slice(0, 5);
};

const calculateMatchScore = (lostItem: any, foundItem: any): number => {
  let score = 0;
  let totalWeights = 0;

  const categoryWeight = 0.4;
  totalWeights += categoryWeight;
  if (lostItem.category && foundItem.category) {
    if (String(lostItem.category).toLowerCase() === String(foundItem.category).toLowerCase()) {
      score += categoryWeight;
    }
  }

  const nameWeight = 0.3;
  totalWeights += nameWeight;
  if (lostItem.item_name && foundItem.item_name) {
    const nameSimilarity = calculateTextSimilarity(String(lostItem.item_name), String(foundItem.item_name));
    score += nameSimilarity * nameWeight;
  }

  const colorWeight = 0.15;
  totalWeights += colorWeight;
  if (lostItem.color && foundItem.color) {
    const lostColors = parseCommaSeparatedValues(lostItem.color);
    const foundColors = parseCommaSeparatedValues(foundItem.color);
    const colorSimilarity = calculateListOverlapSimilarity(lostColors, foundColors);
    score += colorSimilarity * colorWeight;
  }

  const brandWeight = 0.15;
  totalWeights += brandWeight;
  if (lostItem.brand && foundItem.brand) {
    if (String(lostItem.brand).toLowerCase() === String(foundItem.brand).toLowerCase()) {
      score += brandWeight;
    }
  }

  const locationWeight = 0.1;
  totalWeights += locationWeight;
  if (lostItem.lost_location && foundItem.found_location) {
    const locationSimilarity = calculateTextSimilarity(String(lostItem.lost_location), String(foundItem.found_location));
    score += locationSimilarity * locationWeight;
  }

  const descriptionWeight = 0.1;
  totalWeights += descriptionWeight;
  if (lostItem.description && foundItem.description) {
    const descSimilarity = calculateKeywordSimilarity(String(lostItem.description), String(foundItem.description));
    score += descSimilarity * descriptionWeight;
  }

  return score / totalWeights;
};

const parseCommaSeparatedValues = (value: unknown): string[] => {
  if (!value) return [];
  return String(value)
    .toLowerCase()
    .split(/[;,/|]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
};

const calculateListOverlapSimilarity = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const overlap = a.filter((item) => setB.has(item));
  return overlap.length / Math.max(a.length, b.length);
};

const calculateTextSimilarity = (text1: string, text2: string): number => {
  if (!text1 || !text2) return 0;

  const normalize = (str: string) => str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);

  if (norm1 === norm2) return 1;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;

  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const commonWords = words1.filter((word) => words2.includes(word) && word.length > 2);

  if (commonWords.length === 0) return 0;
  return commonWords.length / Math.max(words1.length, words2.length);
};

const calculateKeywordSimilarity = (desc1: string, desc2: string): number => {
  if (!desc1 || !desc2) return 0;

  const stop = new Set([
    "the","and","for","are","but","not","you","all","can","had","her","was","one","our","out","day","get","has","him","his","how","man","new","now","old","see","two","way","who","boy","did","its","let","put","say","she","too","use"
  ]);

  const extractKeywords = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w));

  const keywords1 = extractKeywords(desc1);
  const keywords2 = extractKeywords(desc2);

  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set2 = new Set(keywords2);
  const common = keywords1.filter((w) => set2.has(w));
  return common.length / Math.max(keywords1.length, keywords2.length);
};

// --------------------------------------------
// IMAGE UPLOAD
// --------------------------------------------

export const uploadImage = async (file: File): Promise<string> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Not authenticated");

  const fileExt = file.name.split(".").pop();
  const fileName = `${user.id}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("item-images")
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("item-images").getPublicUrl(fileName);

  return data.publicUrl;
};

export const deleteImage = async (publicUrl: string): Promise<void> => {
  const url = String(publicUrl ?? "").trim();
  if (!url) return;

  const marker = "/storage/v1/object/public/item-images/";
  const index = url.indexOf(marker);
  if (index === -1) throw new Error("Invalid image URL for item-images bucket");

  const filePath = decodeURIComponent(url.slice(index + marker.length));
  if (!filePath) return;

  const { error } = await supabase.storage.from("item-images").remove([filePath]);
  if (error) throw error;
};
