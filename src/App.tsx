import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import RestDays from './components/RestDays';
import Overtime from './components/Overtime';
import Config from './components/Config';
import Login from './components/Login';
import { Operario, RegistroResto, RegistroExtra } from './types';
import { defaultConfig, subscribeConfig, saveConfig } from './lib/config';
import { subscribeRestDays, subscribeExtraDays } from './lib/data';
import { CloudCheck, CloudOff, RefreshCw } from 'lucide-react';

const initialOperarios: Operario[] = [
  { id: '1', nombre: 'Fidel Castro' },
  { id: '2', nombre: 'Orlando Vargas' },
  { id: '3', nombre: 'Wilson Moreno' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('isAuthenticated'));
  const [restDays, setRestDays] = useState<RegistroResto[]>([]);
  const [extraDays, setExtraDays] = useState<RegistroExtra[]>([]);
  const [config, setConfig] = useState(defaultConfig);
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    // 1. Subscribe to real-time rest days from Firestore
    const unsubRest = subscribeRestDays((data) => {
      setRestDays(data);
      setIsSynced(true);
    });

    // 2. Subscribe to real-time extra hours from Firestore
    const unsubExtra = subscribeExtraDays((data) => {
      setExtraDays(data);
      setIsSynced(true);
    });

    // 3. Subscribe to real-time configuration from Firestore
    const unsubConfig = subscribeConfig((data) => {
      setConfig(data);
      setIsSynced(true);
    });

    return () => {
      unsubRest();
      unsubExtra();
      unsubConfig();
    };
  }, []);

  const updateConfig = async (newConfig: any) => {
    setConfig(newConfig);
    await saveConfig(newConfig);
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

  const tabs = ['Dashboard', 'Días de Descanso', 'Horas Extra', 'Configuración'];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <nav className="w-64 bg-white border-r flex flex-col justify-between">
        <div>
          <div className="p-4 font-bold text-lg border-b text-gray-800">
            Gestión de Operarios - Maquinaria Amarilla
          </div>
          <div className="py-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-4 py-3 font-medium transition flex items-center justify-between ${
                  activeTab === tab ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{tab}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex items-center text-xs text-gray-500 gap-1.5 bg-gray-50 p-2 rounded border border-gray-100">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Persistencia en la nube activa</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left py-2 px-1 text-red-600 font-semibold hover:text-red-700 transition"
          >
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'Dashboard' && (
          <Dashboard
            operarios={initialOperarios}
            restDays={restDays}
            extraDays={extraDays}
            config={config}
            rotation={null}
          />
        )}
        {activeTab === 'Días de Descanso' && (
          <RestDays
            operarios={initialOperarios}
            restDays={restDays}
            setRestDays={setRestDays}
          />
        )}
        {activeTab === 'Horas Extra' && (
          <Overtime
            operarios={initialOperarios}
            extraDays={extraDays}
            setExtraDays={setExtraDays}
            config={config}
          />
        )}
        {activeTab === 'Configuración' && (
          <Config
            config={config}
            setConfig={updateConfig}
            operarios={initialOperarios}
          />
        )}
      </main>
    </div>
  );
}
