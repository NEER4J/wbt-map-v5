import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, Popup } from "react-leaflet";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import Logo from "../../assets/logo.png";
import "./Map.css";
import L from "leaflet";
import centroid from '@turf/centroid';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import simplify from '@turf/simplify';
import pointOnFeature from '@turf/point-on-feature';
import area from '@turf/area';
import { supabase } from "../../utils/supabaseClient";
import dark_blue from "../../assets/markersImage/dark_blue.png";
import dark_green from "../../assets/markersImage/dark_green.png";
import light_blue from "../../assets/markersImage/light_blue.png";
import light_green from "../../assets/markersImage/light_green.png";
import multiplecolor from "../../assets/markersImage/multiplecolor.png";
import orange from "../../assets/markersImage/orange.png";
import pink from "../../assets/markersImage/pink.png";
import red from "../../assets/markersImage/red.png";
import yellow from "../../assets/markersImage/yellow.png";
import purple from "../../assets/markersImage/purple.png";
import { LiaMapMarkerSolid } from "react-icons/lia";
import RegionSidebar from "../RegionSidebar/RegionSidebar";
import { Link } from "react-router-dom";

const jumpMarkerAnimation = `
  @keyframes markerJump {
    0% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0); }
  }
  .marker-jump {
    animation: markerJump 0.5s ease;
  }
`;

