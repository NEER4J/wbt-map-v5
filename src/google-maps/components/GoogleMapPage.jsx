import { useState } from 'react';
import GoogleMapComponent from './GoogleMap';
import './GoogleMapPage.css';

const GoogleMapPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="google-map-page">
      

      <div className="map-container">
        <GoogleMapComponent />
      </div>

      {isSidebarOpen && (
        <div className="sidebar">
          {/* Sidebar content can be added here */}
        </div>
      )}
    </div>
  );
};

export default GoogleMapPage; 