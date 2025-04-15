import { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap as ReactGoogleMap, MarkerF, InfoWindow } from '@react-google-maps/api';
import { supabase } from '../../utils/supabaseClient';
import LocationSidebar from './LocationSidebar';
import './GoogleMap.css';
import logo from '../../assets/logo.png';
import { Link } from 'react-router-dom';
import { GoPin } from "react-icons/go";
import { BsFillSignpostFill } from "react-icons/bs";
import PercentageLoader from './Spinner/PercentageLoader';
const DEFAULT_CENTER = { lat: 54.5, lng: -2.5 };
const DEFAULT_ZOOM = 6;
const MARKER_ZOOM = 9;
const ANIMATION_OPTIONS = {
  duration: 800,  
  easing: 'easeInOutCubic'  
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
const GoogleMapComponent = () => {
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState({});
  const [clientServices, setClientServices] = useState({});
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [postcodeMap, setPostcodeMap] = useState({});
  const [locationSlots, setLocationSlots] = useState({});
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [hoveredPosition, setHoveredPosition] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mapRef = useRef(null);
  const dataLayerRef = useRef(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(true); 
  const [scriptLoaded, setScriptLoaded] = useState(false); 
  const [mapInstanceReady, setMapInstanceReady] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true);
      setError(null);
      try {
        // Load critical data first
        const [clientsResponse, servicesResponse] = await Promise.all([
          supabase.from('clients').select('*'),
          supabase.from('services').select('*')
        ]);

        if (clientsResponse.error) throw clientsResponse.error;
        if (servicesResponse.error) throw servicesResponse.error;

        setClients(clientsResponse.data);
        const servicesMap = servicesResponse.data.reduce((acc, service) => {
          acc[service.id] = service;
          return acc;
        }, {});
        setServices(servicesMap);

        // Set initial app ready state to show basic UI
        setIsAppReady(true);

        // Load remaining data in parallel
        const [
          clientServicesResponse,
          locationsResponse,
          slotsResponse,
          geoJsonResponse
        ] = await Promise.all([
          supabase.from('client_services').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('location_slot').select(`
            id,
            location_id,
            service_id,
            client_id,
            slot_number,
            status,
            clients!inner(business_name)
          `),
          fetch('./combined.geojson')
        ]);

        if (clientServicesResponse.error) throw clientServicesResponse.error;
        if (locationsResponse.error) throw locationsResponse.error;
        if (slotsResponse.error) throw slotsResponse.error;
        if (!geoJsonResponse.ok) throw new Error('Failed to load GeoJSON data');

        // Process remaining data
        const clientServicesMap = clientServicesResponse.data.reduce((acc, cs) => {
          if (!acc[cs.client_id]) acc[cs.client_id] = [];
          acc[cs.client_id].push(cs.service_id);
          return acc;
        }, {});
        setClientServices(clientServicesMap);

        const postcodeMapping = locationsResponse.data.reduce((acc, location) => {
          acc[location.postcode_initials] = {
            region: location.region,
            id: location.id,
            city_name: location.city_name
          };
          return acc;
        }, {});
        setPostcodeMap(postcodeMapping);

        const slotsMapping = slotsResponse.data.reduce((acc, slot) => {
          if (!acc[slot.location_id]) {
            acc[slot.location_id] = {};
          }
          if (!acc[slot.location_id][slot.service_id]) {
            acc[slot.location_id][slot.service_id] = {
              totalSlots: 2,
              usedSlots: 0,
              businesses: []
            };
          }
          if (slot.client_id) {
            acc[slot.location_id][slot.service_id].usedSlots += 1;
            acc[slot.location_id][slot.service_id].businesses.push({
              name: slot.clients?.business_name || 'Unknown Business'
            });
          }
          return acc;
        }, {});
        setLocationSlots(slotsMapping);

        const geoJson = await geoJsonResponse.json();
        const processedGeoJson = {
          ...geoJson,
          features: geoJson.features.map(feature => {
            const postcodeInitials = feature.properties.postcodeInitials;
            const locationData = postcodeMapping[postcodeInitials];
            return {
              ...feature,
              properties: {
                ...feature.properties,
                region: locationData?.region || 'default',
                color: REGION_COLORS[locationData?.region] || REGION_COLORS.default,
                locationId: locationData?.id
              }
            };
          })
        };
        setGeoJsonData(processedGeoJson);

      } catch (error) {
        setError(error.message || 'An unknown error occurred during data loading.');
      } finally {
        setDataLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!dataLoading && !error && scriptLoaded && mapInstanceReady && geoJsonData) {
      setIsAppReady(true);
    } else {
      setIsAppReady(false); 
    }
  }, [dataLoading, error, scriptLoaded, mapInstanceReady, geoJsonData]);

  useEffect(() => {
    let intervalId = null;
    if (!isAppReady) {
      setLoadingPercentage(0);
      intervalId = setInterval(() => {
        setLoadingPercentage(prevPercentage => {
          const nextPercentage = prevPercentage + 1; 
          if (nextPercentage >= 100) {
            clearInterval(intervalId); 
            return 100;
          }
          return nextPercentage;
        });
      }, 80); 
    } else {
      setLoadingPercentage(100);
      if (intervalId) {
        clearInterval(intervalId);
      }
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAppReady]);

  useEffect(() => {
    if (!selectedService) {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client => {
        const clientServiceIds = clientServices[client.id] || [];
        return clientServiceIds.includes(selectedService);
      });
      setFilteredClients(filtered);
    }
  }, [selectedService, clients, clientServices]);

  const zoomToFeature = useCallback((feature) => {
    if (!mapRef.current || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    if (feature instanceof window.google.maps.Data.Feature) {
      feature.getGeometry().forEachLatLng((latLng) => {
        bounds.extend(latLng);
      });
    } else {
      const geometry = feature.geometry;
      if (geometry.type === 'Polygon') {
        geometry.coordinates[0].forEach(([lng, lat]) => {
          bounds.extend(new window.google.maps.LatLng(lat, lng));
        });
      } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach(polygon => {
          polygon[0].forEach(([lng, lat]) => {
            bounds.extend(new window.google.maps.LatLng(lat, lng));
          });
        });
      }
    }
    mapRef.current.setZoom(8);
    setTimeout(() => {
      mapRef.current.fitBounds(bounds, {
        padding: {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50
        }
      });
    }, 100);
  }, []);

  const zoomToMarker = useCallback((lat, lng) => {
    if (!mapRef.current || !window.google?.maps) return;
    const position = new window.google.maps.LatLng(lat, lng);
    if (selectedClient && 
        selectedClient.lat === lat.toString() && 
        selectedClient.lang === lng.toString() &&
        mapRef.current.getZoom() === MARKER_ZOOM) {
      mapRef.current.setZoom(DEFAULT_ZOOM);
      mapRef.current.setCenter(DEFAULT_CENTER);
      return;
    }
    mapRef.current.setCenter(position);
    setTimeout(() => {
      mapRef.current.setZoom(MARKER_ZOOM);
    }, 100);
  }, [selectedClient]);

  const handleRegionClick = useCallback((event) => {
    const feature = event.feature;
    const region = feature.getProperty('region');
    setSelectedClient(null);
    if (selectedRegion === region) {
      setSelectedRegion(null);
      if (mapRef.current) {
        mapRef.current.setZoom(DEFAULT_ZOOM);
        mapRef.current.setCenter(DEFAULT_CENTER);
      }
      if (dataLayerRef.current) {
        dataLayerRef.current.revertStyle();
      }
      return;
    }
    setSelectedRegion(region);
    if (dataLayerRef.current) {
      dataLayerRef.current.revertStyle();
      dataLayerRef.current.overrideStyle(feature, {
          fillOpacity: 0.8,
          strokeWeight: 2
      });
    }
    zoomToFeature(feature);
  }, [selectedRegion, zoomToFeature]);

  const handleMarkerClick = useCallback((client) => {
    setSelectedRegion(null);
    if (dataLayerRef.current) {
      dataLayerRef.current.revertStyle();
    }
    setSelectedClient(client);
    zoomToMarker(parseFloat(client.lat), parseFloat(client.lang));
  }, [zoomToMarker]);

  const getServiceAvailability = useCallback((locationId) => {
    if (!locationId || !locationSlots[locationId] || Object.keys(services).length === 0) {
      return [];
    }
    if (!locationId || !locationSlots[locationId]) {
      return Object.values(services).map(service => ({
        ...service,
        slots: 0,
        available: true,
        businesses: []
      }));
    }
    return Object.values(services).map(service => {
      const slotData = locationSlots[locationId]?.[service.id] || {
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

  const onLoad = useCallback((map) => {
    mapRef.current = map;
    setMapInstanceReady(true);
    if (geoJsonData && window.google?.maps) {
      if (dataLayerRef.current) {
        dataLayerRef.current.setMap(null);
      }
      const dataLayer = new window.google.maps.Data();
      dataLayer.addGeoJson(geoJsonData);
      dataLayer.setStyle(feature => ({
        fillColor: feature.getProperty('color'),
        fillOpacity: selectedRegion === feature.getProperty('region') ? 0.8 : 0.6,
        strokeColor: '#ffffff',
        strokeWeight: selectedRegion === feature.getProperty('region') ? 2 : 1
      }));

      function polylabel(polygon) {
        const minX = polygon.reduce((min, p) => Math.min(min, p[0]), Infinity);
        const minY = polygon.reduce((min, p) => Math.min(min, p[1]), Infinity);
        const maxX = polygon.reduce((max, p) => Math.max(max, p[0]), -Infinity);
        const maxY = polygon.reduce((max, p) => Math.max(max, p[1]), -Infinity);
        const width = maxX - minX;
        const height = maxY - minY;
        const cellSize = Math.min(width, height) / 4;
        let cells = [];
        for (let x = minX; x < maxX; x += cellSize) {
          for (let y = minY; y < maxY; y += cellSize) {
            const cell = [x + cellSize / 2, y + cellSize / 2];
            if (pointInPolygon(cell, polygon)) {
              const dist = distanceToPolygon(cell, polygon);
              cells.push({ point: cell, distance: dist });
            }
          }
        }
        cells.sort((a, b) => b.distance - a.distance);
        if (cells.length === 0) {
          const centroid = findCentroid(polygon);
          return centroid;
        }
        return cells[0].point;
      }
      function pointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const xi = polygon[i][0], yi = polygon[i][1];
          const xj = polygon[j][0], yj = polygon[j][1];
          
          const intersect = ((yi > point[1]) !== (yj > point[1])) &&
            (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }
      function distanceToPolygon(point, polygon) {
        let minDist = Infinity;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const xi = polygon[i][0], yi = polygon[i][1];
          const xj = polygon[j][0], yj = polygon[j][1];
          const dist = distanceToLineSegment(point, [xi, yi], [xj, yj]);
          minDist = Math.min(minDist, dist);
        }
        return minDist;
      }
      function distanceToLineSegment(point, start, end) {
        const x = point[0], y = point[1];
        const x1 = start[0], y1 = start[1];
        const x2 = end[0], y2 = end[1];
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) {
          xx = x1;
          yy = y1;
        } else if (param > 1) {
          xx = x2;
          yy = y2;
        } else {
          xx = x1 + param * C;
          yy = y1 + param * D;
        }
        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
      }
      function findCentroid(polygon) {
        let x = 0, y = 0;
        for (const point of polygon) {
          x += point[0];
          y += point[1];
        }
        return [x / polygon.length, y / polygon.length];
      }
      function calculatePolygonArea(coords) {
        let area = 0;
        const n = coords.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const xi = coords[i][0];
          const yi = coords[i][1];
          const xj = coords[j][0];
          const yj = coords[j][1];
          area += xi * yj - xj * yi;
        }
        return Math.abs(area) / 2;
      }
      dataLayer.forEach(feature => {
        const postcodeInitials = feature.getProperty('postcodeInitials');
        if (postcodeInitials && window.google?.maps) {
          const geometry = feature.getGeometry();
          let polygons = [];
          if (geometry.getType() === 'Polygon') {
            geometry.getArray().forEach(path => {
              const coords = [];
              path.getArray().forEach(latLng => {
                coords.push([latLng.lng(), latLng.lat()]);
              });
              polygons.push(coords);
            });
          } else if (geometry.getType() === 'MultiPolygon') {
            geometry.getArray().forEach(polygon => {
              polygon.getArray().forEach(path => {
                const coords = [];
                path.getArray().forEach(latLng => {
                  coords.push([latLng.lng(), latLng.lat()]);
                });
                polygons.push(coords);
              });
            });
          }
          let largestArea = -Infinity;
          let largestPolygon = null;
          polygons.forEach(coords => {
            const area = calculatePolygonArea(coords);
            if (area > largestArea) {
              largestArea = area;
              largestPolygon = coords;
            }
          });
          if (largestPolygon) {
            const visualCenter = polylabel(largestPolygon);
            if (visualCenter && typeof visualCenter[0] === 'number' && typeof visualCenter[1] === 'number') {
              new window.google.maps.Marker({
                  position: { lat: visualCenter[1], lng: visualCenter[0] },
                  map: map,
                  label: {
                  text: postcodeInitials,
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: '500',
                  className: 'postcode-label'
                  },
                  icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 0,
                  labelOrigin: new window.google.maps.Point(0, -6)
                  },
                  clickable: false,
                  zIndex: 1000
              });
          } else {
            console.warn(`Could not calculate visual center for postcode: ${postcodeInitials}`);
          }
          }
        }
      });
      dataLayer.addListener('mouseover', (event) => {
        const feature = event.feature;
        const locationId = feature.getProperty('locationId');
        const region = feature.getProperty('region');
        const postcodeInitials = feature.getProperty('postcodeInitials');
        const cityName = postcodeMap[postcodeInitials]?.city_name || region;
        dataLayer.overrideStyle(feature, {
          fillOpacity: 0.8,
          strokeWeight: 2
        });
        const bounds = new window.google.maps.LatLngBounds();
        feature.getGeometry().forEachLatLng(latLng => bounds.extend(latLng));
        const center = bounds.getCenter();
        setHoveredPosition(center);
        setHoveredRegion({
          region,
          cityName,
          locationId,
          services: getServiceAvailability(locationId)
        });
      });
      dataLayer.addListener('mouseout', (event) => {
        if (selectedRegion !== event.feature.getProperty('region')) {
          dataLayer.revertStyle(event.feature);
        }
        setHoveredRegion(null);
        setHoveredPosition(null);
      });
      dataLayer.addListener('click', handleRegionClick);
      dataLayer.setMap(map);
      dataLayerRef.current = dataLayer;
    } else {
      console.warn("GeoJSON data or Google Maps API not ready when onLoad triggered.");
   }
  }, [geoJsonData, selectedRegion, handleRegionClick, getServiceAvailability, postcodeMap]);

  useEffect(() => {
    if (dataLayerRef.current && window.google?.maps) {
       dataLayerRef.current.setStyle(feature => ({
          fillColor: feature.getProperty('color'),
          fillOpacity: selectedRegion === feature.getProperty('region') ? 0.8 : 0.6,
          strokeColor: '#ffffff',
          strokeWeight: selectedRegion === feature.getProperty('region') ? 2 : 1
       }));
    }
 }, [selectedRegion]);
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      if (window.google) {
        setScriptLoaded(true);
        setGoogleMapsLoaded(true);
        return;
      }
      window.initMap = () => {
        setScriptLoaded(true);
        setGoogleMapsLoaded(true);
      };
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places,drawing,geometry&callback=initMap`;
      script.async = true;
      script.defer = true;
      script.onerror = (e) => {
        console.error('Google Maps script failed to load', e);
        setError("Failed to load Google Maps script. Please check your API key and network connection.");
      };
      document.head.appendChild(script);
    };
    loadGoogleMapsScript();
    return () => {
      window.initMap = undefined;
    };
  }, []);

  const handleInfoWindowClose = () => {
    setSelectedClient(null);
  };
  const handleLocationSelect = useCallback((location) => {
    if (!mapRef.current || !dataLayerRef.current || !window.google?.maps) return;
    let selectedFeature = null;
    dataLayerRef.current.forEach(feature => {
      if (feature.getProperty('locationId') === location.id) {
        selectedFeature = feature;
      }
    });
    if (selectedFeature) {
      setSelectedClient(null);
      setSelectedRegion(location.region);
      dataLayerRef.current.revertStyle();
      dataLayerRef.current.overrideStyle(selectedFeature, {
        fillOpacity: 0.8,
        strokeWeight: 2
      });
      zoomToFeature(selectedFeature);
    }
  }, [zoomToFeature]);
  const getMarkerIcon = useCallback((client) => {
    if (!client || !clientServices[client.id] || !window.google?.maps || Object.keys(services).length === 0) return null;
    const serviceId = clientServices[client.id][0];
    const service = services[serviceId];
    if (!service) return null;
    const markerSvg = `
      <svg width="40" height="56" viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 0C8.954 0 0 8.954 0 20c0 11.046 20 36 20 36s20-24.954 20-36C40 8.954 31.046 0 20 0z" fill="${service.color}"/>
        <circle cx="20" cy="20" r="8" fill="white"/>
      </svg>
    `;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(markerSvg),
      scaledSize: new window.google.maps.Size(40, 56),
      anchor: new window.google.maps.Point(20, 56), 
      labelOrigin: new window.google.maps.Point(20, 20)
    };
  }, [services, clientServices]);
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    
    if (value.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const filtered = clients.filter(client => {
      const businessName = client.business_name?.toLowerCase() || '';
      const postcode = client.postcode?.toLowerCase() || '';
      const searchTerm = value.toLowerCase();
      
      return businessName.includes(searchTerm) || postcode.includes(searchTerm);
    });

    setSearchResults(filtered);
    setShowSearchResults(true);
  };
  const handleSearchResultClick = (result) => {
    setSearchInput(result.business_name);
    setShowSearchResults(false);
    const clientToSelect = clients.find(c => c.id === result.id);
    if (clientToSelect) {
      handleMarkerClick(clientToSelect);
    } else {
       console.warn("Selected search result client not found in main clients list:", result.id);
    }
  };
 useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.search-container')) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  if (error) {
    console.error("🚨 Rendering Error Message:", error);
    return (
        <div style={{ padding: '20px', color: 'red', border: '1px solid red', margin: '20px', backgroundColor: '#ffeeee' }}>
            <h2>Map Loading Error</h2>
            <p>There was a problem loading the map components:</p>
            <p><strong>{error}</strong></p>
            <p>Please try refreshing the page. If the problem persists, check the browser console for more details or contact support.</p>
        </div>
    );
  }

  if (!isAppReady) {
    return <PercentageLoader percentage={loadingPercentage} />;
  }

  return (
    <>
      <header className="map-header">
        <div className="header-top">
          <img src={logo} alt="Logo" className="logo" />
          <div className="search-container">
            <div className="search-input-wrapper">
              <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Search by business name or postcode..."
                value={searchInput}
                onChange={handleSearch}
              />
            </div>
            {showSearchResults && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="search-result-item"
                    onClick={() => handleSearchResultClick(result)}
                  >
                    <div className="business-info">
                      <div className="business-details">
                        <span className="business-name">{result.business_name}</span>
                        <div className="business-meta">
                          {result.postcode && (
                            <span className="postcode">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 13C13.6569 13 15 11.6569 15 10C15 8.34315 13.6569 7 12 7C10.3431 7 9 8.34315 9 10C9 11.6569 10.3431 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M12 22C14 18 20 15.4183 20 10C20 5.58172 16.4183 2 12 2C7.58172 2 4 5.58172 4 10C4 15.4183 10 18 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              {result.postcode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="services">
                      {(clientServices[result.id] || []).map(serviceId => {
                        const service = services[serviceId];
                        if (!service) return null;
                        return (
                          <span
                            key={serviceId}
                            className="service-tag"
                            style={{ backgroundColor: service.color }}
                          >
                            {service.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="header-bottom">
          <div className="service-filters">
            <button
              className={`service-filter ${!selectedService ? 'active' : ''}`}
              onClick={() => setSelectedService(null)}
              style={{ color: '#666' }}
            >
              All Services
            </button>
            {Object.values(services).map(service => (
              <button
                key={service.id}
                className={`service-filter ${selectedService === service.id ? 'active' : ''}`}
                onClick={() => setSelectedService(service.id)}
                style={{ color: service.color }}
              >
                {service.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="map-content">
        <LocationSidebar 
          onLocationSelect={handleLocationSelect} 
          className={`location-sidebar ${isSidebarOpen ? 'active' : ''}`}
        >
          <Link to="/login" className="login-button">Login</Link>
        </LocationSidebar>
        
        <button 
          className={`hamburger-menu ${isSidebarOpen ? 'active' : ''}`} 
          onClick={toggleSidebar}
        >
          <span></span>
        </button>

        {googleMapsLoaded && (
          <ReactGoogleMap
            mapContainerClassName="google-map-container"
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            onLoad={onLoad}
            options={{
              styles: [
                {
                  featureType: "all",
                  elementType: "labels",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "administrative",
                  elementType: "geometry.stroke",
                  stylers: [{ color: "#1a3847" }, { weight: 0.5 }]
                },
                {
                  featureType: "landscape",
                  elementType: "geometry",
                  stylers: [{ color: "#08304b" }]
                },
                {
                  featureType: "poi",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "road",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "transit",
                  stylers: [{ visibility: "off" }]
                },
                {
                  featureType: "water",
                  elementType: "geometry",
                  stylers: [{ color: "#021019" }]
                }
              ],
              gestureHandling: 'cooperative',
              minZoom: 5,
              maxZoom: 18,
              zoomControl: true,
              scrollwheel: true,
              disableDoubleClickZoom: false,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              zoomControlOptions: {
                position: window.google?.maps?.ControlPosition?.RIGHT_CENTER
              }
            }}
            onTilesLoaded={() => {
           }}
          >
            {window.google?.maps && (
              <>
                {filteredClients.map((client) => {
                  if (!client.lat || !client.lang) return null;
                  const isSelected = selectedClient?.id === client.id;
                  const markerIcon = getMarkerIcon(client);
                  if (!markerIcon) return null;
                  return (
                    <MarkerF
                      key={client.id}
                      position={{ 
                        lat: parseFloat(client.lat), 
                        lng: parseFloat(client.lang) 
                      }}
                      onClick={() => handleMarkerClick(client)}
                      icon={markerIcon}
                      animation={isSelected ? window.google.maps.Animation.BOUNCE : null}
                    />
                  );
                })}
                {selectedClient && window.google?.maps &&  (
                  <InfoWindow
                    position={{ 
                      lat: parseFloat(selectedClient.lat), 
                      lng: parseFloat(selectedClient.lang) 
                    }}
                    onCloseClick={handleInfoWindowClose}
                    options={{
                      pixelOffset: new window.google.maps.Size(0, -30)
                    }}
                  >
                    <div className="info-window">
                      <div className="info-window-header">
                        <h3 className='info-window-title'>{selectedClient.business_name}</h3>
                        <button 
                          className="info-window-close-btn" 
                          onClick={handleInfoWindowClose}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="info-window-content">
                        <div className="info-window-address">
                          <div className="info-window-address-container">
                            <span><GoPin style={{fontWeight: '900', color: '#000', fontSize: '15px'}} /></span>
                            <span>{selectedClient.address}</span>
                          </div>
                          <div className="info-window-postcode">
                            <span><BsFillSignpostFill style={{fontWeight: '900', color: '#000', fontSize: '15px'}} /></span>
                            <span>{selectedClient.postcode}</span>
                          </div>
                          
                        </div>
                        <div className="info-window-services">
                          {(clientServices[selectedClient.id] || []).map(serviceId => {
                            const service = services[serviceId];
                            if (!service) return null;
                            return (
                              <span
                                key={serviceId}
                                className="service-tag"
                                style={{ backgroundColor: service.color }}
                              >
                                {service.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </InfoWindow>
                )}

                {hoveredRegion && hoveredPosition &&  window.google?.maps && (
                  <InfoWindow
                    position={hoveredPosition}
                    options={{
                      pixelOffset: new window.google.maps.Size(0, -10),
                      disableAutoPan: true
                    }}
                  >
                    <div className="region-info-window">
                    <div className="region-info-header">
                      <h3>{hoveredRegion.cityName}</h3>
                      <button 
                        className="info-window-close-btn" 
                        onClick={() => setHoveredRegion(null)}
                      >
                        ✕
                      </button>
                      </div>
                      <div className="services-availability">
                        {Array.isArray(hoveredRegion.services) && hoveredRegion.services
                          .filter(service => service.businesses.length > 0)
                          .map(service => (
                            <div key={service.id} className="service-item">
                              <div className="service-header">
                                <span 
                                  className="service-name"
                                  style={{ color: service.color }}
                                >
                                  {service.name}
                                </span>
                                <span className="slot-count">
                                {service.slots}/2 slots
                                </span>
                              </div>
                              {service.businesses.map((business, idx) => (
                                <div key={idx} className="business-service">
                                  <span className="business-name">{business.name}</span>
                                  <span className="slot-status">Booked</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        {!hoveredRegion.services.some(service => service.businesses.length > 0) && (
                          <div className="no-services">
                            No services allocated
                          </div>
                        )}
                         {!Array.isArray(hoveredRegion.services) && (
                           <div className="no-services">Loading services...</div> 
                        )}
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </>
            )}
          </ReactGoogleMap>
        )}
      </div>
    </>
  );
};
export default GoogleMapComponent; 