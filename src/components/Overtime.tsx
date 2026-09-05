import React, { useState } from 'react';
import { Operario, RegistroExtra, Configuración } from '../types';
import { Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Props {
  operarios: Operario[];
  extraDays: RegistroExtra[];
  setExtraDays: (data: RegistroExtra[]) => void;
  config: Configuración;
}

const Overtime: React.FC<Props> = ({ operarios, extraDays, setExtraDays, config }) => {
  const [formData, setFormData] = useState({
    operarioId: operarios[0]?.id || '',
    fecha: new Date().toISOString().slice(0, 10),
    ordinarias: 0,
    extraDiurna: 0,
    extraNocturna: 0,
    extraDominical: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExtraDays([...extraDays, { ...formData, id: Date.now().toString() }]);
  };

  const getWeeklyOT = (operarioId: string) => {
    // Simplified: Assuming all days in extraDays are in the same week for this demo, 
    // or filtering based on current week would be better.
    return extraDays
      .filter(ed => ed.operarioId === operarioId)
      .reduce((sum, ed) => sum + ed.extraDiurna + ed.extraNocturna + ed.extraDominical, 0);
  };

  const calculateLiquidacion = (operarioId: string) => {
      const records = extraDays.filter(ed => ed.operarioId === operarioId);
      const baseHourlyRate = (config.salariosBase[operarioId] || 2000000) / 168; // Assuming 168 hours a month
      return records.reduce((sum, ed) => {
          return sum + 
            (ed.extraDiurna * baseHourlyRate * (1 + config.extraDiurnaPorc / 100)) +
            (ed.extraNocturna * baseHourlyRate * (1 + config.extraNocturnaPorc / 100)) +
            (ed.extraDominical * baseHourlyRate * (1 + config.extraDominicalPorc / 100));
      }, 0);
  }

  const handleDelete = (id: string) => {
    setExtraDays(extraDays.filter(ed => ed.id !== id));
  };

  const handleUpdate = (id: string, field: keyof RegistroExtra, value: number | string) => {
    setExtraDays(extraDays.map(ed => ed.id === id ? { ...ed, [field]: value } : ed));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Control de Horas Extra</h1>
      
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <select value={formData.operarioId} onChange={e => setFormData({...formData, operarioId: e.target.value})} className="border p-2 rounded">
            {operarios.map(op => <option key={op.id} value={op.id}>{op.nombre}</option>)}
        </select>
        <input type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} className="border p-2 rounded" />
        <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Horas ordinarias (h)</label>
            <input type="number" step="0.1" value={formData.ordinarias} onChange={e => setFormData({...formData, ordinarias: Number(e.target.value)})} className="border p-2 rounded" />
        </div>
        <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Horas extra diurnas (h)</label>
            <input type="number" step="0.1" value={formData.extraDiurna} onChange={e => setFormData({...formData, extraDiurna: Number(e.target.value)})} className="border p-2 rounded" />
        </div>
        <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Horas extra nocturnas (h)</label>
            <input type="number" step="0.1" value={formData.extraNocturna} onChange={e => setFormData({...formData, extraNocturna: Number(e.target.value)})} className="border p-2 rounded" />
        </div>
        <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Horas extra dom./fest. (h)</label>
            <input type="number" step="0.1" value={formData.extraDominical} onChange={e => setFormData({...formData, extraDominical: Number(e.target.value)})} className="border p-2 rounded" />
        </div>
        <button type="submit" className="bg-blue-600 text-white p-2 rounded md:col-span-3">Registrar</button>
        <p className="text-xs text-gray-500 md:col-span-3">Nota: El tope legal es de 2 horas extra diarias y 12 horas extra semanales.</p>
      </form>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Registros Recientes</h2>
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b">
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Operario</th>
                    <th className="text-left p-2">Ord.</th>
                    <th className="text-left p-2">Ext.D</th>
                    <th className="text-left p-2">Ext.N</th>
                    <th className="text-left p-2">Ext.DF</th>
                    <th className="text-left p-2">Acciones</th>
                </tr>
            </thead>
            <tbody>
                {extraDays.map(ed => {
                    const op = operarios.find(o => o.id === ed.operarioId);
                    return (
                        <tr key={ed.id} className="border-b">
                            <td className="p-2">{ed.fecha}</td>
                            <td className="p-2">{op?.nombre}</td>
                            <td className="p-2"><input type="number" step="0.1" className="w-16 border rounded p-1" value={ed.ordinarias} onChange={e => handleUpdate(ed.id, 'ordinarias', Number(e.target.value))} /></td>
                            <td className="p-2"><input type="number" step="0.1" className="w-16 border rounded p-1" value={ed.extraDiurna} onChange={e => handleUpdate(ed.id, 'extraDiurna', Number(e.target.value))} /></td>
                            <td className="p-2"><input type="number" step="0.1" className="w-16 border rounded p-1" value={ed.extraNocturna} onChange={e => handleUpdate(ed.id, 'extraNocturna', Number(e.target.value))} /></td>
                            <td className="p-2"><input type="number" step="0.1" className="w-16 border rounded p-1" value={ed.extraDominical} onChange={e => handleUpdate(ed.id, 'extraDominical', Number(e.target.value))} /></td>
                            <td className="p-2"><button onClick={() => handleDelete(ed.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button></td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
      </div>

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Comparativa Semanal</h2>
        <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={operarios.map(op => ({ name: op.nombre, horas: getWeeklyOT(op.id) }))}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="horas" fill="#3b82f6" />
            </BarChart>
        </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Liquidación Estimada</h2>
        <table className="w-full">
            <thead>
                <tr>
                    <th className="text-left">Operario</th>
                    <th className="text-left">Liquidación</th>
                </tr>
            </thead>
            <tbody>
                {operarios.map(op => (
                    <tr key={op.id}>
                        <td>{op.nombre}</td>
                        <td>${calculateLiquidacion(op.id).toFixed(0)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default Overtime;
