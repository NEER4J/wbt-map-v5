// src/api/clientService.js
import { supabase } from "../utils/supabaseClient";
export const assignServicesToClient = async (clientId, serviceIds) => {
  try {
    if (!clientId || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      throw new Error("Invalid input data");
    }
    const clientServices = serviceIds.map((serviceId) => ({
      client_id: clientId,
      service_id: serviceId,
    }));
    const { data, error } = await supabase.from("client_services").insert(clientServices);

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error("Error assigning services:", error.message);
    return { success: false, error: error.message };
  }
};
