import React, { useState } from 'react';
import { Configuración, Operario } from '../types';
import { defaultConfig } from '../lib/config';

interface Props {
  config: Configuración;
  setConfig: (c: Configuración) => void;
  operarios: Operario[];
}

const Config: React.FC<Props> = ({ config, setConfig, operarios }) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [message, setMessage] = useState('');

  const handleSave = () => {
    setConfig(localConfig);
    setMessage('Configuración guardada correctamente');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleRestore = () => {
    if (confirm('¿Restaurar valores por defecto?')) {
      setLocalConfig(defaultConfig);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>
      {message && <div className="bg-green-100 text-green-800 p-2 mb-4 rounded">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-bold mb-4">Parámetros Legales/Operativos</h2>
          <label className="block mb-2">Tope días descanso: <input type="number" value={localConfig.topeDiasDescanso} onChange={e => setLocalConfig({...localConfig, topeDiasDescanso: Number(e.target.value)})} className="border p-1 w-20"/></label>
          <label className="block mb-2">Tope horas extra diarias: <input type="number" value={localConfig.topeHorasExtraDiarias} onChange={e => setLocalConfig({...localConfig, topeHorasExtraDiarias: Number(e.target.value)})} className="border p-1 w-20"/></label>
          <label className="block mb-2">Tope horas extra semanales: <input type="number" value={localConfig.topeHorasExtraSemanales} onChange={e => setLocalConfig({...localConfig, topeHorasExtraSemanales: Number(e.target.value)})} className="border p-1 w-20"/></label>
          <label className="block mb-2">Descanso mínimo (horas): <input type="number" value={localConfig.horasDescansoMinimo} onChange={e => setLocalConfig({...localConfig, horasDescansoMinimo: Number(e.target.value)})} className="border p-1 w-20"/></label>
        </section>

        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-bold mb-4">Porcentajes de Recargo (%)</h2>
          <label className="block mb-2">Extra diurna: <input type="number" value={localConfig.extraDiurnaPorc} onChange={e => setLocalConfig({...localConfig, extraDiurnaPorc: Number(e.target.value)})} className="border p-1 w-20"/></label>
          <label className="block mb-2">Extra nocturna: <input type="number" value={localConfig.extraNocturnaPorc} onChange={e => setLocalConfig({...localConfig, extraNocturnaPorc: Number(e.target.value)})} className="border p-1 w-20"/></label>
          <label className="block mb-2">Recargo nocturno simple: <input type="number" value={localConfig.recargoNocturnoSimple} onChange={e => setLocalConfig({...localConfig, recargoNocturnoSimple: Number(e.target.value)})} className="border p-1 w-20"/></label>
          <label className="block mb-2">Recargo dominical/festivo: <input type="number" value={localConfig.extraDominicalPorc} onChange={e => setLocalConfig({...localConfig, extraDominicalPorc: Number(e.target.value)})} className="border p-1 w-20"/></label>
        </section>

        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-bold mb-4">Seguridad</h2>
          <label className="block mb-2">PIN de acceso: <input type="password" maxLength={4} value={localConfig.pin} onChange={e => setLocalConfig({...localConfig, pin: e.target.value})} className="border p-1 w-20"/></label>
        </section>
        
        <section className="bg-white p-4 rounded shadow col-span-full">
          <h2 className="text-lg font-bold mb-4">Datos de Nómina (Salario Base)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {operarios.map(op => (
              <label key={op.id} className="block">{op.nombre}: 
                <input type="number" value={localConfig.salariosBase[op.id] || 0} onChange={e => setLocalConfig({...localConfig, salariosBase: {...localConfig.salariosBase, [op.id]: Number(e.target.value)}})} className="border p-1 w-full"/></label>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 flex gap-4">
        <button onClick={handleSave} className="bg-blue-600 text-white p-2 rounded">Guardar cambios</button>
        <button onClick={handleRestore} className="bg-gray-600 text-white p-2 rounded">Restaurar valores por defecto</button>
      </div>
    </div>
  );
};

export default Config;
