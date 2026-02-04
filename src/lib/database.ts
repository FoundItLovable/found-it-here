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
  staff_id: string;
  item_name?: string | null;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  color?: string | null;
  found_location?: string | null;
  current_location?: string | null;
  image_urls?: string[] | null;
  status?: FoundItemStatus;
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
  image_urls?: string[];
  status?: FoundItemStatus;
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
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as FoundItemRow[];
};

export const getOfficeFoundItems = async (
  staffId: string,
  limit = 200,
  offset = 0
): Promise<FoundItemRow[]> => {
  if (!staffId) throw new Error("officeId is required");

  const { data, error } = await supabase
    .from("found_items")
    .select("*")
    .eq("staff_id", staffId)
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
    .eq("status", "available");

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

  const { data, error } = await supabase
    .from("found_items")
    .insert([{ staff_id: user.id, ...itemData }])
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
  const { data, error } = await supabase.from("found_items").delete().eq("id", id).select().single();
  if (error) throw error;
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
// CLAIMS
// --------------------------------------------

export const getOfficeClaims = async (
  staffId: string,
  limit = 200,
  offset = 0
): Promise<any[]> => {
  if (!staffId) throw new Error("staffId is required");

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
        staff_id
      ),
      profiles!claims_claimant_id_fkey(
        id,
        full_name,
        email,
        phone_number
      )
    `
    )
    .eq("found_items.staff_id", staffId)
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
      staff:profiles!staff_id(
        full_name,
        email,
        office:offices!office_id(
          office_name,
          building_name,
          office_address
        )
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
    .filter((item: any) => item.matchScore >= 0.3)
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
    const a = String(lostItem.color).toLowerCase();
    const b = String(foundItem.color).toLowerCase();
    if (a.includes(b) || b.includes(a)) score += colorWeight;
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