const MarkerRef = ({ position, icon, children, isActive, serviceId }) => {
  const markerRef = useRef(null);
  useEffect(() => {
    if (isActive && markerRef.current) {
      const markerElement = markerRef.current.getElement();
      markerElement.classList.remove('marker-jump');
      void markerElement.offsetWidth; 
      markerElement.classList.add('marker-jump');
      setTimeout(() => {
        markerElement.classList.remove('marker-jump');
      }, 500);
    }
  }, [isActive]);

  const handleMarkerClick = (e) => {
    if (markerRef.current) {
      const map = markerRef.current._map;
      map.setView(position, 10, { animate: true });
    }
  };

  return (
    <Marker 
      position={position} 
      icon={icon} 
      ref={markerRef}
      eventHandlers={{
        add: (e) => {
          if (e.target && serviceId) {
            const element = e.target.getElement();
            element.setAttribute('data-service-id', serviceId);
          }
        },
        click: handleMarkerClick
      }}
    >
      {children}
    </Marker>
  );
};
const ClientSearch = ({ clients, onSelectClient, mapRef }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const results = clients.filter(client => 
        client.business_name.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5); 
      setSearchResults(results);
      setShowResults(true);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchTerm, clients]);
  const handleSelectClient = (client) => {
    onSelectClient(client);
    setSearchTerm(client.business_name);
    setShowResults(false);
    if (mapRef.current && client.lat && client.lang) {
      const map = mapRef.current;
      map.setView(
        [parseFloat(client.lat), parseFloat(client.lang)], 
        10,
        { animate: false }
      );
    }
  };
  const getServiceAvailability = (locationId, services, locationSlots) => {
    if (!locationId || !locationSlots[locationId]) {
      return Object.values(services).map(service => ({
        ...service,
        slots: 0,
        available: true,
        businesses: []
      }));
    }
    return Object.values(services).map(service => {
      const slotData = locationSlots[locationId][service.id] || {
        totalSlots: 2,
        usedSlots: 0,
        businesses: []
      };
      return {
        ...service,
        slots: slotData.usedSlots, 
        available: slotData.usedSlots < 2,
        businesses: slotData.businesses
      };
    });
  };
  return (
    <div className="client-search-container">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          className="client-search-input"
        />
        {searchTerm && (
          <button 
            className="clear-search-button"
            onClick={() => {
              setSearchTerm('');
              setShowResults(false);
            }}
          >
            ×
          </button>
        )}
      </div>
      {showResults && searchResults.length > 0 && (
        <ul className="search-results">
          {searchResults.map(client => (
            <li 
              key={client.id} 
              onClick={() => handleSelectClient(client)}
              className="search-result-item"
            >
              {client.business_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
const REGION_COLORS = {
  'Scotland': '#d81e1e', 
  'North': '#F18F01', 
  'North West': '#2E86AB', 
  'Midlands': '#DD9787', 
  'Wales': '#E1DABD', 
  'South West ': '#D7CF07', 
  'South East': '#BEB2C8', 
  'Northern Ireland': '#808080', 
  'East Anglia': '#EEEEEE',
  'default': '#cccccc'  
};
const markerImages = {
  "#0236ec": dark_blue,    
  "#18c6e6": light_green,  
  "#FF6000": orange,      
  "#B407F9": purple,       
  "#318BFF": light_blue,  
  "#d10216": red,          
  "#006400": dark_green,  
  "#00E3D8": light_blue   
};
const getClosestMarkerImage = (color) => {
  if (!color || typeof color !== 'string') return dark_blue;
  if (markerImages[color]) return markerImages[color];
  color = color.toLowerCase();
  const colorMappings = {
    'blue': light_blue,
    'red': red,
    'green': dark_green,
    'orange': orange,
    'pink': pink,
    'yellow': yellow
  };
  for (const [keyword, image] of Object.entries(colorMappings)) {
    if (color.includes(keyword)) return image;
  }
  return dark_blue;
};
const createMarkerIcon = (colors) => {
  let markerImage = colors.length > 1 ? multiplecolor : getClosestMarkerImage(colors[0]);
  console.log('Creating marker icon with image:', markerImage);
  
  // Create a default icon as fallback
  const defaultIcon = L.divIcon({
    html: `<div style="width: 30px; height: 42px; background-color: red; border-radius: 50%;"></div>`,
    className: "custom-marker", 
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -40],
  });

  try {
    return L.divIcon({
      html: `<div style="width: 30px; height: 42px; display: flex; align-items: center; justify-content: center;">
              <img src="${markerImage}" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
            </div>`,
      className: "custom-marker", 
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -40],
    });
  } catch (error) {
    console.error('Error creating marker icon:', error);
    return defaultIcon;
  }
};
const CHUNK_SIZE = 10;
const DEFAULT_CENTER = [54.5, -2.5];
const DEFAULT_ZOOM = 6;
const ZOOM_THRESHOLD = 5; // Lower the zoom threshold to see if markers appear
const Map = () => { 
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState({});
  const [clientServices, setClientServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regionData, setRegionData] = useState({});
  const [selectedService, setSelectedService] = useState(null);
  const [activeMarkers, setActiveMarkers] = useState([]);
  const mapRef = useRef(null);
  const [locationSlots, setLocationSlots] = useState({});
  const [cityToLocationMap, setCityToLocationMap] = useState({});
  const [selectedClient, setSelectedClient] = useState(null);
  const [postcodeMap, setPostcodeMap] = useState({});
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedCityId, setSelectedCityId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [processedGeoData, setProcessedGeoData] = useState(null);
  const [isLoadingGeoJSON, setIsLoadingGeoJSON] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);

  useEffect(() => {
    const loadGeoJSON = async () => {
      try {
        setIsLoadingGeoJSON(true);
        const response = await fetch('/combined.geojson');
        if (!response.ok) {
          throw new Error('Failed to load GeoJSON file');
        }
        const data = await response.json();
        
        if (Object.keys(postcodeMap).length > 0) {
          const processedData = {
            type: 'FeatureCollection',
            features: data.features.map(feature => {
              const postcodeInitials = feature.properties.postcodeInitials;
              const locationData = postcodeMap[postcodeInitials];
              
              if (locationData) {
                feature.properties.region = locationData.region;
                feature.properties.color = REGION_COLORS[locationData.region] || REGION_COLORS.default;
                feature.properties.locationId = locationData.id;
              } else {
                feature.properties.region = 'default';
                feature.properties.color = REGION_COLORS.default;
              }
              
              return feature;
            })
          };
          setProcessedGeoData(processedData);
        }
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
        setError(prev => prev || 'Failed to load map data');
      } finally {
        setIsLoadingGeoJSON(false);
      }
    };

    loadGeoJSON();
  }, [postcodeMap]);

  const mapBounds = useMemo(() => {
    if (!processedGeoData || !processedGeoData.features || processedGeoData.features.length === 0) {
      return null;
    }
    const geojsonLayer = L.geoJSON(processedGeoData);
    return geojsonLayer.getBounds();
  }, [processedGeoData]);

  const getFeatureStyle = useCallback((feature) => {
    const color = feature.properties?.color || REGION_COLORS.default;
    const isSelected = selectedRegion === feature.properties.region;
    const isSelectedCity = selectedCityId && selectedCityId === feature.properties.locationId;
    return {
      color: isSelected || isSelectedCity ? "#ffffff" : "#ffffff",
      weight: isSelected || isSelectedCity ? 2 : 1,
      fillColor: color,
      fillOpacity: isSelectedCity ? 0.8 : isSelected ? 0.6 : 1
    };
  }, [selectedRegion, selectedCityId]);
  const handleRegionSelect = (region, cityId = null) => {
    if (!region && !cityId) {
      setSelectedRegion(null);
      setSelectedCityId(null);
      if (mapRef.current) {
        // Return to default view smoothly
        mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM, {
          animate: true,
          duration: 1
        });
      }
      return;
    }
    setSelectedRegion(region);
    setSelectedCityId(cityId);
    if (mapRef.current && processedGeoData && processedGeoData.features) {
      const map = mapRef.current;
      const regionFeatures = [];
      processedGeoData.features.forEach(feature => {
        if (feature.properties.region === region) {
          regionFeatures.push(feature);
          if (cityId && feature.properties.locationId === cityId) {
            const featureLayer = L.geoJSON(feature);
            const bounds = featureLayer.getBounds();
            if (bounds) {
              map.flyToBounds(bounds, { 
                padding: [100, 100],
                duration: 1.2,
                easeLinearity: 0.25,
                maxZoom: 11 
              });
            }
          }
        }
      });
      if (regionFeatures.length > 0 && !cityId) {
        const regionsLayer = L.geoJSON(regionFeatures);
        const bounds = regionsLayer.getBounds();
        if (bounds) {
          map.flyToBounds(bounds, { 
            padding: [50, 50],
            duration: 1.2,
            easeLinearity: 0.25,
            maxZoom: 9 
          });
        }
      }
    }
  };
  const getServiceAvailability = useCallback((locationId) => {
    if (!locationId || !locationSlots[locationId]) {
      return Object.values(services).map(service => ({
        ...service,
        slots: 0,
        available: true,
        businesses: []
      }));
    }
    return Object.values(services).map(service => {
      const slotData = locationSlots[locationId][service.id] || {
        totalSlots: 2,
        usedSlots: 0,
        businesses: []
      };
      return {
        ...service,
        slots: slotData.usedSlots, 
        available: slotData.usedSlots < 2,
        businesses: slotData.businesses
      };
    });
  }, [services, locationSlots]);

  const findLabelPosition = useCallback((feature) => {
    try {
      const simplified = simplify(feature, { tolerance: 0.01, highQuality: true });
      if (simplified.geometry.type === 'MultiPolygon') {
        const largestPolygon = simplified.geometry.coordinates
          .map(poly => ({ poly, size: area({ type: 'Polygon', coordinates: poly }) }))
          .reduce((a, b) => a.size > b.size ? a : b).poly;
        const mainPolygon = {
          type: 'Feature',
          properties: simplified.properties,
          geometry: {
            type: 'Polygon',
            coordinates: largestPolygon
          }
        };
        const center = centroid(mainPolygon);
        if (booleanPointInPolygon(center, mainPolygon)) {
          return center.geometry.coordinates.reverse();
        }
      } else {
        const center = centroid(simplified);
        if (booleanPointInPolygon(center, simplified)) {
          return center.geometry.coordinates.reverse();
        }
      }
      const pt = pointOnFeature(simplified);
      const point = pt.geometry.coordinates.reverse();
      if (booleanPointInPolygon({ type: 'Point', coordinates: point }, simplified)) {
        return point;
      }
      const bounds = L.geoJSON(simplified).getBounds();
      if (bounds) {
        const center = bounds.getCenter();
        if (booleanPointInPolygon({ type: 'Point', coordinates: [center.lng, center.lat] }, simplified)) {
          return [center.lat, center.lng];
        }
      }
      return point;
    } catch (error) {
      console.error('Error finding label position:', error);
      return null;
    }
  }, []);
  const onEachFeature = useCallback((feature, layer) => {
    layer.on({
      add: (e) => {
        const labelPosition = findLabelPosition(feature);
        if (labelPosition) {
          const label = L.marker(labelPosition, {
            icon: L.divIcon({
              className: 'postcode-label',
              html: `<div>${feature.properties.postcodeInitials}</div>`,
              iconSize: [60, 30],
              iconAnchor: [30, 15],
              popupAnchor: [0, -15]
            }),
            interactive: false,
            zIndexOffset: 1000
          }).addTo(e.target._map);
        }
      },
      mouseover: async (e) => {
        try {
          if (selectedService === null) return;
          const locationId = feature.properties.locationId;
          const locationData = postcodeMap[feature.properties.postcodeInitials];
          if (!locationId || !locationData) {
            layer.bindPopup(`<strong>${locationData?.city_name || 'Unknown Location'}</strong>`);
            layer.openPopup();
            return;
          }
          let popupContent = `
            <div class="location-services-popup">
              <h3 style="text-align: center; margin-bottom: 10px;">${locationData.city_name}</h3>
              <hr style="margin: 10px 0;">
          `;
          const servicesByBusiness = {};
          const availableServices = getServiceAvailability(locationId);
          let servicesToDisplay = availableServices;
          if (selectedService !== 'all') {
            servicesToDisplay = availableServices.filter(service => service.id === selectedService);
          }
          servicesToDisplay.forEach(service => {
            const slotData = locationSlots[locationId]?.[service.id] || {
              totalSlots: 2,
              usedSlots: 0,
              businesses: []
            };
            slotData.businesses.forEach(business => {
              if (!servicesByBusiness[business.name]) {
                servicesByBusiness[business.name] = [];
              }
              servicesByBusiness[business.name].push({
                serviceName: service.name,
                serviceColor: service.color,
                slotsUsed: slotData.usedSlots,
                totalSlots: slotData.totalSlots
              });
            });
          });
          Object.entries(servicesByBusiness).forEach(([businessName, businessServices]) => {
            popupContent += `
              <div class="business-services">
                <h4>${businessName}</h4>
                <ul style="list-style-type: none; padding: 0;">
            `;
            businessServices.forEach(service => {
              const availabilityClass = service.slotsUsed >= service.totalSlots 
                ? 'service-full' 
                : 'service-available';
              popupContent += `
                <li>
                  <span class="service-dot ${availabilityClass}" 
                        style="background-color: ${service.serviceColor}"></span>
                  ${service.serviceName} (${service.slotsUsed}/${service.totalSlots} slots)
                </li>
              `;
            });
            popupContent += `</ul></div>`;
          });
          if (Object.keys(servicesByBusiness).length === 0) {
            popupContent += `
              <div class="no-services">
                <p>No ${selectedService === 'all' ? 'services' : 'slots'} allocated for this location</p>
              </div>
            `;
          }
          popupContent += `</div>`;
          layer.bindPopup(popupContent, { maxWidth: 300, className: 'location-services-tooltip' });
          layer.openPopup(e.latlng);
        } catch (err) {
          console.error('Error updating popup:', err);
          layer.bindPopup(`<strong>Error loading data</strong>`);
          layer.openPopup(e.latlng);
        }
      },
      mouseout: () => {
        if (layer._popup && !layer._popup._isOpen) {
          layer.closePopup();
        }
      },
      click: (e) => {
        if ((selectedService === 'all' || selectedService) && layer._popup) {
          layer.openPopup(e.latlng);
        }
      }
    });
  }, [selectedService, postcodeMap, locationSlots, findLabelPosition, getServiceAvailability]);
  const handleZoomEnd = useCallback((e) => {
    setCurrentZoom(e.target.getZoom());
  }, []);
  const renderGeoJSONLayers = useCallback(() => {
    if (!processedGeoData || !processedGeoData.features) {
      return null;
    }
    if (currentZoom < ZOOM_THRESHOLD) {
      return (
        <GeoJSON
          key={`geojson-${selectedService}-low`}
          data={processedGeoData}
          style={getFeatureStyle}
          onEachFeature={onEachFeature}
          simplifyFactor={0.1}
        />
      );
    }
    return (
      <GeoJSON
        key={`geojson-${selectedService}-high`}
        data={processedGeoData}
        style={getFeatureStyle}
        onEachFeature={onEachFeature}
      />
    );
  }, [processedGeoData, getFeatureStyle, onEachFeature, selectedService, currentZoom]);

  const filteredClients = useMemo(() => {
    if (!selectedService) return clients;
    if (selectedService === 'all') return clients;
    return clients.filter(client => {
      const serviceIds = clientServices[client.id] || [];
      return serviceIds.includes(selectedService);
    });
  }, [clients, clientServices, selectedService]);
  useEffect(() => {
    if (processedGeoData && Object.keys(cityToLocationMap).length > 0) {
      const featureMap = {};
      if (processedGeoData.features) {
        processedGeoData.features.forEach(feature => {
          if (feature.properties && feature.properties.name) {
            const cityName = feature.properties.name
              .toLowerCase()
              .replace(/ and /g, ' & ')
              .replace(/[-/]/g, ' ')
              .replace(/\s+/g, ' ')
              .replace(/\b(county|district|borough|region|city of|the)\b/g, '')
              .trim();
            if (cityToLocationMap[cityName]) {
              featureMap[feature.properties.name] = regionData[cityName];
            }
          }
        });
      }
    }
  }, [processedGeoData, cityToLocationMap, regionData]);
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = jumpMarkerAnimation;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  useEffect(() => {
    const fetchRegionData = async () => {
      try {
        const { data } = await supabase
          .from('locations')
          .select('id, region, postcode_initials, city_name');
        const postcodeMap = {};
        data.forEach(location => {
          postcodeMap[location.postcode_initials] = {
            region: location.region,
            id: location.id,
            city_name: location.city_name
          };
        });
        setPostcodeMap(postcodeMap);
      } catch (err) {
        console.error("Error fetching region data:", err);
      }
    };
    fetchRegionData();
  }, []);
  useEffect(() => {
    const fetchLocationSlots = async () => {
      try {
        const { data: slots, error } = await supabase
          .from('location_slot')
          .select(`
            id, 
            location_id, 
            service_id, 
            slot_number, 
            status, 
            client_id,
            clients!inner(business_name)
          `);
        if (error) throw error;
        const slotMap = {};
        slots.forEach(slot => {
          const locationId = slot.location_id;
          const serviceId = slot.service_id;
          if (!slotMap[locationId]) slotMap[locationId] = {};
          if (!slotMap[locationId][serviceId]) {
            slotMap[locationId][serviceId] = {
              totalSlots: 2, 
              usedSlots: 0,
              businesses: []
            };
          }
          if (slot.client_id) {
            slotMap[locationId][serviceId].usedSlots += 1;
            slotMap[locationId][serviceId].businesses.push({
              name: slot.clients?.business_name || 'Unknown Business'
            });
          }
        });
        setLocationSlots(slotMap);
      } catch (err) {
        console.error("Error fetching location slots:", err);
        setError(prev => prev || err.message);
      }
    };
    fetchLocationSlots();
  }, []);
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('id, name, color');
        if (error) throw error;
        const serviceMap = {};
        data.forEach(service => {
          serviceMap[service.id] = service;
        });
        setServices(serviceMap);
      } catch (err) {
        console.error("Error fetching services:", err);
        setError(prev => prev || err.message);
      }
    };
    fetchServices();
  }, []);
  useEffect(() => {
    const fetchClientServices = async () => {
      try {
        const { data, error } = await supabase
          .from('client_services')
          .select('client_id, service_id');
        if (error) throw error;
        const clientServiceMap = {};
        data.forEach(cs => {
          if (!clientServiceMap[cs.client_id]) {
            clientServiceMap[cs.client_id] = [];
          }
          clientServiceMap[cs.client_id].push(cs.service_id);
        });                               
        setClientServices(clientServiceMap);
      } catch (err) {
        console.error("Error fetching client services:", err);
        setError(prev => prev || err.message);
      }
    };
    fetchClientServices();
  }, []);
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*');
        if (error) throw error;
        console.log('Fetched clients:', data);
        const validClients = data.filter(client => {
          const isValid = client.lat && client.lang && 
            !isNaN(parseFloat(client.lat)) && 
            !isNaN(parseFloat(client.lang));
          if (!isValid) {
            console.warn('Invalid client coordinates:', client);
          }
          return isValid;
        });
        console.log('Valid clients:', validClients);
        setClients(validClients);
      } catch (err) {
        console.error("Error fetching clients:", err);
        setError(prev => prev || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);
  useEffect(() => {
    if (selectedClient) {
      setActiveMarkers(prev => [...prev, selectedClient.id]);
      setTimeout(() => {
        setActiveMarkers(prev => prev.filter(id => id !== selectedClient.id));
      }, 2000);
    }
  }, [selectedClient]);
  const RegionLegend = () => {
    return (
      <div className="region-legend">
        <h4>Region Colors</h4>
        {Object.entries(REGION_COLORS).filter(([key]) => key !== 'default').map(([region, color]) => (
          <div key={region} className="legend-item">
            <span className="color-box" style={{backgroundColor: color}}></span>
            <span>{region}</span>
          </div>
        ))}
      </div>
    );
  };
  const handleServiceClick = useCallback((serviceId) => {
    if (selectedService === serviceId) {
      setSelectedService(null);
      setActiveMarkers([]);
      return;
    }
    setSelectedService(serviceId);
    const clientsWithService = [];
    Object.entries(clientServices).forEach(([clientId, serviceIds]) => {
      if (serviceId === 'all' || serviceIds.includes(serviceId)) {
        clientsWithService.push(clientId);
      }
    });
    setActiveMarkers(clientsWithService);
  }, [selectedService, clientServices]);
  const shouldAnimateMarker = (clientId) => {
    return activeMarkers.includes(clientId);
  };
  const handleClientSelect = (client) => {
    setSelectedClient(client);
  };
  const getClientServiceColors = useCallback((clientId) => {
    if (!clientServices[clientId] || !services) return ['#114859']; 
    const serviceIds = clientServices[clientId];
    const colors = serviceIds
      .map(id => services[id]?.color || '#114859')
      .filter(color => color); 
    return colors.length > 0 ? colors : ['#114859'];
  }, [clientServices, services]);
  const getClientServiceNames = useCallback((clientId) => {
    if (!clientServices[clientId] || !services) return []; 
    return clientServices[clientId]
      .map(id => services[id]?.name)
      .filter(name => name); 
  }, [clientServices, services]);
  const ServiceButtons = useCallback(() => {
    return (
      <div className="service-buttons">
        <button 
          onClick={() => handleServiceClick('all')}
          className={`service-button ${selectedService === 'all' ? 'active' : ''}`}
          style={{ 
            color: '#114859',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ALL
        </button>
        {Object.values(services).map(service => (
          <button 
            key={service.id}
            onClick={() => handleServiceClick(service.id)}
            className={`service-button ${selectedService === service.id ? 'active' : ''}`}
            style={{ 
              color: service.color,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <LiaMapMarkerSolid 
              color={service.color} 
              size={16} 
              style={{ marginRight: '4px' }} 
            />
            {service.name}
          </button>
        ))}
      </div>
    );
  }, [services, selectedService, handleServiceClick]);
  return (
    <div>
      <div className="header">
        <div className="header-top">
          <div className="header-left">
            <button 
              className="sidebar-toggle"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              ☰
            </button>
            <img className="logo" src={Logo} alt="Logo" /> 
          </div>
        <div className="header-center">
          <ClientSearch 
            clients={clients} 
            onSelectClient={handleClientSelect}
            mapRef={mapRef} 
          />
        </div>
        </div>
        <div className="header-right">
          <ServiceButtons />
        </div>
      </div>
      {error && <div className="error-message">Error loading data: {error}</div>}
      {(loading || isLoadingGeoJSON) && (
        <div className="loading-message">
          Loading map data...
        </div>
      )}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "88vh", width: "100%" }}
        maxBounds={mapBounds}
        maxBoundsViscosity={0}
        ref={mapRef}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
        onZoomEnd={handleZoomEnd}
        attributionControl={false}
        zoomAnimation={true}
        markerZoomAnimation={true}
        fadeAnimation={true}
        zoomAnimationDuration={0.3}
        wheelDebounceTime={20}
        minZoom={4}
        maxZoom={18}
        zoomSnap={0.5}
      >
        {processedGeoData && renderGeoJSONLayers()}
        {filteredClients.map((client) => {
          console.log('Processing client for marker:', {
            id: client.id,
            name: client.business_name,
            lat: client.lat,
            lang: client.lang,
            services: clientServices[client.id],
            currentZoom: currentZoom
          });
          
          const serviceColors = getClientServiceColors(client.id);
          console.log('Service colors for client:', {
            clientId: client.id,
            colors: serviceColors
          });
          
          const serviceNames = getClientServiceNames(client.id);
          const isActive = shouldAnimateMarker(client.id);
          const clientServiceIds = clientServices[client.id] || [];
          const primaryServiceId = clientServiceIds[0] || null;
          
          if (!client.lat || !client.lang || isNaN(parseFloat(client.lat)) || isNaN(parseFloat(client.lang))) {
            console.warn('Invalid coordinates for client:', client.id);
            return null;
          }

          const position = [parseFloat(client.lat), parseFloat(client.lang)];
          console.log('Creating marker at position:', position);
          
          return (
            <MarkerRef 
              key={client.id} 
              position={position}
              icon={createMarkerIcon(serviceColors)}
              isActive={isActive}
              serviceId={primaryServiceId}
            >
              <Popup>
                <div className="client-popup">
                  <h3>{client.business_name}</h3>
                  {/* <p><strong>Country:</strong> {client.country}</p> */}
                  <p><strong>Address:</strong> {client.address}</p>
                  {serviceNames.length > 0 && (
                    <div className="client-services">
                      <p><strong>Services:</strong></p>
                      <ul>
                        {serviceNames.map((name, index) => (
                          <li key={index}>
                            <span className="service-color-dot" style={{backgroundColor: serviceColors[index]}}></span>
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Popup>
              <Tooltip>
                {client.business_name}
              </Tooltip>
            </MarkerRef>
          );
        })}
      </MapContainer>
      <div className="map-login-button">
        <Link
         to="/login" className="login-link">
          Admin Login
        </Link>
      </div>
      <RegionSidebar 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        regions={Object.keys(REGION_COLORS).filter(r => r !== 'default')}
        postcodeMap={postcodeMap}
        onRegionSelect={handleRegionSelect}
      />
      <style>{`
        .service-status {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 5px;
        }
        .service-status.available {
          opacity: 1;
        }
        .service-status.full {
          opacity: 0.5;
        }
        .location-popup {
          min-width: 220px;
        }
        .service-availability ul {
          list-style: none;
          padding-left: 10px;
        }
        .service-availability li {
          margin-bottom: 5px;
        }
        
        /* Search bar styling */
        .client-search-container {
          position: relative;
          width: 300px;
          margin-left: 20px; 
        }
        
        .search-input-wrapper {
          position: relative;
        }
        
        .client-search-input {
          width: 100%;
          padding: 10px 15px;
          border: 2px solid var(--border-color);
          border-radius: 8px;
          font-size: 16px;
          background-color: white;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          position: static; 
          right: auto; 
          width: 100%; 
        }
        
        .client-search-input:focus {
          outline: none;
          border-color: var(--secondary-color);
          box-shadow: 0 2px 8px rgba(44, 125, 160, 0.2);
        }

        .clear-search-button {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: #888;
        }
        
        .search-results {
          position: absolute;
          top: 100%;
          left: 0;
          width: 100%;
          max-height: 200px;
          overflow-y: auto;
          background-color: white;
          border: 1px solid #ccc;
          border-top: none;
          border-radius: 0 0 4px 4px;
          z-index: 1000;
          padding: 0;
          margin: 0;
          list-style: none;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .search-result-item {
          padding: 8px 12px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
        }
        
        .search-result-item:last-child {
          border-bottom: none;
        }
        
        .search-result-item:hover {
          background-color: #f5f5f5;
        }
        
        .postcode-label {
          background: none;
          border: none;
          box-shadow: none;
        }
        
        .postcode-label div {
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          font-size: 12px;
          color: #333;
          text-align: center;
          white-space: nowrap;
          transform-origin: center;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};
export default Map;