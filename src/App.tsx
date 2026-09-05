import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import RestDays from './components/RestDays';
import Overtime from './components/Overtime';
import Rotation from './components/Rotation';
import Config from './components/Config';
import Login from './components/Login';
import { Operario, RegistroResto, RegistroExtra, ProgramacionSemanal } from './types';
import { loadConfig, saveConfig } from './lib/config';
import { loadRestDays, saveRestDays, loadExtraDays, saveExtraDays } from './lib/data';

const initialOperarios: Operario[] = [
  { id: '1', nombre: 'Fidel Castro' },
  { id: '2', nombre: 'Orlando Vargas' },
  { id: '3', nombre: 'Wilson Moreno' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('isAuthenticated'));
  const [restDays, setRestDays] = useState<RegistroResto[]>(loadRestDays);
  const [extraDays, setExtraDays] = useState<RegistroExtra[]>([]);
  const [rotation, setRotation] = useState<ProgramacionSemanal | null>(null);
  const [config, setConfig] = useState(loadConfig);

  useEffect(() => {
    // Only load rotation, others are lazy-loaded via useState initializer
    const savedExtra = localStorage.getItem('extraDays');
    if (savedExtra) setExtraDays(JSON.parse(savedExtra));
    const savedRotation = localStorage.getItem('programacion');
    if (savedRotation) setRotation(JSON.parse(savedRotation));
  }, []);

  useEffect(() => {
    // Only save restDays/extraDays if they change
    // Using Ref or similar could prevent initial render write, 
    // but saving simple state is fine for this app's scale.
    saveRestDays(restDays);
    saveExtraDays(extraDays);
    if (rotation) localStorage.setItem('programacion', JSON.stringify(rotation));
  }, [restDays, extraDays, rotation]);

  const updateConfig = (newConfig: any) => {
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('isAuthenticated', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('isAuthenticated');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} correctPin={config.pin} />;
  }

  const tabs = ['Dashboard', 'Días de Descanso', 'Horas Extra', 'Rotación Semanal', 'Configuración'];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <nav className="w-64 bg-white border-r">
        <div className="p-4 font-bold text-lg border-b">Gestión de Operarios - Maquinaría Amarilla</div>
        {tabs.map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`w-full text-left p-4 ${activeTab === tab ? 'bg-blue-100' : ''}`}
          >
            {tab}
          </button>
        ))}
        <button onClick={handleLogout} className="w-full text-left p-4 text-red-600 font-bold border-t">Cerrar sesión</button>
      </nav>
      <main className="flex-1">
        {activeTab === 'Dashboard' && <Dashboard operarios={initialOperarios} restDays={restDays} extraDays={extraDays} config={config} rotation={rotation} />}
        {activeTab === 'Días de Descanso' && <RestDays operarios={initialOperarios} restDays={restDays} setRestDays={setRestDays} />}
        {activeTab === 'Horas Extra' && <Overtime operarios={initialOperarios} extraDays={extraDays} setExtraDays={setExtraDays} config={config} />}
        {activeTab === 'Rotación Semanal' && <Rotation operarios={initialOperarios} />}
        {activeTab === 'Configuración' && <Config config={config} setConfig={updateConfig} operarios={initialOperarios} />}
      </main>
    </div>
  );
}
