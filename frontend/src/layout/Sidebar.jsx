import React, { useState, useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { Tv, Calendar, List, Settings, Search, Film, ChevronLeft, ChevronRight, History, User, AlertTriangle, LogOut, BarChart2, Users, ListPlus, Activity } from 'lucide-react';
import MobileBottomSheet from '../components/MobileBottomSheet';
import { AuthContext } from '../context/AuthContext';

const Sidebar = ({ isCollapsed, onToggle }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { user, logout } = useContext(AuthContext);

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
        <NavLink to="/" onClick={handleLinkClick} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-tooltip="Calendar">
          <Calendar size={20} />
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/discover" onClick={handleLinkClick} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-tooltip="Discover">
          <Search size={20} />
          <span>Discover</span>
        </NavLink>
        <NavLink to="/shows" onClick={handleLinkClick} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-tooltip="Shows">
          <Tv size={20} />
          <span>Shows</span>
        </NavLink>
        <NavLink to="/movies" onClick={handleLinkClick} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} data-tooltip="Movies">
          <Film size={20} />
          <span>Movies</span>
        </NavLink>
        <NavLink to="/lists" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`} data-tooltip="Lists">
          <List size={20} />
          <span>Lists</span>
        </NavLink>
        <NavLink to="/history" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`} data-tooltip="History">
          <History size={20} />
          <span>History</span>
        </NavLink>
        <NavLink to="/social" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`} data-tooltip="Social">
          <Activity size={20} />
          <span>Social</span>
        </NavLink>
        <NavLink to="/watch-together" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`} data-tooltip="Watch Together">
          <Users size={20} />
          <span>Watch Together</span>
        </NavLink>
        <NavLink to="/requests" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`} data-tooltip="Requests">
          <ListPlus size={20} />
          <span>Requests</span>
        </NavLink>
        <NavLink to={`/stats/${user?.username}`} onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`} data-tooltip="Stats">
          <BarChart2 size={20} />
          <span>Stats</span>
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/conflicts" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only ${isActive ? 'active' : ''}`} data-tooltip="Conflicts">
            <AlertTriangle size={20} />
            <span>Conflicts</span>
          </NavLink>
        )}
        <NavLink to="/settings" onClick={handleLinkClick} className={({ isActive }) => `nav-link desktop-only nav-link-settings ${isActive ? 'active' : ''}`} data-tooltip={user?.name || user?.username || 'Settings'}>
          <div className="sidebar-avatar-wrapper">
            {user?.avatarPath ? (
              <img src={user.avatarPath} alt="Profile" className="sidebar-avatar-img" />
            ) : (
              <User size={20} />
            )}
          </div>
          <span>{user?.name || user?.username || 'Settings'}</span>
        </NavLink>
        
        {/* Mobile-only More trigger */}
        <button 
          onClick={() => setIsMoreOpen(!isMoreOpen)} 
          className={`nav-link mobile-only ${isMoreOpen ? 'active' : ''}`}
        >
          <div className="sidebar-avatar-wrapper">
            {user?.avatarPath ? (
              <img src={user.avatarPath} alt="Profile" className="sidebar-avatar-img" />
            ) : (
              <User size={20} />
            )}
          </div>
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
          <NavLink to="/social" onClick={handleLinkClick} className={({ isActive }) => `mobile-sheet-option ${isActive ? 'active' : ''}`}>
            <Users size={18} />
            <span>Social</span>
          </NavLink>
          <NavLink to="/watch-together" onClick={handleLinkClick} className={({ isActive }) => `mobile-sheet-option ${isActive ? 'active' : ''}`}>
            <Users size={18} />
            <span>Watch Together</span>
          </NavLink>
          <NavLink to="/requests" onClick={handleLinkClick} className={({ isActive }) => `mobile-sheet-option ${isActive ? 'active' : ''}`}>
            <ListPlus size={18} />
            <span>Requests</span>
          </NavLink>
          <NavLink to={`/stats/${user?.username}`} onClick={handleLinkClick} className={({ isActive }) => `mobile-sheet-option ${isActive ? 'active' : ''}`}>
            <BarChart2 size={18} />
            <span>Stats</span>
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/conflicts" onClick={handleLinkClick} className={({ isActive }) => `mobile-sheet-option ${isActive ? 'active' : ''}`}>
              <AlertTriangle size={18} />
              <span>Conflicts</span>
            </NavLink>
          )}
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
