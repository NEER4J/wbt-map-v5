import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const geojsonPath = path.join(__dirname, '../src/assets/UK_geojsons');
const outputDir = path.join(__dirname, '../src/assets/geojson_chunks');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read all GeoJSON files
const files = fs.readdirSync(geojsonPath)
  .filter(file => file.endsWith('.geojson'));

// Process each file
files.forEach(file => {
  console.log(`Processing ${file}...`);
  const filePath = path.join(geojsonPath, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const geojson = JSON.parse(content);
  
  // Add postcode initials to each feature
  const postcodeInitials = path.basename(file, '.geojson').toUpperCase();
  const features = geojson.features.map(feature => {
    // Only keep essential properties to reduce file size
    const minimalProperties = {
      postcodeInitials,
      name: feature.properties?.name || '',
      // Add any other essential properties you need
    };
    
    return {
      type: 'Feature',
      geometry: feature.geometry,
      properties: minimalProperties
    };
  });
  
  // Create GeoJSON for this postcode area
  const areaGeoJSON = {
    type: 'FeatureCollection',
    features: features
  };
  
  // Write to file with minimal whitespace
  const outputPath = path.join(outputDir, `${postcodeInitials}.geojson`);
  fs.writeFileSync(outputPath, JSON.stringify(areaGeoJSON));
  console.log(`Created ${outputPath}`);
});

console.log('Successfully processed all GeoJSON files'); 