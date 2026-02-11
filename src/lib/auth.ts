import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Role = "staff" | "student" | "admin" | string;

export type UserWithProfile = User & {
  profile: {
    id: string;
    role: Role | null;
    office_id?: string | null;
    office?: {
      office_id: string;
      office_name?: string | null;
      building_name?: string | null;
      office_address?: string | null;
    } | null;
  };
};

export const getSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
};

export const getCurrentUser = async (): Promise<User | null> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user ?? null;
};

export const getRoleForUser = async (userId: string): Promise<Role | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return (data?.role ?? null) as Role | null;
};

export const getCurrentUserWithProfile = async (): Promise<UserWithProfile | null> => {
  const session = await getSession();
  const user = session?.user ?? null;
  if (!user) return null;

  const { data: profileData, error } = await supabase
    .from("profiles")
    .select(
      `
      role,
      office_id,
      office:offices!office_id(
        office_id,
        office_name,
        building_name,
        office_address
      )
    `
    )
    .eq("id", user.id)
    .single();

  if (error) throw error;

  return Object.assign(user, {
    profile: {
      id: user.id,
      role: (profileData?.role ?? null) as Role | null,
      office_id: profileData?.office_id ?? null,
      office: (profileData?.office ?? null) as UserWithProfile["profile"]["office"],
    },
  });
};

export const isStaff = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  const role = await getRoleForUser(user.id);
  return role === "staff";
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  studentId?: string;
}

export const signUp = async (data: SignUpData) => {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName,
        phone_number: data.phoneNumber || null,
        student_id: data.studentId || null,
      },
    },
  });

  console.log("Signup response:", { authData, authError });

  if (authError) {
    throw new Error(authError.message);
  }

  if (!authData.user) {
    throw new Error("Failed to create user");
  }

  // Check if this is an existing user (no new session created)
  // Supabase returns identities as empty array for existing unconfirmed users
  if (authData.user.identities?.length === 0) {
    throw new Error("An account with this email already exists");
  }

  return authData;
};
