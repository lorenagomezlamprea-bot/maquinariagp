import React from 'react';
import { Operario, RegistroResto, RegistroExtra, Configuración, ProgramacionSemanal } from '../types';

interface Props {
  operarios: Operario[];
  restDays: RegistroResto[];
  extraDays: RegistroExtra[];
  config: Configuración;
  rotation: ProgramacionSemanal | null;
}

const Dashboard: React.FC<Props> = ({ operarios, restDays, extraDays, config, rotation }) => {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const currentWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][now.getDay() - 1] || 'Lunes';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard de Gestión</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {operarios.map(op => {
          const restEntries = restDays.filter(rd => rd.operarioId === op.id && rd.fecha.startsWith(currentMonth) && rd.trabajo);
          const restCount = restEntries.length;
          
          const extraMonth = extraDays.filter(ed => ed.operarioId === op.id && ed.fecha.startsWith(currentMonth))
            .reduce((s, ed) => s + ed.extraDiurna + ed.extraNocturna + ed.extraDominical, 0);
          
          const currentTurnData = rotation?.rotacion[op.id]?.[currentWeek];
          const currentTurnDisplay = currentTurnData ? `${currentTurnData.turno}${currentTurnData.disponibilidad !== 'Ninguna' ? ` / ${currentTurnData.disponibilidad}` : ''}` : 'Descanso';

          let alertClass = 'bg-green-100 border-green-500';
          if (restCount === 2) alertClass = 'bg-yellow-100 border-yellow-500';
          else if (restCount === 3) alertClass = 'bg-orange-100 border-orange-500';
          else if (restCount >= config.topeDiasDescanso) alertClass = 'bg-red-100 border-red-500';

          return (
            <div key={op.id} className={`p-4 border rounded-lg ${alertClass}`}>
              <h2 className="text-lg font-semibold">{op.nombre}</h2>
              <p>Días descanso: {restCount}/{config.topeDiasDescanso}</p>
              <p className="mt-2 font-medium">Extra mes: {extraMonth}h</p>
              <p className="mt-2 font-bold">Turno: {currentTurnDisplay}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
