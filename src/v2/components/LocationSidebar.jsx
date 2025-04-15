import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import './LocationSidebar.css';
const LocationSidebar = ({ onLocationSelect, className, children }) => {
  const [locations, setLocations] = useState([]);
  const [activeRegion, setActiveRegion] = useState(null);
  const [error, setError] = useState(null);
  const [groupedLocations, setGroupedLocations] = useState({});
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .order('city_name');
        if (error) throw error;
        const grouped = data.reduce((acc, location) => {
          if (!acc[location.region]) {
            acc[location.region] = [];
          }
          acc[location.region].push(location);
          return acc;
        }, {});
        setGroupedLocations(grouped);
        setLocations(data);
        if (data.length > 0) {
          setActiveRegion(Object.keys(grouped)[0]);
        }
      } catch (err) {
        console.error('Error fetching locations:', err);
        setError(err.message);
      } 
    };
    fetchLocations();
  }, []);
  if (error) return <div className="location-sidebar-error">Error: {error}</div>;
  return (
    <div className={`location-sidebar ${className}`}>
      <div className="region-tabs">
        {Object.keys(groupedLocations).map(region => (
          <button
            key={region}
            className={`region-tab ${activeRegion === region ? 'active' : ''}`}
            onClick={() => setActiveRegion(region)}
          >
            {region}
          </button>
        ))}
      </div>
      <div className="cities-list">
        {activeRegion && groupedLocations[activeRegion].map(location => (
          <button
            key={location.id}
            className="city-item"
            onClick={() => onLocationSelect(location)}
          >
            {location.city_name}
            <span className="postcode">{location.postcode_initials}</span>
          </button>
        ))}
      </div>
      {children}
    </div>
  );
};
export default LocationSidebar; 