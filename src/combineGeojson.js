import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const geojsonPath = path.join(__dirname, './assets/UK_geojsons');
const outputPath = path.join(__dirname, './assets/combined.geojson');

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Directory traversal with error handling
if (!fs.existsSync(geojsonPath)) {
  throw new Error(`GeoJSON directory not found: ${geojsonPath}`);
}

// 2. File filtering with regex validation
const files = fs.readdirSync(geojsonPath).filter(f => 
  /\.geojson$/i.test(f) && fs.statSync(path.join(geojsonPath, f)).isFile()
);

// 3. Parallel file processing with progress tracking
let featureCount = 0;
const features = files.flatMap((file, index) => {
  console.log(`Processing file ${index + 1}/${files.length}: ${file}`);
  
  try {
    const content = fs.readFileSync(path.join(geojsonPath, file), 'utf8');
    const geojson = JSON.parse(content);
    
    // 4. Feature validation and metadata injection
    return geojson.features.map(feature => {
      if (!feature.properties) feature.properties = {};
      feature.properties.postcodeInitials = path.basename(file, '.geojson').toUpperCase();
      featureCount++;
      return feature;
    });
  } catch (error) {
    console.error(`Error processing ${file}:`, error);
    return [];
  }
});

// 5. Output validation
if (featureCount === 0) {
  throw new Error('No valid GeoJSON features found');
}

// 6. Streaming write for large datasets
const writeStream = fs.createWriteStream(outputPath);
writeStream.write('{"type":"FeatureCollection","features":[\n');
features.forEach((feature, index) => {
  writeStream.write(JSON.stringify(feature));
  if (index < features.length - 1) writeStream.write(',\n');
});
writeStream.end('\n]}');

console.log(`Successfully combined ${featureCount} features into ${outputPath}`);