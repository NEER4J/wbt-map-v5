// src/utils/auth.js

import {supabase} from "./supabaseClient";
export const loginUser = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error("Login Error:", error.message);
    return { success: false, message: error.message };
  }
  console.log("User Logged In:", data.user);
  return { success: true, user: data.user };
};
export const logoutUser = async () => {
  await supabase.auth.signOut();
  console.log("User logged out");
};
