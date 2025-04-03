import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { FaEdit, FaTrash, FaPlus, FaSearch } from 'react-icons/fa';
import ConfirmModal from './ConfirmModal';
import './ClientList.css';
const ClientList = () => {
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState({});
  const [clientServices, setClientServices] = useState({});
  const [locations, setLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [clientsPerPage] = useState(10);
  const [totalClients, setTotalClients] = useState(0);
  const [sortField, setSortField] = useState('business_name'); 
  const [sortOrder, setSortOrder] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  useEffect(() => {
    fetchData();
  }, [currentPage, sortField, sortOrder, searchTerm]);
  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('clients')
        .select('id', { count: 'exact' });
      if (searchTerm) {
        query = query.ilike('business_name', `%${searchTerm}%`);
      }
      const { count, error: countError } = await query;
      if (countError) throw countError;
      setTotalClients(count || 0);
      const from = (currentPage - 1) * clientsPerPage;
      const to = from + clientsPerPage - 1;
      let clientsQuery = supabase
        .from('clients')
        .select('*')
        .order(sortField, { ascending: sortOrder === 'asc' })
        .range(from, to);
      if (searchTerm) {
        clientsQuery = clientsQuery.ilike('business_name', `%${searchTerm}%`);
      }
      const { data: clientsData, error: clientsError } = await clientsQuery;
      if (clientsError) throw clientsError;
      setClients(clientsData || []);
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*');
      if (servicesError) throw servicesError;
      const servicesMap = {};
      servicesData.forEach(service => {
        servicesMap[service.id] = service;
      });
      setServices(servicesMap);
      const { data: clientServicesData, error: clientServicesError } = await supabase
        .from('client_services')
        .select('*');
      if (clientServicesError) throw clientServicesError;
      const clientServicesMap = {};
      clientServicesData.forEach(cs => {
        if (!clientServicesMap[cs.client_id]) {
          clientServicesMap[cs.client_id] = [];
        }
        clientServicesMap[cs.client_id].push(cs.service_id);
      });
      setClientServices(clientServicesMap);
      
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*');
      if (locationsError) throw locationsError;
      
      const locationsMap = {};
      locationsData.forEach(location => {
        locationsMap[location.id] = location;
      });
      setLocations(locationsMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  const handleDeleteClick = (clientId) => {
    setClientToDelete(clientId);
    setModalOpen(true);
  };
  const handleDeleteConfirm = async () => {
    try {
      setIsDeletingClient(true);
      const clientId = clientToDelete;
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { error: slotError } = await supabase
        .from('location_slot')
        .delete()
        .eq('client_id', clientId);
      if (slotError) throw slotError;
      const { error: csError } = await supabase
        .from('client_services')
        .delete()
        .eq('client_id', clientId);
      if (csError) throw csError;
      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      if (clientError) throw clientError;
      setClients(clients.filter(client => client.id !== clientId));
      setTotalClients(totalClients - 1);
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Failed to delete client. Please try again.');
    } finally {
      setIsDeletingClient(false);
      setModalOpen(false);
      setClientToDelete(null);
    }
  };
  const handleModalClose = () => {
    if (isDeletingClient) return; 
    setModalOpen(false);
    setClientToDelete(null);
  };
  const getClientServiceNames = (clientId) => {
    const serviceIds = clientServices[clientId] || [];
    return serviceIds.map(id => services[id]?.name || 'Unknown')
      .join(', ');
  };
  const getClientLocation = (locationId) => {
    const location = locations[locationId];
    if (!location) return 'Unknown';
    return `${location.city_name} (${location.postcode_initials})`;
  };
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const totalPages = Math.ceil(totalClients / clientsPerPage);
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }
  const clientToDeleteName = clientToDelete 
    ? clients.find(client => client.id === clientToDelete)?.business_name 
    : '';
  return (
    <div className="client-list-container">
      <div className="client-list-header">
        <h2>Client Management</h2>
        <div className="client-list-actions">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); 
              }}
              className="search-input"
            />
            <FaSearch className="search-icon" />
          </div>
          <Link to="/dashboard/add-client" className="add-client-button">
            <FaPlus /> Add Client
          </Link>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}
      {loading ? (
        <div className="loading-message">Loading clients...</div>
      ) : (
        <>
          <div className="client-table-container">
            <table className="client-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('business_name')} className="sortable">
                    Business Name
                    {sortField === 'business_name' && (
                      <span className="sort-indicator">
                        {sortOrder === 'asc' ? ' ↑' : ' ↓'}
                      </span>
                    )}
                  </th>
                  <th onClick={() => handleSort('address')} className="sortable">
                    Address
                    {sortField === 'address' && (
                      <span className="sort-indicator">
                        {sortOrder === 'asc' ? ' ↑' : ' ↓'}
                      </span>
                    )}
                  </th>
                  <th>Country</th>
                  <th>Location</th>
                  <th>Services</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="no-clients-message">
                      {searchTerm ? 'No clients match your search.' : 'No clients found.'}
                    </td>
                  </tr>
                ) : (
                  clients.map(client => (
                    <tr key={client.id}>
                      <td>{client.business_name}</td>
                      <td>{client.address || 'N/A'}</td>
                      <td>{client.country}</td>
                      <td>{getClientLocation(client.location_id)}</td>
                      <td>{getClientServiceNames(client.id)}</td>
                      <td className="actions-cell">
                        <Link 
                          to={`/dashboard/edit-client/${client.id}`} 
                          className="action-button edit-button"
                          title="Edit client"
                        >
                          <FaEdit />
                        </Link>
                        <button 
                          className="action-button delete-button"
                          onClick={() => handleDeleteClick(client.id)}
                          title="Delete client"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="pagination-button"
              >
                Previous
              </button>
              <div className="page-numbers">
                {pageNumbers.map(number => (
                  <button
                    key={number}
                    onClick={() => paginate(number)}
                    className={`pagination-button ${currentPage === number ? 'active' : ''}`}
                  >
                    {number}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="pagination-button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      <ConfirmModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onConfirm={handleDeleteConfirm}
        title="Delete Client"
        message={`Are you sure you want to delete ${clientToDeleteName}?`}
        isLoading={isDeletingClient}
      />
    </div>
  );
};
export default ClientList;