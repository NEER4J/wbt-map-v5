import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const GEOJSON_DIR = './src/assets/UK_geojson';
export async function linkGeoJSONToLocations() {
  try {
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('id, postcode_initials');
    if (locationsError) throw locationsError;
    const files = fs.readdirSync(GEOJSON_DIR);
    for (const file of files) {
      const postcodeInitial = path.basename(file, '.geojson');
      const location = locations.find(l => l.postcode_initials === postcodeInitial);

      if (location) {
        const filePath = path.join(GEOJSON_DIR, file);
        const geojsonContent = JSON.parse(fs.readFileSync(filePath));

        // Choose ONE approach (not both):
        // Option 1: Store in database
        const { error: updateError } = await supabase
          .from('locations')
          .update({ geojson_data: geojsonContent })
          .eq('id', location.id);

        if (updateError) throw updateError;

        // OR Option 2: Store in storage
        const { error: storageError } = await supabase
          .storage
          .from('geojson')
          .upload(`${postcodeInitial}.geojson`, filePath);

        if (storageError) throw storageError;

        const { error: pathUpdateError } = await supabase
          .from('locations')
          .update({ geojson_path: `${postcodeInitial}.geojson` })
          .eq('id', location.id);

        if (pathUpdateError) throw pathUpdateError;
      }
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}