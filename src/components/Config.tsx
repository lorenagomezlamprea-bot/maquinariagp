import React, { useState, useEffect } from 'react';
import { Configuración, Operario } from '../types';
import { defaultConfig, saveConfig } from '../lib/config';

interface Props {
  config: Configuración;
  setConfig: (c: Configuración) => void;
  operarios: Operario[];
}

const Config: React.FC<Props> = ({ config, setConfig, operarios }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveConfig(localConfig);
      setConfig(localConfig);
      setMessage('Configuración guardada permanentemente en la nube');
    } catch (err) {
      console.error('Error guardando configuración:', err);
      setMessage('Error al guardar configuración');
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRestore = async () => {
    if (confirm('¿Restaurar valores por defecto?')) {
      setIsSaving(true);
      try {
        await saveConfig(defaultConfig);
        setLocalConfig(defaultConfig);
        setConfig(defaultConfig);
        setMessage('Valores por defecto restaurados en la nube');
      } catch (err) {
        console.error('Error restaurando configuración:', err);
      } finally {
        setIsSaving(false);
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>
      {message && (
        <div className="bg-green-100 border border-green-400 text-green-800 p-3 mb-4 rounded flex items-center justify-between">
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-bold mb-4">Parámetros Legales/Operativos</h2>
          <label className="block mb-2 text-sm font-medium">Tope días descanso: 
            <input type="number" value={localConfig.topeDiasDescanso} onChange={e => setLocalConfig({...localConfig, topeDiasDescanso: Number(e.target.value)})} className="border p-1 w-24 ml-2 rounded"/>
          </label>
          <label className="block mb-2 text-sm font-medium">Tope horas extra diarias: 
            <input type="number" value={localConfig.topeHorasExtraDiarias} onChange={e => setLocalConfig({...localConfig, topeHorasExtraDiarias: Number(e.target.value)})} className="border p-1 w-24 ml-2 rounded"/>
          </label>
          <label className="block mb-2 text-sm font-medium">Tope horas extra semanales: 
            <input type="number" value={localConfig.topeHorasExtraSemanales} onChange={e => setLocalConfig({...localConfig, topeHorasExtraSemanales: Number(e.target.value)})} className="border p-1 w-24 ml-2 rounded"/>
          </label>
          <label className="block mb-2 text-sm font-medium">Descanso mínimo (horas): 
            <input type="number" value={localConfig.horasDescansoMinimo} onChange={e => setLocalConfig({...localConfig, horasDescansoMinimo: Number(e.target.value)})} className="border p-1 w-24 ml-2 rounded"/>
          </label>
        </section>

        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-bold mb-4">Porcentajes de Recargo (%)</h2>
          <label className="block mb-2 text-sm font-medium">Extra diurna: 
            <input type="number" value={localConfig.extraDiurnaPorc} onChange={e => setLocalConfig({...localConfig, extraDiurnaPorc: Number(e.target.value)})} className="border p-1 w-24 ml-2 rounded"/>
          </label>
          <label className="block mb-2 text-sm font-medium">Extra nocturna: 
            <input type="number" value={localConfig.extraNocturnaPorc} onChange={e => setLocalConfig({...localConfig, extraNocturnaPorc: Number(e.target.value)})} className="border p-1 w-24 ml-2 rounded"/>
          </label>
          <label className="block mb-2 text-sm font-medium">Recargo nocturno simple: 
            <input type="number" value={localConfig.recargoNocturnoSimple} onChange={e => setLocalConfig({...localConfig, recargoNocturnoSimple: Number(e.target.value)})} className="border p-1 w-24 ml-2 rounded"/>
          </label>
          <label className="block mb-2 text-sm font-medium">Recargo dominical/festivo: 
            <input type="number" value={localConfig.extraDominicalPorc} onChange={e => setLocalConfig({...localConfig, extraDominicalPorc: Number(e.target.value)})} className="border p-1 w-24 ml-2 rounded"/>
          </label>
        </section>

        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-bold mb-4">Seguridad</h2>
          <label className="block mb-2 text-sm font-medium">PIN de acceso: 
            <input type="password" maxLength={4} value={localConfig.pin} onChange={e => setLocalConfig({...localConfig, pin: e.target.value})} className="border p-1 w-24 ml-2 rounded"/>
          </label>
        </section>
        
        <section className="bg-white p-4 rounded shadow col-span-full">
          <h2 className="text-lg font-bold mb-4">Datos de Nómina (Salario Base)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {operarios.map(op => (
              <label key={op.id} className="block text-sm font-medium">{op.nombre}: 
                <input type="number" value={localConfig.salariosBase[op.id] || 0} onChange={e => setLocalConfig({...localConfig, salariosBase: {...localConfig.salariosBase, [op.id]: Number(e.target.value)}})} className="border p-1.5 w-full mt-1 rounded"/>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 flex gap-4">
        <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:opacity-50">
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button onClick={handleRestore} disabled={isSaving} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition disabled:opacity-50">
          Restaurar valores por defecto
        </button>
      </div>
    </div>
  );
};

export default Config;
