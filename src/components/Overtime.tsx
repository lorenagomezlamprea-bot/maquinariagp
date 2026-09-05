import React, { useState } from 'react';
import { Operario, RegistroExtra, Configuración } from '../types';
import { Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { saveExtraDayDoc, deleteExtraDayDoc } from '../lib/data';

interface Props {
  operarios: Operario[];
  extraDays: RegistroExtra[];
  setExtraDays?: (data: RegistroExtra[]) => void;
  config: Configuración;
}

const Overtime: React.FC<Props> = ({ operarios, extraDays, config }) => {
  const [formData, setFormData] = useState({
    operarioId: operarios[0]?.id || '',
    fecha: new Date().toISOString().slice(0, 10),
    ordinarias: 0,
    extraDiurna: 0,
    extraNocturna: 0,
    extraDominical: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: RegistroExtra = {
      ...formData,
      id: Date.now().toString(),
    };
    try {
      await saveExtraDayDoc(newRecord);
      // Reset numeric inputs
      setFormData(prev => ({
        ...prev,
        ordinarias: 0,
        extraDiurna: 0,
        extraNocturna: 0,
        extraDominical: 0,
      }));
    } catch (err) {
      console.error('Error guardando horas extra:', err);
    }
  };

  const getWeeklyOT = (operarioId: string) => {
    return extraDays
      .filter(ed => ed.operarioId === operarioId)
      .reduce((sum, ed) => sum + ed.extraDiurna + ed.extraNocturna + ed.extraDominical, 0);
  };

  const calculateLiquidacion = (operarioId: string) => {
    const records = extraDays.filter(ed => ed.operarioId === operarioId);
    const baseHourlyRate = (config.salariosBase[operarioId] || 2000000) / 168; // 168h base mensual
    return records.reduce((sum, ed) => {
      return sum + 
        (ed.extraDiurna * baseHourlyRate * (1 + config.extraDiurnaPorc / 100)) +
        (ed.extraNocturna * baseHourlyRate * (1 + config.extraNocturnaPorc / 100)) +
        (ed.extraDominical * baseHourlyRate * (1 + config.extraDominicalPorc / 100));
    }, 0);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Desea eliminar este registro de horas extra?')) {
      try {
        await deleteExtraDayDoc(id);
      } catch (err) {
        console.error('Error eliminando horas extra:', err);
      }
    }
  };

  const handleUpdate = async (id: string, field: keyof RegistroExtra, value: number | string) => {
    const target = extraDays.find(ed => ed.id === id);
    if (!target) return;
    const updated: RegistroExtra = {
      ...target,
      [field]: value,
    };
    try {
      await saveExtraDayDoc(updated);
    } catch (err) {
      console.error('Error actualizando horas extra:', err);
    }
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
        
        <button type="submit" className="bg-blue-600 text-white p-2 rounded md:col-span-3 hover:bg-blue-700 transition">Registrar</button>
        <p className="text-xs text-gray-500 md:col-span-3">Nota: El tope legal es de 2 horas extra diarias y 12 horas extra semanales.</p>
      </form>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Registros Guardados en la Nube</h2>
        {extraDays.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No hay registros de horas extra ingresados todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Operario</th>
                  <th className="text-left p-2">Ord. (h)</th>
                  <th className="text-left p-2">Ext. Diurna</th>
                  <th className="text-left p-2">Ext. Nocturna</th>
                  <th className="text-left p-2">Ext. Dom/Fest</th>
                  <th className="text-left p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {extraDays.map(ed => {
                  const op = operarios.find(o => o.id === ed.operarioId);
                  return (
                    <tr key={ed.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{ed.fecha}</td>
                      <td className="p-2 font-medium">{op?.nombre}</td>
                      <td className="p-2">
                        <input type="number" step="0.1" className="w-20 border rounded p-1" value={ed.ordinarias} onChange={e => handleUpdate(ed.id, 'ordinarias', Number(e.target.value))} />
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.1" className="w-20 border rounded p-1" value={ed.extraDiurna} onChange={e => handleUpdate(ed.id, 'extraDiurna', Number(e.target.value))} />
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.1" className="w-20 border rounded p-1" value={ed.extraNocturna} onChange={e => handleUpdate(ed.id, 'extraNocturna', Number(e.target.value))} />
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.1" className="w-20 border rounded p-1" value={ed.extraDominical} onChange={e => handleUpdate(ed.id, 'extraDominical', Number(e.target.value))} />
                      </td>
                      <td className="p-2">
                        <button onClick={() => handleDelete(ed.id)} className="text-red-500 hover:text-red-700 p-1" title="Eliminar registro">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
              <Bar dataKey="horas" fill="#3b82f6" name="Total Horas Extra" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Liquidación Estimada</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Operario</th>
              <th className="text-left p-2">Liquidación</th>
            </tr>
          </thead>
          <tbody>
            {operarios.map(op => (
              <tr key={op.id} className="border-b">
                <td className="p-2 font-medium">{op.nombre}</td>
                <td className="p-2 font-bold text-green-700">${calculateLiquidacion(op.id).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Overtime;
