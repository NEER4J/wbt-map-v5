import { useMemo, useState } from "react";
import "./RegionSidebar.css";
const RegionSidebar = ({ isOpen, setIsOpen, regions, postcodeMap, onRegionSelect }) => {
    const [expandedRegions, setExpandedRegions] = useState({});
    const [selectedRegion, setSelectedRegion] = useState(null);
    const REGION_COLORS = {
        'Scotland': '#d81e1e', 
        'North': '#F18F01', 
        'North West': '#2E86AB', 
        'Midlands': '#DD9787', 
        'Wales': '#E1DABD', 
        'South West': '#D7CF07', 
        'South East': '#BEB2C8', 
        'Northern Ireland': '#808080', 
        'East England': '#EEEEEE',
        'default': '#cccccc'  
    };
    const citiesByRegion = useMemo(() => {
      const groupedCities = {};
      Object.values(postcodeMap).forEach(location => {
        if (!location.region) return;
        if (!groupedCities[location.region]) {
          groupedCities[location.region] = [];
        }
        groupedCities[location.region].push({
          id: location.id,
          name: location.city_name,
          postcodeInitials: location.postcode_initials
        });
      });
      Object.keys(groupedCities).forEach(region => {
        groupedCities[region].sort((a, b) => a.name.localeCompare(b.name));
      });
      return groupedCities;
    }, [postcodeMap]);
  
    const toggleRegion = (region) => {
      setExpandedRegions(prev => ({
        ...prev,
        [region]: !prev[region]
      }));
      setSelectedRegion(region);
      onRegionSelect(region);
    };
  
    const selectCity = (cityId, region) => {
      onRegionSelect(region, cityId);
    };
  
    return (
      <div className={`region-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h3>Regions</h3>
          <button className="close-btn" onClick={() => {
            setIsOpen(false);
            onRegionSelect(null, null); 
          }}>×</button>
        </div>
        <div className="region-list">
          {Object.keys(REGION_COLORS)
            .filter(region => region !== 'default')
            .map(region => (
              <div key={region} className="region-item">
                <div 
                  className={`region-header ${selectedRegion === region ? 'selected' : ''}`}
                  onClick={() => toggleRegion(region)}
                >
                  <span 
                    className="color-box" 
                    style={{ backgroundColor: REGION_COLORS[region] }}
                  ></span>
                  <span className="region-name">{region}</span>
                  <span className="dropdown-arrow">
                    {expandedRegions[region] ? '▼' : '▶'}
                  </span>
                </div>
                {expandedRegions[region] && citiesByRegion[region] && (
                  <div className="city-list">
                    {citiesByRegion[region].map(city => (
                      <div 
                        key={city.id} 
                        className="city-item"
                        onClick={() => selectCity(city.id, region)}
                      >
                        {city.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
        {!isOpen && (
          <button 
            className="open-sidebar-btn"
            onClick={() => setIsOpen(true)}
          >
            ◀
          </button>
        )}
      </div>
    );
  };

  export default RegionSidebar;