import React, { useState, useEffect, useMemo } from 'react';
import { Operario, RegistroExtra, Configuración } from '../types';
import { Trash2, Clock, Calendar, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Eye, ShieldAlert, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { saveExtraDayDoc, deleteExtraDayDoc } from '../lib/data';
import { getProgramacionOperario, getWeekScheduleMatrix, getSundayOfWeek, DIA_NOMBRES, ShiftInfo } from '../lib/schedule';
import { calcularDesgloseHoras, DesgloseHorasResult } from '../lib/calculator';

interface Props {
  operarios: Operario[];
  extraDays: RegistroExtra[];
  setExtraDays?: (data: RegistroExtra[]) => void;
  config: Configuración;
}

const Overtime: React.FC<Props> = ({ operarios, extraDays, config }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const [selectedOperarioId, setSelectedOperarioId] = useState<string>(operarios[0]?.id || '1');
  const [selectedFecha, setSelectedFecha] = useState<string>(todayStr);
  const [horaInicio, setHoraInicio] = useState<string>('06:00');
  const [horaFin, setHoraFin] = useState<string>('14:00');
  const [esFestivoManual, setEsFestivoManual] = useState<boolean>(false);
  const [esDescansoTrabajado, setEsDescansoTrabajado] = useState<boolean>(false);
  const [observaciones, setObservaciones] = useState<string>('');
  
  // Manual overrides if user tweaks calculated numbers
  const [manualOverride, setManualOverride] = useState(false);
  const [customOrdinarias, setCustomOrdinarias] = useState<number>(0);
  const [customExtraDiurna, setCustomExtraDiurna] = useState<number>(0);
  const [customExtraNocturna, setCustomExtraNocturna] = useState<number>(0);
  const [customExtraDominical, setCustomExtraDominical] = useState<number>(0);

  // Weekly Schedule Viewer State
  const [scheduleWeekSunday, setScheduleWeekSunday] = useState<string>(getSundayOfWeek(todayStr));
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'registro' | 'programacion' | 'liquidacion'>('registro');

  // Query programmed shift whenever operario or date changes
  const shiftInfo: ShiftInfo = useMemo(() => {
    return getProgramacionOperario(selectedOperarioId, selectedFecha);
  }, [selectedOperarioId, selectedFecha]);

  // When operario or date changes, pre-fill default hours according to shift
  useEffect(() => {
    if (!manualOverride) {
      setHoraInicio(shiftInfo.horaInicioDefault);
      setHoraFin(shiftInfo.horaFinDefault);
      setEsFestivoManual(shiftInfo.esFestivo);
      setEsDescansoTrabajado(shiftInfo.esDescanso);
    }
  }, [selectedOperarioId, selectedFecha, shiftInfo]);

  // Automatically calculate breakdown of hours
  const calculatedBreakdown: DesgloseHorasResult = useMemo(() => {
    return calcularDesgloseHoras({
      fecha: selectedFecha,
      horaInicio,
      horaFin,
      esDescanso: esDescansoTrabajado,
      esFestivoOverride: esFestivoManual || shiftInfo.esFestivo,
      maxOrdinarias: 8,
    });
  }, [selectedFecha, horaInicio, horaFin, esDescansoTrabajado, esFestivoManual, shiftInfo.esFestivo]);

  // Use either calculated or manually overridden values
  const finalOrdinarias = manualOverride ? customOrdinarias : calculatedBreakdown.ordinarias;
  const finalExtraDiurna = manualOverride ? customExtraDiurna : calculatedBreakdown.extraDiurna;
  const finalExtraNocturna = manualOverride ? customExtraNocturna : calculatedBreakdown.extraNocturna;
  const finalExtraDominical = manualOverride ? customExtraDominical : calculatedBreakdown.extraDominical;
  const totalHorasCalculadas = calculatedBreakdown.totalHoras;
  const totalHorasExtras = finalExtraDiurna + finalExtraNocturna + finalExtraDominical;

  // Daily and weekly compliance check
  const isDailyOverLimit = totalHorasExtras > config.topeHorasExtraDiarias;

  const currentOperarioWeeklyOT = useMemo(() => {
    const currentWeekSunday = getSundayOfWeek(selectedFecha);
    const sundayTime = new Date(currentWeekSunday).getTime();
    const saturdayTime = sundayTime + 6 * 24 * 60 * 60 * 1000;

    return extraDays
      .filter(ed => {
        if (ed.operarioId !== selectedOperarioId) return false;
        const edTime = new Date(ed.fecha).getTime();
        return edTime >= sundayTime && edTime <= saturdayTime;
      })
      .reduce((sum, ed) => sum + ed.extraDiurna + ed.extraNocturna + ed.extraDominical, 0);
  }, [extraDays, selectedOperarioId, selectedFecha]);

  const isWeeklyOverLimit = (currentOperarioWeeklyOT + totalHorasExtras) > config.topeHorasExtraSemanales;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newRecord: RegistroExtra = {
      id: Date.now().toString(),
      operarioId: selectedOperarioId,
      fecha: selectedFecha,
      horaInicio,
      horaFin,
      turnoProgramado: `${shiftInfo.turno}${shiftInfo.maquina ? ` (${shiftInfo.maquina})` : ''}`,
      maquina: shiftInfo.maquina,
      ordinarias: finalOrdinarias,
      extraDiurna: finalExtraDiurna,
      extraNocturna: finalExtraNocturna,
      extraDominical: finalExtraDominical,
      totalHoras: totalHorasCalculadas,
      esFestivo: esFestivoManual || shiftInfo.esFestivo,
      observaciones: observaciones.trim(),
    };

    try {
      await saveExtraDayDoc(newRecord);
      setManualOverride(false);
      setObservaciones('');
    } catch (err) {
      console.error('Error guardando horas extra:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Desea eliminar este registro de horas?')) {
      try {
        await deleteExtraDayDoc(id);
      } catch (err) {
        console.error('Error eliminando horas extra:', err);
      }
    }
  };

  const handleUpdateRecordField = async (id: string, field: keyof RegistroExtra, value: any) => {
    const target = extraDays.find(ed => ed.id === id);
    if (!target) return;
    const updated: RegistroExtra = {
      ...target,
      [field]: value,
    };
    try {
      await saveExtraDayDoc(updated);
    } catch (err) {
      console.error('Error actualizando registro:', err);
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

  // Schedule matrix for the weekly view
  const weekSchedule = useMemo(() => {
    return getWeekScheduleMatrix(scheduleWeekSunday, operarios);
  }, [scheduleWeekSunday, operarios]);

  const changeWeek = (direction: number) => {
    const currentParts = scheduleWeekSunday.split('-').map(Number);
    const d = new Date(currentParts[0], currentParts[1] - 1, currentParts[2]);
    d.setDate(d.getDate() + direction * 7);
    const newSunday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setScheduleWeekSunday(newSunday);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Subtabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control y Cálculo de Horas Extra</h1>
          <p className="text-sm text-gray-600 mt-1">
            Ingreso por hora de inicio y fin con desglose legal automático según rotación semanal de turnos.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('registro')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
              activeTab === 'registro' ? 'bg-white shadow text-blue-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Registro y Cálculo
          </button>
          <button
            onClick={() => setActiveTab('programacion')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'programacion' ? 'bg-white shadow text-blue-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar size={15} />
            Programación Semanal
          </button>
          <button
            onClick={() => setActiveTab('liquidacion')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
              activeTab === 'liquidacion' ? 'bg-white shadow text-blue-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Liquidación y Estadísticas
          </button>
        </div>
      </div>

      {/* VIEW 1: REGISTRO Y CÁLCULO */}
      {activeTab === 'registro' && (
        <div className="space-y-6">
          {/* Main Input Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-200" />
                  Registro de Jornada Laboral
                </h2>
                <p className="text-xs text-blue-100">
                  Calcula automáticamente horas ordinarias, extras diurnas, nocturnas y dominicales/festivas.
                </p>
              </div>

              {/* Scheduled Shift Badge */}
              <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-xs flex items-center gap-2">
                <span className="font-semibold text-blue-100">Turno Programado:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  shiftInfo.turno === 'Turno Día'
                    ? 'bg-amber-400 text-amber-950'
                    : shiftInfo.turno === 'Turno Noche'
                    ? 'bg-indigo-900 text-indigo-100'
                    : 'bg-emerald-400 text-emerald-950'
                }`}>
                  {shiftInfo.turno} ({shiftInfo.horario})
                </span>
                {shiftInfo.maquina && (
                  <span className="bg-white/20 px-1.5 py-0.5 rounded text-white font-medium">
                    {shiftInfo.maquina}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Row 1: Operario, Fecha, Shift Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Operario de Maquinaria
                  </label>
                  <select
                    value={selectedOperarioId}
                    onChange={(e) => {
                      setSelectedOperarioId(e.target.value);
                      setManualOverride(false);
                    }}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  >
                    {operarios.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Fecha de Trabajo
                  </label>
                  <input
                    type="date"
                    value={selectedFecha}
                    onChange={(e) => {
                      setSelectedFecha(e.target.value);
                      setManualOverride(false);
                    }}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  />
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                    <span className="capitalize font-semibold text-gray-700">{shiftInfo.nombreDia}</span>
                    {shiftInfo.esDomingo && (
                      <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Domingo</span>
                    )}
                    {shiftInfo.esFestivo && (
                      <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Festivo Nacional</span>
                    )}
                    {shiftInfo.esDescanso && (
                      <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">Descanso Programado</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-end space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer bg-gray-50 p-2 rounded-lg border">
                    <input
                      type="checkbox"
                      checked={esFestivoManual}
                      onChange={(e) => {
                        setEsFestivoManual(e.target.checked);
                        setManualOverride(false);
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium">Tratar como Día Festivo</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer bg-gray-50 p-2 rounded-lg border">
                    <input
                      type="checkbox"
                      checked={esDescansoTrabajado}
                      onChange={(e) => {
                        setEsDescansoTrabajado(e.target.checked);
                        setManualOverride(false);
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-medium">Es Día de Descanso Trabajado</span>
                  </label>
                </div>
              </div>

              {/* Row 2: Hora Inicio and Hora Fin with Quick Presets */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
                  <span>Horario Real de Entrada y Salida</span>
                  <span className="text-xs font-normal text-slate-500">
                    Soporta turnos que cruzan la medianoche (ej. 14:00 a 02:00)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Hora de Inicio
                    </label>
                    <input
                      type="time"
                      value={horaInicio}
                      onChange={(e) => {
                        setHoraInicio(e.target.value);
                        setManualOverride(false);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-lg font-bold text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Hora de Finalización
                    </label>
                    <input
                      type="time"
                      value={horaFin}
                      onChange={(e) => {
                        setHoraFin(e.target.value);
                        setManualOverride(false);
                      }}
                      className="w-full bg-white border border-gray-300 rounded-lg p-2 text-lg font-bold text-gray-800"
                    />
                  </div>

                  {/* Preset quick buttons */}
                  <div className="sm:col-span-2 flex flex-wrap gap-2 pt-4 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => {
                        setHoraInicio('06:00');
                        setHoraFin('14:00');
                        setManualOverride(false);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-white border border-gray-300 rounded hover:bg-gray-100"
                    >
                      Turno Día (06:00–14:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHoraInicio('14:00');
                        setHoraFin('22:00');
                        setManualOverride(false);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-white border border-gray-300 rounded hover:bg-gray-100"
                    >
                      Turno Noche (14:00–22:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHoraInicio('06:00');
                        setHoraFin('16:00');
                        setManualOverride(false);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
                    >
                      Día + 2h Extra (06–16:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHoraInicio('14:00');
                        setHoraFin('23:00');
                        setManualOverride(false);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100"
                    >
                      Noche + 1h Extra (14–23:00)
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Live Automatic Breakdown Card */}
              <div className="bg-blue-50/70 border-2 border-blue-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-blue-950 text-base">
                      Desglose Automático Calculado
                    </span>
                    <span className="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-semibold">
                      Total: {totalHorasCalculadas} horas
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!manualOverride) {
                        setCustomOrdinarias(calculatedBreakdown.ordinarias);
                        setCustomExtraDiurna(calculatedBreakdown.extraDiurna);
                        setCustomExtraNocturna(calculatedBreakdown.extraNocturna);
                        setCustomExtraDominical(calculatedBreakdown.extraDominical);
                      }
                      setManualOverride(!manualOverride);
                    }}
                    className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline"
                  >
                    {manualOverride ? 'Volver a cálculo automático' : 'Ajustar valores manualmente'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Ordinarias */}
                  <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                    <div className="text-xs font-medium text-gray-500">Horas Ordinarias</div>
                    {manualOverride ? (
                      <input
                        type="number"
                        step="0.1"
                        value={customOrdinarias}
                        onChange={(e) => setCustomOrdinarias(Number(e.target.value))}
                        className="w-full border rounded p-1 text-lg font-bold text-gray-800 mt-1"
                      />
                    ) : (
                      <div className="text-2xl font-black text-gray-800 mt-1">
                        {calculatedBreakdown.ordinarias} <span className="text-xs font-normal text-gray-500">h</span>
                      </div>
                    )}
                    <div className="text-[11px] text-gray-400 mt-1">Base jornada ordinaria (hasta 8h)</div>
                  </div>

                  {/* Extra Diurna */}
                  <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-sm bg-gradient-to-b from-white to-amber-50/30">
                    <div className="text-xs font-medium text-amber-800">Horas Extra Diurnas</div>
                    {manualOverride ? (
                      <input
                        type="number"
                        step="0.1"
                        value={customExtraDiurna}
                        onChange={(e) => setCustomExtraDiurna(Number(e.target.value))}
                        className="w-full border rounded p-1 text-lg font-bold text-amber-900 mt-1"
                      />
                    ) : (
                      <div className="text-2xl font-black text-amber-700 mt-1">
                        {calculatedBreakdown.extraDiurna} <span className="text-xs font-normal text-gray-500">h</span>
                      </div>
                    )}
                    <div className="text-[11px] text-amber-600 mt-1">Diurno: 06:00 a 21:00 (+{config.extraDiurnaPorc}%)</div>
                  </div>

                  {/* Extra Nocturna */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-200 shadow-sm bg-gradient-to-b from-white to-indigo-50/30">
                    <div className="text-xs font-medium text-indigo-800">Horas Extra Nocturnas</div>
                    {manualOverride ? (
                      <input
                        type="number"
                        step="0.1"
                        value={customExtraNocturna}
                        onChange={(e) => setCustomExtraNocturna(Number(e.target.value))}
                        className="w-full border rounded p-1 text-lg font-bold text-indigo-900 mt-1"
                      />
                    ) : (
                      <div className="text-2xl font-black text-indigo-700 mt-1">
                        {calculatedBreakdown.extraNocturna} <span className="text-xs font-normal text-gray-500">h</span>
                      </div>
                    )}
                    <div className="text-[11px] text-indigo-600 mt-1">Nocturno: 21:00 a 06:00 (+{config.extraNocturnaPorc}%)</div>
                  </div>

                  {/* Extra Dominical / Festiva */}
                  <div className="bg-white p-3 rounded-lg border border-purple-200 shadow-sm bg-gradient-to-b from-white to-purple-50/30">
                    <div className="text-xs font-medium text-purple-800">Extra Dom. / Festiva</div>
                    {manualOverride ? (
                      <input
                        type="number"
                        step="0.1"
                        value={customExtraDominical}
                        onChange={(e) => setCustomExtraDominical(Number(e.target.value))}
                        className="w-full border rounded p-1 text-lg font-bold text-purple-900 mt-1"
                      />
                    ) : (
                      <div className="text-2xl font-black text-purple-700 mt-1">
                        {calculatedBreakdown.extraDominical} <span className="text-xs font-normal text-gray-500">h</span>
                      </div>
                    )}
                    <div className="text-[11px] text-purple-600 mt-1">Domingos y Festivos (+{config.extraDominicalPorc}%)</div>
                  </div>
                </div>

                {/* Warning alerts for legal limits */}
                {(isDailyOverLimit || isWeeklyOverLimit) && (
                  <div className="mt-3 bg-amber-100 border border-amber-300 text-amber-900 px-3 py-2 rounded-lg text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      {isDailyOverLimit && (
                        <div>
                          <strong>Alerta diaria:</strong> Este registro suma {totalHorasExtras}h extras en el día, superando el tope legal de {config.topeHorasExtraDiarias}h diarias.
                        </div>
                      )}
                      {isWeeklyOverLimit && (
                        <div>
                          <strong>Alerta semanal:</strong> El operario acumulará {(currentOperarioWeeklyOT + totalHorasExtras).toFixed(1)}h extras en la semana (tope: {config.topeHorasExtraSemanales}h).
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Row 4: Observaciones & Submit */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Observaciones / Motivo de Tiempo Extra (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Apoyo en excavación tramo norte, relevo extendido..."
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    Guardar Registro
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Table of Saved Records */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Registros Guardados en la Nube</h2>
                <p className="text-xs text-gray-500">
                  Total de registros: {extraDays.length} | Sincronizado en tiempo real con Firestore
                </p>
              </div>

              <div className="text-xs text-gray-500">
                Tope legal: <span className="font-semibold text-gray-700">2h/día</span> y <span className="font-semibold text-gray-700">12h/semana</span>
              </div>
            </div>

            {extraDays.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>No hay registros de horas ingresados aún.</p>
                <p className="text-xs text-gray-400 mt-1">Utiliza el formulario superior para registrar la primera jornada.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-gray-700">
                      <th className="text-left p-2.5 font-semibold">Fecha</th>
                      <th className="text-left p-2.5 font-semibold">Operario</th>
                      <th className="text-left p-2.5 font-semibold">Horario Real</th>
                      <th className="text-left p-2.5 font-semibold">Turno / Máquina</th>
                      <th className="text-center p-2.5 font-semibold bg-gray-100/70">Ord.</th>
                      <th className="text-center p-2.5 font-semibold bg-amber-50 text-amber-900">Ext. Diurna</th>
                      <th className="text-center p-2.5 font-semibold bg-indigo-50 text-indigo-900">Ext. Nocturna</th>
                      <th className="text-center p-2.5 font-semibold bg-purple-50 text-purple-900">Ext. Dom/Fest</th>
                      <th className="text-center p-2.5 font-semibold">Total</th>
                      <th className="text-center p-2.5 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {extraDays
                      .slice()
                      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                      .map((ed) => {
                        const op = operarios.find((o) => o.id === ed.operarioId);
                        const totalEd = (ed.ordinarias || 0) + (ed.extraDiurna || 0) + (ed.extraNocturna || 0) + (ed.extraDominical || 0);
                        return (
                          <tr key={ed.id} className="hover:bg-gray-50 transition">
                            <td className="p-2.5 font-medium whitespace-nowrap text-gray-800">
                              {ed.fecha}
                            </td>
                            <td className="p-2.5 font-bold text-gray-900 whitespace-nowrap">
                              {op?.nombre || 'Operario'}
                            </td>
                            <td className="p-2.5 text-xs text-gray-600 whitespace-nowrap">
                              {ed.horaInicio && ed.horaFin ? (
                                <span className="bg-gray-100 px-2 py-0.5 rounded font-mono font-medium">
                                  {ed.horaInicio} – {ed.horaFin}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-2.5 text-xs text-gray-600 whitespace-nowrap">
                              {ed.turnoProgramado || '-'}
                            </td>
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                step="0.1"
                                className="w-16 text-center border rounded p-1 text-xs font-semibold"
                                value={ed.ordinarias}
                                onChange={(e) => handleUpdateRecordField(ed.id, 'ordinarias', Number(e.target.value))}
                              />
                            </td>
                            <td className="p-2.5 text-center bg-amber-50/40">
                              <input
                                type="number"
                                step="0.1"
                                className="w-16 text-center border border-amber-300 rounded p-1 text-xs font-bold text-amber-800"
                                value={ed.extraDiurna}
                                onChange={(e) => handleUpdateRecordField(ed.id, 'extraDiurna', Number(e.target.value))}
                              />
                            </td>
                            <td className="p-2.5 text-center bg-indigo-50/40">
                              <input
                                type="number"
                                step="0.1"
                                className="w-16 text-center border border-indigo-300 rounded p-1 text-xs font-bold text-indigo-800"
                                value={ed.extraNocturna}
                                onChange={(e) => handleUpdateRecordField(ed.id, 'extraNocturna', Number(e.target.value))}
                              />
                            </td>
                            <td className="p-2.5 text-center bg-purple-50/40">
                              <input
                                type="number"
                                step="0.1"
                                className="w-16 text-center border border-purple-300 rounded p-1 text-xs font-bold text-purple-800"
                                value={ed.extraDominical}
                                onChange={(e) => handleUpdateRecordField(ed.id, 'extraDominical', Number(e.target.value))}
                              />
                            </td>
                            <td className="p-2.5 text-center font-bold text-gray-800 text-xs">
                              {totalEd.toFixed(1)}h
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => handleDelete(ed.id)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition"
                                title="Eliminar registro"
                              >
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
        </div>
      )}

      {/* VIEW 2: PROGRAMACIÓN SEMANAL (Matches the uploaded reference image) */}
      {activeTab === 'programacion' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header Banner matching the user image */}
          <div className="bg-[#1b3d2b] text-white text-center py-3 px-4">
            <h2 className="text-base sm:text-lg font-bold tracking-wide">
              Turnos integrados por operario (Turno Día / Turno Noche / Disponibilidad 22:00–06:00)
            </h2>
            <p className="text-xs text-emerald-100 mt-1 font-normal">
              TURNO DÍA 06:00–14:00 (2 operarios/2 máquinas) · TURNO NOCHE 14:00–22:00 (1 operario/2 máquinas) · DISPONIBILIDAD 22:00–06:00 (1 primario + 1 respaldo, rota junto con el turno noche) · relevo en sitio a las 14:00
            </p>
          </div>

          {/* Week Selector Controls */}
          <div className="p-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeWeek(-1)}
                className="p-1.5 rounded-lg border bg-white hover:bg-gray-100 text-gray-700"
                title="Semana anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-sm text-gray-800">
                Semana: {weekSchedule.days[0].formatted} al {weekSchedule.days[6].formatted}
              </span>
              <button
                onClick={() => changeWeek(1)}
                className="p-1.5 rounded-lg border bg-white hover:bg-gray-100 text-gray-700"
                title="Semana siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <button
              onClick={() => setScheduleWeekSunday(getSundayOfWeek(todayStr))}
              className="px-3 py-1 text-xs font-semibold bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
            >
              Semana Actual
            </button>
          </div>

          {/* Schedule Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#e29e4b] text-[#2c1d09]">
                  <th className="border border-amber-700/30 p-2.5 font-bold uppercase text-center w-36">
                    OPERARIO
                  </th>
                  {weekSchedule.days.map((day) => (
                    <th
                      key={day.dateStr}
                      className="border border-amber-700/30 p-2.5 font-bold text-center capitalize"
                    >
                      {day.formatted}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekSchedule.rows.map((row) => (
                  <React.Fragment key={row.operario.id}>
                    {/* Shift Row */}
                    <tr className="border-b">
                      <td className="border border-gray-300 p-2.5 font-bold text-gray-900 bg-[#2b4c3b] text-white text-center">
                        {row.operario.nombre}
                      </td>
                      {row.shifts.map((shift, idx) => {
                        const isDescanso = shift.turno === 'Descanso';
                        const isNoche = shift.turno === 'Turno Noche';
                        const isDia = shift.turno === 'Turno Día';

                        let cellBg = 'bg-white';
                        let textColor = 'text-gray-900';

                        if (isDescanso) {
                          cellBg = 'bg-[#fafa00]'; // Yellow from image
                          textColor = 'text-black font-bold';
                        } else if (isNoche) {
                          cellBg = 'bg-[#3b5948]'; // Dark green from image
                          textColor = 'text-white';
                        }

                        return (
                          <td
                            key={idx}
                            className={`border border-gray-300 p-2 text-center align-middle ${cellBg} ${textColor}`}
                          >
                            {isDescanso ? (
                              <div className="font-black tracking-wide">DESCANSO</div>
                            ) : (
                              <div>
                                <div className="font-bold uppercase tracking-tight">{shift.turno}</div>
                                <div className="text-[11px] opacity-90">{shift.horario}</div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Machine Row */}
                    <tr className="border-b bg-gray-50">
                      <td className="border border-gray-300 p-1.5 font-bold text-center bg-[#2b4c3b] text-white/90 text-[11px]">
                        Maquina
                      </td>
                      {row.shifts.map((shift, idx) => {
                        const isDescanso = shift.turno === 'Descanso';
                        const isNoche = shift.turno === 'Turno Noche';
                        let cellBg = isDescanso ? 'bg-[#fafa00]' : isNoche ? 'bg-[#3b5948] text-white' : 'bg-white text-gray-800';
                        return (
                          <td
                            key={idx}
                            className={`border border-gray-300 p-1.5 text-center font-bold text-[11px] ${cellBg}`}
                          >
                            {isDescanso ? '' : shift.maquina || 'MIXTO'}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-50 border-t text-xs text-gray-600 flex flex-col sm:flex-row justify-between gap-2">
            <div>
              <strong>Rotación Semanal Automática:</strong> Cada semana los tres patrones rotan cíclicamente entre Wilson Moreno, Orlando Vargas y Fidel Castro.
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#fafa00] border inline-block"></span> Descanso
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-white border inline-block"></span> Turno Día (06:00–14:00)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#3b5948] border inline-block"></span> Turno Noche (14:00–22:00)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: LIQUIDACIÓN Y ESTADÍSTICAS */}
      {activeTab === 'liquidacion' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liquidation Table */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Liquidación Estimada de Horas Extra</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-700">
                    <th className="text-left p-3 font-semibold">Operario</th>
                    <th className="text-center p-3 font-semibold">Total Horas Extra</th>
                    <th className="text-right p-3 font-semibold">Liquidación Estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {operarios.map((op) => {
                    const totalOT = getWeeklyOT(op.id);
                    const liq = calculateLiquidacion(op.id);
                    return (
                      <tr key={op.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-gray-900">{op.nombre}</td>
                        <td className="p-3 text-center font-medium text-gray-700">{totalOT.toFixed(1)} h</td>
                        <td className="p-3 text-right font-black text-green-700 text-base">
                          ${liq.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
              <p>• Base de cálculo: Salario base mensual / 168 horas.</p>
              <p>• Recargos: Extra Diurna (+{config.extraDiurnaPorc}%), Extra Nocturna (+{config.extraNocturnaPorc}%), Extra Dom/Fest (+{config.extraDominicalPorc}%).</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Comparativa de Horas Extra por Operario</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={operarios.map((op) => ({ name: op.nombre, horas: getWeeklyOT(op.id) }))}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="horas" fill="#3b82f6" name="Total Horas Extra (h)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overtime;
