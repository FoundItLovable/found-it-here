import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Role = "staff" | "student" | "admin" | string;

export type UserWithProfile = User & {
  profile: {
    id: string;
    role: Role | null;
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

  const role = await getRoleForUser(user.id);

  return Object.assign(user, {
    profile: {
      id: user.id,
      role,
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
