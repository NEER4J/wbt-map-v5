import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { FaSave, FaTimes } from 'react-icons/fa';
import './EditClient.css';
const EditClient = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [client, setClient] = useState({
    business_name: '',
    address: '',  
    postcode: '', 
    country: '',
    location_id: '',
    lat: '',
    lang: ''
  });
  const [locations, setLocations] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true);
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', id)
          .single();
        if (clientError) throw clientError;
        if (!clientData) throw new Error('Client not found');
        setClient(clientData);
        const { data: clientServicesData, error: csError } = await supabase
          .from('client_services')
          .select('service_id')
          .eq('client_id', id);
        if (csError) throw csError;
        setSelectedServices(clientServicesData.map(cs => cs.service_id));
      } catch (error) {
        console.error('Error fetching client data:', error);
        setError('Failed to load client data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const fetchLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .order('city_name');
        if (error) throw error;
        setLocations(data || []);
      } catch (error) {
        console.error('Error fetching locations:', error);
        setError('Failed to load locations. Please try again.');
      }
    };

    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order('name');
        if (error) throw error;
        setServices(data || []);
      } catch (error) {
        console.error('Error fetching services:', error);
        setError('Failed to load services. Please try again.');
      }
    };

    fetchClientData();
    fetchLocations();
    fetchServices();
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setClient(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleServiceChange = (serviceId) => {
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!client.business_name || !client.location_id || !client.address || !client.postcode) {
      setError('Business name, address, postcode, and location are required.');
      return;
    }
    try {
      setFormSubmitting(true);
      setError(null);
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          business_name: client.business_name,
          address: client.address,        
          postcode: client.postcode,      
          country: client.country,
          location_id: client.location_id,
          lat: client.lat,
          lang: client.lang,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      if (updateError) throw updateError;
      const { error: deleteError } = await supabase
        .from('client_services')
        .delete()
        .eq('client_id', id);
      if (deleteError) throw deleteError;
      if (selectedServices.length > 0) {
        const clientServicesData = selectedServices.map(serviceId => ({
          id: crypto.randomUUID(), 
          client_id: id,
          service_id: serviceId
        }));
        const { error: insertError } = await supabase
          .from('client_services')
          .insert(clientServicesData);
        if (insertError) throw insertError;
      }
      navigate('/dashboard/clients');
    } catch (error) {
      console.error('Error updating client:', error);
      setError('Failed to update client. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };
  if (loading) {
    return <div className="loading-message">Loading client data...</div>;
  }
  return (
    <div className="edit-client-container">
      <div className="edit-client-header">
        <h2>Edit Client</h2>
        <div className="header-actions">
          <button 
            className="cancel-button"
            onClick={() => navigate('/dashboard/clients')}
            disabled={formSubmitting}
          >
            <FaTimes /> Cancel
          </button>
          <button 
            className="save-button"
            onClick={handleSubmit}
            disabled={formSubmitting}
          >
            <FaSave /> {formSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}
      <form className="edit-client-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Business Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="business_name">Business Name</label>
              <input
                type="text"
                id="business_name"
                name="business_name"
                value={client.business_name}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="address">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                value={client.address}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="postcode">Postcode</label>
              <input
                type="text"
                id="postcode"
                name="postcode"
                value={client.postcode}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="country">Country</label>
              <input
                type="text"
                id="country"
                name="country"
                value={client.country}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="location_id">Location</label>
              <select
                id="location_id"
                name="location_id"
                value={client.location_id}
                onChange={handleInputChange}
                required
              >
                <option value="">Select a location</option>
                {locations.map(location => (
                  <option key={location.id} value={location.id}>
                    {location.city_name} ({location.postcode_initials})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="form-section">
          <h3>Map Coordinates</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="lat">Latitude</label>
              <input
                type="text"
                id="lat"
                name="lat"
                value={client.lat}
                onChange={handleInputChange}
                placeholder="e.g. 51.5074"
              />
            </div>
            <div className="form-group">
              <label htmlFor="lang">Longitude</label>
              <input
                type="text"
                id="lang"
                name="lang"
                value={client.lang}
                onChange={handleInputChange}
                placeholder="e.g. -0.1278"
              />
            </div>
          </div>
        </div>
        <div className="form-section">
          <h3>Services</h3>
          <div className="services-selection">
            {services.map(service => (
              <div key={service.id} className="service-checkbox">
                <input
                  type="checkbox"
                  id={`service-${service.id}`}
                  checked={selectedServices.includes(service.id)}
                  onChange={() => handleServiceChange(service.id)}
                />
                <label htmlFor={`service-${service.id}`}>{service.name}</label>
              </div>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
};
export default EditClient;