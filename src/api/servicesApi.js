// src/api/servicesApi.js
import { supabase } from "../utils/supabaseClient";

// Add a new service
export const addService = async (name, color) => {
  const { data, error } = await supabase
    .from("services")
    .insert([{ name, color }]);

  if (error) throw error;
  return data;
};

// Fetch all services
export const getServices = async () => {
  const { data, error } = await supabase.from("services").select("*");
  if (error) throw error;
  return data;
};

// Update a service
export const updateService = async (id, name, color) => {
  const { data, error } = await supabase
    .from("services")
    .update({ name, color, updated_at: new Date() })
    .eq("id", id);

  if (error) throw error;
  return data;
};

// Delete a service
export const deleteService = async (id) => {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
};
