import React, { useState, useMemo } from 'react';
import { Operario, RegistroResto } from '../types';
import { Trash2 } from 'lucide-react';
import { saveRestDayDoc, deleteRestDayDoc } from '../lib/data';

interface Props {
  operarios: Operario[];
  restDays: RegistroResto[];
  setRestDays?: (data: RegistroResto[]) => void;
}

const RestDays: React.FC<Props> = ({ operarios, restDays }) => {
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [formData, setFormData] = useState({
    operarioId: operarios[0]?.id || '',
    fecha: new Date().toISOString().slice(0, 10),
    tipoDia: 'Descanso entre semana' as const,
    trabajo: false,
    horas: 0,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<RegistroResto | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const filteredData = useMemo(() => {
    return restDays
      .filter(rd => rd.fecha.startsWith(filterMonth))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [restDays, filterMonth]);

  const getMonthlyCount = (operarioId: string, month: string) => {
    return restDays.filter(rd => rd.operarioId === operarioId && rd.fecha.startsWith(month) && rd.trabajo).length;
  };

  const handleAddRecord = async (confirmed = false) => {
    const newRecord: RegistroResto = {
      ...formData,
      id: Date.now().toString(),
    };

    const monthOfNewRecord = newRecord.fecha.slice(0, 7);
    const currentCount = getMonthlyCount(newRecord.operarioId, monthOfNewRecord);
    const newCount = newRecord.trabajo ? currentCount + 1 : currentCount;

    if (newRecord.trabajo && !confirmed && newCount > 4) {
      setPendingRecord(newRecord);
      setModalOpen(true);
      return;
    }

    try {
      await saveRestDayDoc(newRecord);
    } catch (e) {
      console.error('Error guardando en Firestore:', e);
    }
    setModalOpen(false);
    setAuthChecked(false);
    setPendingRecord(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este registro?')) {
      try {
        await deleteRestDayDoc(id);
      } catch (e) {
        console.error('Error eliminando en Firestore:', e);
      }
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Control de Días de Descanso</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {operarios.map(op => {
          const count = getMonthlyCount(op.id, filterMonth);
          const alertClass = count >= 4 ? 'bg-red-100 border-red-500' : count === 3 ? 'bg-orange-100 border-orange-500' : count === 2 ? 'bg-yellow-100 border-yellow-500' : 'bg-green-100 border-green-500';
          const alertText = count >= 4 ? 'Tope mensual alcanzado. No debe programarse otro día de descanso trabajado este mes salvo autorización expresa de Gestión Humana' : count === 3 ? 'Atención: le queda solo 1 día disponible este mes' : count === 2 ? 'Va en 2 de 4 días de descanso trabajados este mes' : '';

          return (
            <div key={op.id} className={`p-4 border rounded-lg ${alertClass}`}>
              <h2 className="text-lg font-semibold">{op.nombre}</h2>
              <p className="text-sm">Días descanso trabajados: {count}/4</p>
              <div className="w-full bg-white h-2 rounded-full mt-2">
                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${(count / 4) * 100}%` }}></div>
              </div>
              {alertText && <p className="text-xs mt-2 font-medium">{alertText}</p>}
            </div>
          );
        })}
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Registrar Evento</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <select value={formData.operarioId} onChange={e => setFormData({...formData, operarioId: e.target.value})} className="border p-2 rounded">
            {operarios.map(op => <option key={op.id} value={op.id}>{op.nombre}</option>)}
          </select>
          <input type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} className="border p-2 rounded" />
          <select value={formData.tipoDia} onChange={e => setFormData({...formData, tipoDia: e.target.value as any})} className="border p-2 rounded">
            <option>Descanso entre semana</option>
            <option>Domingo programado</option>
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.trabajo} onChange={e => setFormData({...formData, trabajo: e.target.checked})} /> ¿Trabajó?
          </label>
          <input type="number" placeholder="Horas" value={formData.horas} onChange={e => setFormData({...formData, horas: Number(e.target.value)})} className="border p-2 rounded" />
          <button onClick={() => handleAddRecord()} className="bg-blue-600 text-white p-2 rounded">Guardar</button>
        </div>
      </div>

      <div className="mb-4">
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border p-2 rounded" />
      </div>

      <table className="w-full bg-white shadow rounded-lg overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Operario</th>
            <th className="p-2 text-left">Fecha</th>
            <th className="p-2 text-left">Tipo</th>
            <th className="p-2 text-left">Trabajó</th>
            <th className="p-2 text-left">Horas</th>
            <th className="p-2 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map(rd => (
            <tr key={rd.id} className="border-t">
              <td className="p-2">{operarios.find(op => op.id === rd.operarioId)?.nombre}</td>
              <td className="p-2">{rd.fecha}</td>
              <td className="p-2">{rd.tipoDia}</td>
              <td className="p-2">{rd.trabajo ? 'Sí' : 'No'}</td>
              <td className="p-2">{rd.horas}</td>
              <td className="p-2"><button onClick={() => handleDelete(rd.id)} className="text-red-500"><Trash2 size={18}/></button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg max-w-sm">
            <h2 className="text-lg font-bold mb-4 text-red-600">Alerta: Tope Superado</h2>
            <p className="mb-4">Este registro supera el tope de 4 días de descanso trabajados en el mes.</p>
            <label className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={authChecked} onChange={e => setAuthChecked(e.target.checked)} />
              Confirmo que hay autorización especial de Gestión Humana.
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setModalOpen(false)} className="p-2 rounded bg-gray-200">Cancelar</button>
              <button onClick={() => handleAddRecord(true)} disabled={!authChecked} className="p-2 rounded bg-red-600 text-white disabled:opacity-50">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestDays;
