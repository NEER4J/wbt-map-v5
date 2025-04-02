import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import Select from 'react-select';
import Modal from 'react-modal';
import './AddClient.css';

// Set Modal app element for accessibility
Modal.setAppElement('#root');

const AddClient = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    business_name: '',
    address: '',
    country: '',
    lat: '',
    lang: '',
    location_id: null,
  });
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // New state for service creation
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [newService, setNewService] = useState({ name: '', color: '#4A6FA5' });
  const [serviceCreationError, setServiceCreationError] = useState(null);
  const [serviceCreationLoading, setServiceCreationLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('id, name, color');
        if (servicesError) throw servicesError;
        setServices(servicesData);

        const { data: locationsData, error: locationsError } = await supabase
          .from('locations')
          .select('id, city_name, region, postcode_initials');
        if (locationsError) throw locationsError;
        setLocations(locationsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load required data. Please try again.');
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleServiceChange = (selected) => {
    // Check if the "Create New" option was selected
    if (selected && selected.some(option => option.value === 'create-new')) {
      // Remove the "Create New" option from selection
      const filteredSelection = selected.filter(option => option.value !== 'create-new');
      setSelectedServices(filteredSelection);
      // Open the modal
      setShowServiceModal(true);
    } else {
      setSelectedServices(selected || []);
    }
  };

  const handleLocationChange = (selected) => {
    setFormData(prev => ({ ...prev, location_id: selected ? selected.value : null }));
  };

  const handleNewServiceChange = (e) => {
    const { name, value } = e.target;
    setNewService(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.business_name) return 'Business name is required';
    if (!formData.address) return 'Address is required';
    if (!formData.country) return 'Country is required';
    if (!formData.lat || !formData.lang) return 'Coordinates are required';
    if (!formData.location_id) return 'Please select a location';
    if (selectedServices.length === 0) return 'Please select at least one service';
    const lat = parseFloat(formData.lat);
    const lng = parseFloat(formData.lang);
    if (isNaN(lat) || lat < -90 || lat > 90) return 'Invalid latitude';
    if (isNaN(lng) || lng < -180 || lng > 180) return 'Invalid longitude';
    return null;
  };

  const createNewService = async () => {
    if (!newService.name.trim()) {
      setServiceCreationError('Service name is required');
      return;
    }

    setServiceCreationLoading(true);
    setServiceCreationError(null);

    try {
      // Insert the new service
      const { data: createdService, error: serviceError } = await supabase
        .from('services')
        .insert([{
          name: newService.name.trim(),
          color: newService.color,
        }])
        .select()
        .single();

      if (serviceError) throw serviceError;

      // Add the new service to the services list
      setServices([...services, createdService]);

      // Add the new service to the selected services
      const newServiceOption = {
        value: createdService.id,
        label: createdService.name,
        color: createdService.color
      };

      setSelectedServices([...selectedServices, newServiceOption]);
      
      // Close the modal and reset the form
      setShowServiceModal(false);
      setNewService({ name: '', color: '#4A6FA5' });
      
    } catch (error) {
      console.error('Error creating service:', error);
      setServiceCreationError(`Failed to create service: ${error.message || 'Please try again.'}`);
    } finally {
      setServiceCreationLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert([{
          business_name: formData.business_name,
          address: formData.address,
          country: formData.country,
          lat: formData.lat,
          lang: formData.lang,
          location_id: formData.location_id
        }])
        .select()
        .single();
      if (clientError) throw clientError;
      console.log("CLIENT", client);

      const { data: tableInfo, error: tableError } = await supabase
        .rpc('get_client_services_columns');
      console.log("Raw table info:", tableInfo);

      const clientServiceData = selectedServices.map(service => ({
        client_id: client.id,
        service_id: service.value
      }));
      console.log("CLIENT SERVICE DATA", clientServiceData);

      for (const service of selectedServices) {
        const { error: servicesError } = await supabase
          .from('client_services')
          .insert({
            id: crypto.randomUUID(), 
            client_id: client.id,
            service_id: service.value
          });

        if (servicesError) {
          console.error('Error inserting client service:', servicesError);
          throw servicesError;
        }
      }

      for (const service of selectedServices) {
        const { data: slotData, error: slotCheckError } = await supabase
            .from('location_slot')
            .select('*')
            .eq('location_id', formData.location_id)
            .eq('service_id', service.value)
            .eq('status', 'available')  
            .limit(1);
        if (slotCheckError) throw slotCheckError;
        console.log("SLOT DATA", slotData);

        if (slotData && slotData.length > 0) {
          const { error: slotUpdateError } = await supabase
            .from('location_slot')
            .update({ 
              client_id: client.id, 
              status: 'occupied' 
            }) 
            .eq('id', slotData[0].id);
          if (slotUpdateError) throw slotUpdateError;
        } else {
          const { data: existingSlots, error: countError } = await supabase
            .from('location_slot')
            .select('slot_number')
            .eq('location_id', formData.location_id)
            .eq('service_id', service.value);
            
          if (countError) throw countError;
          const nextSlotNumber = existingSlots.length + 1;
          const { error: newSlotError } = await supabase
            .from('location_slot')
            .insert([{
              location_id: formData.location_id,
              service_id: service.value,
              client_id: client.id,
              slot_number: nextSlotNumber,
              status: 'occupied'
            }]);
          if (newSlotError) throw newSlotError;
        }
      }

      setSuccess(true);
      setFormData({
        business_name: '',
        address: '',
        country: '',
        lat: '',
        lang: '',
        location_id: null
      });
      setSelectedServices([]);
      setTimeout(() => {
        navigate('/dashboard/clients');
      }, 2000);
    } catch (error) {
      console.error('Error creating client:', error);
      setError(`Failed to create client: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Create service options including the "Create New" option
  const serviceOptions = [
    ...services.map(service => ({
      value: service.id,
      label: service.name,
      color: service.color
    })),
    {
      value: 'create-new',
      label: '+ Create New Service',
      color: '#28a745'
    }
  ];

  const locationOptions = locations.map(location => ({
    value: location.id,
    label: `${location.city_name} (${location.postcode_initials}) - ${location.region}`
  }));

  const customSelectStyles = {
    option: (provided, state) => ({
      ...provided,
      color: state.data.color || '#333',
      backgroundColor: state.isSelected ? '#f0f0f0' : state.isFocused ? '#f9f9f9' : null,
      fontWeight: state.data.value === 'create-new' ? 'bold' : 'normal'
    }),
    multiValue: (provided, state) => ({
      ...provided,
      backgroundColor: state.data.color ? `${state.data.color}22` : '#f0f0f0'
    }),
    multiValueLabel: (provided, state) => ({
      ...provided,
      color: state.data.color || '#333'
    })
  };

  return (
    <div className="add-client-container">
      <h2 className='header-form'>Add Client</h2>
      <div className="form-container">
        {success && (
          <div className="success-message">
            Client added successfully! Redirecting to client list...
          </div>
        )}
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="client-form">
          <div className="form-group">
            <label htmlFor="business_name">Business Name*</label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              value={formData.business_name}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="address">Address*</label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="country">Country*</label>
            <input
              id="country"
              name="country"
              type="text"
              value={formData.country}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group half">
              <label htmlFor="lat">Latitude*</label>
              <input
                id="lat"
                name="lat"
                type="text"
                value={formData.lat}
                onChange={handleChange}
                placeholder="e.g. 51.5074"
                required
              />
            </div>
            <div className="form-group half">
              <label htmlFor="lang">Longitude*</label>
              <input
                id="lang"
                name="lang"
                type="text"
                value={formData.lang}
                onChange={handleChange}
                placeholder="e.g. -0.1278"
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="services">Services*</label>
            <Select
              id="services"
              isMulti
              options={serviceOptions}
              value={selectedServices}
              onChange={handleServiceChange}
              styles={customSelectStyles}
              placeholder="Select services or create new..."
              className="react-select-container"
              classNamePrefix="react-select"
            />
            <small className="helper-text">
              Select all services that apply to this client or create a new one
            </small>
          </div>
          
          <div className="form-group">
            <label htmlFor="location">Location*</label>
            <Select
              id="location"
              options={locationOptions}
              onChange={handleLocationChange}
              placeholder="Select a location..."
              className="react-select-container"
              classNamePrefix="react-select"
            />
            <small className="helper-text">
              Select the location this client is associated with
            </small>
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-button"
              onClick={() => navigate('/dashboard/clients')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Add Client'}
            </button>
          </div>
        </form>

        {/* Modal for adding a new service */}
        <Modal
          isOpen={showServiceModal}
          onRequestClose={() => setShowServiceModal(false)}
          contentLabel="Add New Service"
          className="service-modal"
          overlayClassName="service-modal-overlay"
        >
          <div className="service-modal-content">
            <h3>Add New Service</h3>
            {serviceCreationError && <div className="error-message">{serviceCreationError}</div>}
            
            <div className="form-group">
              <label htmlFor="service-name">Service Name*</label>
              <input
                id="service-name"
                name="name"
                type="text"
                value={newService.name}
                onChange={handleNewServiceChange}
                placeholder="Enter service name"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="service-color">Service Color</label>
              <div className="color-picker-container">
                <input
                  id="service-color"
                  name="color"
                  type="color"
                  value={newService.color}
                  onChange={handleNewServiceChange}
                  className="color-picker"
                />
                <span className="color-value">{newService.color}</span>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                type="button" 
                className="cancel-button"
                onClick={() => setShowServiceModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="submit-button"
                onClick={createNewService}
                disabled={serviceCreationLoading}
              >
                {serviceCreationLoading ? 'Creating...' : 'Add Service'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default AddClient;