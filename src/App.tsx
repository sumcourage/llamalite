import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import ServiceList from './pages/Services/ServiceList';
import ServiceCreate from './pages/Services/ServiceCreate';
import ServiceDetail from './pages/Services/ServiceDetail';
import ModelList from './pages/Models/ModelList';
import GeneralSettings from './pages/Settings/GeneralSettings';
import About from './pages/Settings/About';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="services" element={<ServiceList />} />
        <Route path="services/new" element={<ServiceCreate />} />
        <Route path="services/:id" element={<ServiceDetail />} />
        <Route path="services/:id/edit" element={<ServiceCreate />} />
        <Route path="models" element={<ModelList />} />
        <Route path="settings" element={<GeneralSettings />} />
        <Route path="settings/about" element={<About />} />
      </Route>
    </Routes>
  );
};

export default App;