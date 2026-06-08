import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Tv, Calendar, List, Settings, Search, Film, ChevronLeft, ChevronRight, History, User, AlertTriangle } from 'lucide-react';
import MobileBottomSheet from '../components/MobileBottomSheet';

const Sidebar = ({ isCollapsed, onToggle }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleLinkClick = () => {
    setIsMoreOpen(false);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <Tv size={32} />
        <span>TVTracker</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" onClick={handleLinkClick} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Calendar size={20} />
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/discover" onClick={handleLinkClick} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Search size={20} />
          <span>Discover</span>
        </NavLink>
        <NavLink to="/shows" onClick={handleLinkClick} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Tv size={20} />
          <span>Shows</span>
        </NavLink>
        <NavLink to="/movies" onClick={handleLinkClick} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Film size={20} />
          <span>Movies</span>
        </NavLink>
        <NavLink to="/lists" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`}>
          <List size={20} />
          <span>Lists</span>
        </NavLink>
        <NavLink to="/history" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`}>
          <History size={20} />
          <span>History</span>
        </NavLink>
        <NavLink to="/conflicts" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`}>
          <AlertTriangle size={20} />
          <span>Conflicts</span>
        </NavLink>
        <NavLink to="/settings" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only nav-link-settings ${isActive ? 'active' : ''}`}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
        
        {/* Mobile-only More trigger */}
        <button 
          onClick={() => setIsMoreOpen(!isMoreOpen)} 
          className={`nav-link mobile-only ${isMoreOpen ? 'active' : ''}`}
        >
          <User size={20} />
          <span>More</span>
        </button>
      </nav>

      <button className="sidebar-toggle-btn" onClick={onToggle} title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {/* Mobile More Slide-Up bottom sheet */}
      {isMoreOpen && (
        <MobileBottomSheet title="More Options" onClose={() => setIsMoreOpen(false)}>
          <NavLink to="/history" onClick={handleLinkClick} className={({ isActive }) => `mobile-sheet-option ${isActive ? 'active' : ''}`}>
            <History size={18} />
            <span>History</span>
          </NavLink>
          <NavLink to="/conflicts" onClick={handleLinkClick} className={({ isActive }) => `mobile-sheet-option ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={18} />
            <span>Conflicts</span>
          </NavLink>
          <NavLink to="/lists" onClick={handleLinkClick} className={({ isActive }) => `mobile-sheet-option ${isActive ? 'active' : ''}`}>
            <List size={18} />
            <span>Lists</span>
          </NavLink>
          <NavLink to="/settings" onClick={handleLinkClick} className={({ isActive }) => `mobile-sheet-option ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </MobileBottomSheet>
      )}
    </div>
  );
};

export default Sidebar;
