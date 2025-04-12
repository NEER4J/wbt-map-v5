import { useEffect, useState, useRef, useCallback } from 'react';
import { LoadScript, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { supabase } from '../../utils/supabaseClient';
import LocationSidebar from './LocationSidebar';
import './GoogleMap.css';
import logo from '../../assets/logo.png';

const DEFAULT_CENTER = { lat: 54.5, lng: -2.5 };
const DEFAULT_ZOOM = 6;
const MARKER_ZOOM = 13;

// Add animation configuration
const ANIMATION_OPTIONS = {
  duration: 800,  // Animation duration in milliseconds
  easing: 'easeInOutCubic'  // Smooth easing function
};

const libraries = ['places', 'drawing'];

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [postcodeMap, setPostcodeMap] = useState({});
  const [locationSlots, setLocationSlots] = useState({});
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [hoveredPosition, setHoveredPosition] = useState(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [filteredClients, setFilteredClients] = useState([]);
  const mapRef = useRef(null);
  const dataLayerRef = useRef(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch clients
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('*');
        
        if (clientsError) throw clientsError;
        setClients(clientsData);

        // Fetch services
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*');
        
        if (servicesError) throw servicesError;
        const servicesMap = servicesData.reduce((acc, service) => {
          acc[service.id] = service;
          return acc;
        }, {});
        setServices(servicesMap);

        // Fetch client services
        const { data: clientServicesData, error: clientServicesError } = await supabase
          .from('client_services')
          .select('*');
        
        if (clientServicesError) throw clientServicesError;
        const clientServicesMap = clientServicesData.reduce((acc, cs) => {
          if (!acc[cs.client_id]) acc[cs.client_id] = [];
          acc[cs.client_id].push(cs.service_id);
          return acc;
        }, {});
        setClientServices(clientServicesMap);

        // Fetch locations for postcode mapping
        const { data: locationsData, error: locationsError } = await supabase
          .from('locations')
          .select('*');

        if (locationsError) throw locationsError;
        const postcodeMapping = locationsData.reduce((acc, location) => {
          acc[location.postcode_initials] = {
            region: location.region,
            id: location.id,
            city_name: location.city_name
          };
          return acc;
        }, {});
        setPostcodeMap(postcodeMapping);

        // Fetch location slots
        const { data: slotsData, error: slotsError } = await supabase
          .from('location_slot')
          .select(`
            id,
            location_id,
            service_id,
            client_id,
            slot_number,
            status,
            clients!inner(business_name)
          `);

        if (slotsError) throw slotsError;
        const slotsMapping = slotsData.reduce((acc, slot) => {
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

        // Load GeoJSON data
        const response = await fetch('./combined.geojson');
        if (!response.ok) {
          throw new Error('Failed to load GeoJSON data');
        }
        const geoJson = await response.json();
        
        // Process GeoJSON with region colors
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
        console.error('Error loading data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Add useEffect for filtering clients based on selected service
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
    
    // Handle both GeoJSON feature and Google Maps Data.Feature
    if (feature instanceof window.google.maps.Data.Feature) {
      feature.getGeometry().forEachLatLng((latLng) => {
        bounds.extend(latLng);
      });
    } else {
      // Handle raw GeoJSON feature
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

    // First zoom out slightly to give context
    mapRef.current.setZoom(8);
    
    // Then fit bounds with animation
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

    // If we're clicking the same marker that's already selected, reset the view
    if (selectedClient && 
        selectedClient.lat === lat.toString() && 
        selectedClient.lang === lng.toString() &&
        mapRef.current.getZoom() === MARKER_ZOOM) {
      
      mapRef.current.setZoom(DEFAULT_ZOOM);
      mapRef.current.setCenter(DEFAULT_CENTER);
      return;
    }

    // First set center
    mapRef.current.setCenter(position);
    
    // Then zoom in with animation
    setTimeout(() => {
      mapRef.current.setZoom(MARKER_ZOOM);
    }, 100);
  }, [selectedClient]);

  const handleRegionClick = useCallback((event) => {
    const feature = event.feature;
    const region = feature.getProperty('region');
    
    // Clear selected client when selecting a region
    setSelectedClient(null);
    
    // If clicking the same region, reset view
    if (selectedRegion === region) {
      setSelectedRegion(null);
      if (mapRef.current) {
        mapRef.current.setZoom(DEFAULT_ZOOM);
        mapRef.current.setCenter(DEFAULT_CENTER);
      }
      return;
    }

    setSelectedRegion(region);
    zoomToFeature(feature);
  }, [selectedRegion, zoomToFeature]);

  const handleMarkerClick = useCallback((client) => {
    // Clear selected region when clicking a marker
    setSelectedRegion(null);
    
    // Reset any region styling
    if (dataLayerRef.current) {
      dataLayerRef.current.revertStyle();
    }

    setSelectedClient(client);
    zoomToMarker(parseFloat(client.lat), parseFloat(client.lang));
  }, [zoomToMarker]);

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

  const onLoad = useCallback((map) => {
    mapRef.current = map;
    setMapLoaded(true);

    if (geoJsonData) {
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

      dataLayer.addListener('mouseover', (event) => {
        const feature = event.feature;
        const locationId = feature.getProperty('locationId');
        const region = feature.getProperty('region');
        
        dataLayer.overrideStyle(feature, {
          fillOpacity: 0.8,
          strokeWeight: 2
        });

        // Get the mouse position for the hover info
        const bounds = new window.google.maps.LatLngBounds();
        feature.getGeometry().forEachLatLng(latLng => bounds.extend(latLng));
        const center = bounds.getCenter();

        setHoveredPosition(center);
        setHoveredRegion({
          region,
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
    }
  }, [geoJsonData, selectedRegion, handleRegionClick, getServiceAvailability]);

  const onScriptLoad = useCallback(() => {
    setIsScriptLoaded(true);
  }, []);

  const handleInfoWindowClose = () => {
    setSelectedClient(null);
  };

  const handleLocationSelect = useCallback((location) => {
    if (!mapRef.current || !dataLayerRef.current) return;

    // Find the corresponding feature for the location
    let selectedFeature = null;
    dataLayerRef.current.forEach(feature => {
      if (feature.getProperty('locationId') === location.id) {
        selectedFeature = feature;
      }
    });

    if (selectedFeature) {
      // Reset previous selection
      setSelectedClient(null);
      setSelectedRegion(location.region);
      
      // Update styling
      dataLayerRef.current.revertStyle();
      dataLayerRef.current.overrideStyle(selectedFeature, {
        fillOpacity: 0.8,
        strokeWeight: 2
      });

      // Zoom to the selected feature
      zoomToFeature(selectedFeature);
    }
  }, [zoomToFeature]);

  if (loading) {
    return <div className="map-loader">Loading map data...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
    <>
      <header className="map-header">
        <img src={logo} alt="Logo" className="logo" />
        <div className="service-filters">
          <button
            className={`service-filter ${!selectedService ? 'active' : ''}`}
            onClick={() => setSelectedService(null)}
          >
            All Services
          </button>
          {Object.values(services).map(service => (
            <button
              key={service.id}
              className={`service-filter ${selectedService === service.id ? 'active' : ''}`}
              onClick={() => setSelectedService(service.id)}
            >
              {service.name}
            </button>
          ))}
        </div>
      </header>
      <div className="map-container">
        <div className="map-content">
          <LocationSidebar onLocationSelect={handleLocationSelect} />
          <LoadScript 
            googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
            libraries={libraries}
            onLoad={onScriptLoad}
          >
            {isScriptLoaded && (
              <GoogleMap
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
                      elementType: "geometry.fill",
                      stylers: [{ color: "#000000" }]
                    },
                    {
                      featureType: "administrative",
                      elementType: "geometry.stroke",
                      stylers: [{ color: "#144b53" }]
                    },
                    {
                      featureType: "landscape",
                      elementType: "all",
                      stylers: [{ color: "#08304b" }]
                    },
                    {
                      featureType: "poi",
                      elementType: "geometry",
                      stylers: [{ color: "#0c4152" }]
                    },
                    {
                      featureType: "road.highway",
                      elementType: "geometry.fill",
                      stylers: [{ color: "#000000" }]
                    },
                    {
                      featureType: "road.highway",
                      elementType: "geometry.stroke",
                      stylers: [{ color: "#0b434f" }]
                    },
                    {
                      featureType: "water",
                      elementType: "all",
                      stylers: [{ color: "#021019" }]
                    }
                  ],
                  gestureHandling: 'cooperative',
                  minZoom: 5,
                  maxZoom: 18,
                  zoomControl: true,
                  scrollwheel: true,
                  disableDoubleClickZoom: false,
                  zoomControlOptions: {
                    position: window.google?.maps?.ControlPosition?.RIGHT_CENTER
                  },
                  animation: true
                }}
              >
                {mapLoaded && window.google?.maps && (
                  <>
                    {filteredClients.map((client) => {
                      if (!client.lat || !client.lang) return null;
                      const isSelected = selectedClient?.id === client.id;
                      return (
                        <Marker
                          key={client.id}
                          position={{ 
                            lat: parseFloat(client.lat), 
                            lng: parseFloat(client.lang) 
                          }}
                          onClick={() => handleMarkerClick(client)}
                          icon={{
                            url: '/marker.png',
                            scaledSize: new window.google.maps.Size(40, 56),
                            anchor: new window.google.maps.Point(20, 56)
                          }}
                          animation={isSelected ? window.google.maps.Animation.BOUNCE : null}
                        />
                      );
                    })}

                    {selectedClient && (
                      <InfoWindow
                        position={{ 
                          lat: parseFloat(selectedClient.lat), 
                          lng: parseFloat(selectedClient.lang) 
                        }}
                        onCloseClick={() => {
                          setSelectedClient(null);
                          // Reset zoom only if we're zoomed in on the marker
                          if (mapRef.current && mapRef.current.getZoom() === MARKER_ZOOM) {
                            mapRef.current.setZoom(DEFAULT_ZOOM);
                            mapRef.current.setCenter(DEFAULT_CENTER);
                          }
                        }}
                      >
                        <div className="info-window">
                          <h3>{selectedClient.business_name}</h3>
                          <p>{selectedClient.address}</p>
                          <p>{selectedClient.postcode}</p>
                          <div className="services-list">
                            <h4>Services:</h4>
                            <ul>
                              {(clientServices[selectedClient.id] || []).map(serviceId => (
                                <li key={serviceId}>{services[serviceId]?.name}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </InfoWindow>
                    )}

                    {hoveredRegion && hoveredPosition && (
                      <InfoWindow
                        position={hoveredPosition}
                        options={{
                          pixelOffset: new window.google.maps.Size(0, -10),
                          disableAutoPan: true
                        }}
                      >
                        <div className="region-info-window">
                          <h3>{hoveredRegion.region}</h3>
                          <div className="services-availability">
                            {hoveredRegion.services
                              .filter(service => service.slots > 0)
                              .map(service => (
                                <div key={service.id} className="service-item">
                                  {service.businesses.map((business, idx) => (
                                    <div key={idx} className="business-service">
                                      <span className="business-name">{business.name}</span>
                                      <span className="service-detail">
                                        {service.name} ({service.slots}/2 slots)
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            {!hoveredRegion.services.some(service => service.slots > 0) && (
                              <div className="no-services">
                                No services allocated for this location
                              </div>
                            )}
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </>
                )}
              </GoogleMap>
            )}
          </LoadScript>
        </div>
      </div>
    </>
  );
};

export default GoogleMapComponent; 