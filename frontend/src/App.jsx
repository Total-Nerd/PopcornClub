import React, { useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';
import { getStoredThemeConfig, applyTheme } from './utils/themeManager';

import MainLayout from './layout/MainLayout';
import Login from './pages/Login';
import CalendarView from './pages/CalendarView';
import Search from './pages/Search';
import MyShows from './pages/MyShows';
import MyMovies from './pages/MyMovies';
import Lists from './pages/Lists';
import SettingsPage from './pages/SettingsPage';
import ShowDetails from './pages/ShowDetails';
import EpisodeDetails from './pages/EpisodeDetails';
import MovieDetails from './pages/MovieDetails';
import PersonDetails from './pages/PersonDetails';
import WatchHistory from './pages/WatchHistory';
import WatchTogetherPage from './pages/WatchTogetherPage';
import ScrollToTop from './components/ScrollToTop';
import Conflicts from './pages/Conflicts';
import StatsPage from './pages/StatsPage';
import RequestsPage from './pages/RequestsPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const AppRoutes = () => {
  const { user } = useContext(AuthContext);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<CalendarView />} />
        <Route path="discover" element={<Search />} />
        <Route path="shows" element={<MyShows />} />
        <Route path="shows/:tmdbId" element={<ShowDetails />} />
        <Route path="shows/:tmdbId/season/:seasonNumber/episode/:episodeNumber" element={<EpisodeDetails />} />
        <Route path="movies" element={<MyMovies />} />
        <Route path="movies/:tmdbId" element={<MovieDetails />} />
        <Route path="person/:personId" element={<PersonDetails />} />
        <Route path="lists" element={<Lists />} />
        <Route path="history" element={<WatchHistory />} />
        <Route path="watch-together" element={<WatchTogetherPage />} />
        <Route path="stats/:username" element={<StatsPage />} />
        <Route path="conflicts" element={user?.role === 'admin' ? <Conflicts /> : <Navigate to="/" />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
};

function App() {
  useEffect(() => {
    const { theme, baseId, accentId } = getStoredThemeConfig();
    applyTheme(theme, baseId, accentId);
  }, []);

  return (
    <AuthProvider>
      <ModalProvider>
        <Router>
          <ScrollToTop />
          <AppRoutes />
        </Router>
      </ModalProvider>
    </AuthProvider>
  );
}

export default App;
