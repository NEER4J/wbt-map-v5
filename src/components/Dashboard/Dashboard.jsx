import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { FaUserPlus, FaList, FaSignOutAlt } from 'react-icons/fa';
import { FiMenu } from 'react-icons/fi';
import Logo from '../../assets/logo2.png';
import './Dashboard.css';
import { FcGlobe } from 'react-icons/fc';
const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const handleSignOutClick = () => {
    setShowModal(true);
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };
  const handleCancel = () => {
    setShowModal(false);
  };
  return (
    <div className="dashboard-container">
      {/* Sign Out Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-content">
              <h2>Sign Out</h2>
              <p>Are you sure you want to sign out?</p>
              <div className="modal-buttons">
                <button 
                  className="modal-button cancel-button" 
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button 
                  className="modal-button signout-confirm-button" 
                  onClick={handleSignOut}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          {sidebarOpen && <img src={Logo} alt="Logo" className="sidebar-logo" />}
          <button
            className="toggle-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <FiMenu />
          </button>
        </div>
        <nav className="sidebar-nav">
          <Link
            to="/dashboard/add-client"
            className={location.pathname === '/add-client' ? 'active' : ''}
          >
            <FaUserPlus className="nav-icon" /> {sidebarOpen && <span>Add Client</span>}
          </Link>
          <Link
            to="/dashboard/clients"
            className={location.pathname === '/clients' ? 'active' : ''}
          >
            <FaList className="nav-icon" /> {sidebarOpen && <span>Client List</span>}
          </Link>
          <Link 
            to="/" 
            className="view-map-link"
          >
            <FcGlobe className="nav-icon" /> {sidebarOpen && <span>View Map</span>}
          </Link>
        </nav>
       
        <div className="sidebar-footer">
          <button className="signout-button" onClick={handleSignOutClick}>
            <FaSignOutAlt className="nav-icon" /> {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </div>
      <main className="dashboard-content">
        <div className="dashboard-main">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
export default Dashboard;