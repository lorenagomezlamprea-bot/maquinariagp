import React, { useState, useEffect, useMemo } from 'react';
import { Operario, RegistroExtra, RegistroResto, Configuración } from '../types';
import {
  Trash2,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  ShieldCheck,
  User,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { saveExtraDayDoc, deleteExtraDayDoc } from '../lib/data';
import { getProgramacionOperario, getWeekScheduleMatrix, getSundayOfWeek, ShiftInfo } from '../lib/schedule';
import { calcularDesgloseHoras, DesgloseHorasResult } from '../lib/calculator';

interface Props {
  operarios: Operario[];
  extraDays: RegistroExtra[];
  restDays?: RegistroResto[];
  setExtraDays?: (data: RegistroExtra[]) => void;
  config: Configuración;
}

const Overtime: React.FC<Props> = ({ operarios, extraDays, restDays = [], config }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  const [selectedOperarioId, setSelectedOperarioId] = useState<string>(operarios[0]?.id || '1');
  const [selectedFecha, setSelectedFecha] = useState<string>(todayStr);
  const [tipoDia, setTipoDia] = useState<'Descanso entre semana' | 'Domingo programado'>('Descanso entre semana');
  const [horaInicio, setHoraInicio] = useState<string>('06:00');
  const [horaFin, setHoraFin] = useState<string>('14:00');
  const [esFestivoManual, setEsFestivoManual] = useState<boolean>(false);
  const [esDescansoTrabajado, setEsDescansoTrabajado] = useState<boolean>(false);
  const [autorizacionGestionHumana, setAutorizacionGestionHumana] = useState<boolean>(false);
  const [observaciones, setObservaciones] = useState<string>('');

  // Manual overrides if user tweaks calculated numbers
  const [manualOverride, setManualOverride] = useState(false);
  const [customOrdinarias, setCustomOrdinarias] = useState<number>(0);
  const [customExtraDiurna, setCustomExtraDiurna] = useState<number>(0);
  const [customExtraNocturna, setCustomExtraNocturna] = useState<number>(0);
  const [customExtraDominical, setCustomExtraDominical] = useState<number>(0);

  // Tabs & Views
  const [activeTab, setActiveTab] = useState<'registro' | 'programacion' | 'liquidacion'>('registro');
  const [scheduleWeekSunday, setScheduleWeekSunday] = useState<string>(getSundayOfWeek(todayStr));

  // Historical Month Filter for Liquidation & Statistics
  const [historyMonth, setHistoryMonth] = useState<string>(currentMonthStr);

  // Modal for 5th day blocking
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [pendingSubmit, setPendingSubmit] = useState<boolean>(false);

  // Helper to count worked rest days in a given month without double counting
  const getMonthlyRestDaysCount = (operarioId: string, monthStr: string, excludeRecordId?: string) => {
    const dates = new Set<string>();

    restDays.forEach((rd) => {
      if (excludeRecordId && rd.id === excludeRecordId) return;
      if (rd.operarioId === operarioId && rd.fecha.startsWith(monthStr) && rd.trabajo) {
        dates.add(rd.fecha);
      }
    });

    extraDays.forEach((ed) => {
      if (excludeRecordId && ed.id === excludeRecordId) return;
      if (ed.operarioId === operarioId && ed.fecha.startsWith(monthStr) && ed.esDescansoTrabajado) {
        dates.add(ed.fecha);
      }
    });

    return dates.size;
  };

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
      setTipoDia(shiftInfo.esDomingo ? 'Domingo programado' : 'Descanso entre semana');
    }
  }, [selectedOperarioId, selectedFecha, shiftInfo]);

  // Rest day counter for the selected operario & month of selected date
  const selectedMonthOfDate = selectedFecha.slice(0, 7);
  const currentOperarioRestCount = useMemo(() => {
    return getMonthlyRestDaysCount(selectedOperarioId, selectedMonthOfDate);
  }, [selectedOperarioId, selectedMonthOfDate, restDays, extraDays]);

  // Forecast count if this record is saved as worked rest day
  const willBeRestDayCount = esDescansoTrabajado
    ? currentOperarioRestCount + 1
    : currentOperarioRestCount;

  const isExceedingMonthlyLimit = esDescansoTrabajado && willBeRestDayCount > config.topeDiasDescanso;

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
      .filter((ed) => {
        if (ed.operarioId !== selectedOperarioId) return false;
        const edTime = new Date(ed.fecha).getTime();
        return edTime >= sundayTime && edTime <= saturdayTime;
      })
      .reduce((sum, ed) => sum + ed.extraDiurna + ed.extraNocturna + ed.extraDominical, 0);
  }, [extraDays, selectedOperarioId, selectedFecha]);

  const isWeeklyOverLimit = currentOperarioWeeklyOT + totalHorasExtras > config.topeHorasExtraSemanales;

  const executeSave = async (overrideAuth = false) => {
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
      esDescansoTrabajado,
      tipoDia,
      autorizacionGestionHumana: overrideAuth || autorizacionGestionHumana,
      observaciones: observaciones.trim(),
    };

    try {
      await saveExtraDayDoc(newRecord);
      setManualOverride(false);
      setObservaciones('');
      setAutorizacionGestionHumana(false);
      setShowAuthModal(false);
    } catch (err) {
      console.error('Error guardando en Gestión del Talento:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Block if 5th day or more without explicit authorization
    if (isExceedingMonthlyLimit && !autorizacionGestionHumana) {
      setShowAuthModal(true);
      return;
    }

    await executeSave();
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Desea eliminar este registro de jornada? Esta acción actualizará los descansos trabajados y las horas extras asociadas.')) {
      try {
        await deleteExtraDayDoc(id);
      } catch (err) {
        console.error('Error eliminando registro:', err);
      }
    }
  };

  const handleUpdateRecordField = async (id: string, field: keyof RegistroExtra, value: any) => {
    const target = extraDays.find((ed) => ed.id === id);
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

  const getFilteredPeriodOT = (operarioId: string, monthStr: string) => {
    return extraDays
      .filter((ed) => ed.operarioId === operarioId && ed.fecha.startsWith(monthStr))
      .reduce((sum, ed) => sum + (ed.extraDiurna || 0) + (ed.extraNocturna || 0) + (ed.extraDominical || 0), 0);
  };

  const calculateLiquidacionMonth = (operarioId: string, monthStr: string) => {
    const records = extraDays.filter((ed) => ed.operarioId === operarioId && ed.fecha.startsWith(monthStr));
    const baseHourlyRate = (config.salariosBase[operarioId] || 2000000) / 168; // 168h base mensual
    return records.reduce((sum, ed) => {
      return (
        sum +
        (ed.extraDiurna || 0) * baseHourlyRate * (1 + config.extraDiurnaPorc / 100) +
        (ed.extraNocturna || 0) * baseHourlyRate * (1 + config.extraNocturnaPorc / 100) +
        (ed.extraDominical || 0) * baseHourlyRate * (1 + config.extraDominicalPorc / 100)
      );
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

  // Historical records for the selected month in "Liquidación y Estadísticas"
  const historyRecords = useMemo(() => {
    // Collect all records for this month
    const extraList = extraDays.filter((ed) => ed.fecha.startsWith(historyMonth));
    return extraList.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [extraDays, historyMonth]);

  const historyRestDays = useMemo(() => {
    const combined: Array<{
      id: string;
      operarioId: string;
      fecha: string;
      tipoDia: string;
      horas: number;
      autorizado?: boolean;
      observaciones?: string;
    }> = [];

    const seenKeys = new Set<string>();

    extraDays.forEach((ed) => {
      if (ed.fecha.startsWith(historyMonth) && ed.esDescansoTrabajado) {
        const key = `${ed.operarioId}_${ed.fecha}`;
        seenKeys.add(key);
        combined.push({
          id: ed.id,
          operarioId: ed.operarioId,
          fecha: ed.fecha,
          tipoDia: ed.tipoDia || 'Descanso entre semana',
          horas: ed.totalHoras || (ed.ordinarias + ed.extraDiurna + ed.extraNocturna + ed.extraDominical) || 8,
          autorizado: ed.autorizacionGestionHumana,
          observaciones: ed.observaciones,
        });
      }
    });

    restDays.forEach((rd) => {
      if (rd.fecha.startsWith(historyMonth) && rd.trabajo) {
        const key = `${rd.operarioId}_${rd.fecha}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          combined.push({
            id: rd.id,
            operarioId: rd.operarioId,
            fecha: rd.fecha,
            tipoDia: rd.tipoDia,
            horas: rd.horas,
          });
        }
      }
    });

    return combined.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [extraDays, restDays, historyMonth]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Subtabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <User className="w-7 h-7 text-blue-700" />
            Gestión del Talento
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Control integral de jornadas laborales, rotación semanal 24/7, días de descanso y cálculo legal de horas extra.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            id="tab-registro-calculo"
            onClick={() => setActiveTab('registro')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
              activeTab === 'registro' ? 'bg-white shadow text-blue-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Registro y Cálculo
          </button>
          <button
            id="tab-programacion-semanal"
            onClick={() => setActiveTab('programacion')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'programacion' ? 'bg-white shadow text-blue-700 font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Calendar size={15} />
            Programación Semanal
          </button>
          <button
            id="tab-liquidacion-estadisticas"
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
          {/* Top 3 Summary Cards for Operarios (Fidel, Orlando, Wilson) with X/4 rest days tracking */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {operarios.map((op) => {
              const count = getMonthlyRestDaysCount(op.id, selectedMonthOfDate);
              const isSelected = op.id === selectedOperarioId;

              let alertBg = 'bg-green-50/80 border-green-300 text-green-900';
              let badgeBg = 'bg-green-100 text-green-800';
              let alertText = '0–1 días: Ritmo óptimo';
              let progressColor = 'bg-green-600';

              if (count === 2) {
                alertBg = 'bg-yellow-50/80 border-yellow-300 text-yellow-900';
                badgeBg = 'bg-yellow-100 text-yellow-800 font-bold';
                alertText = '2 de 4 descansos trabajados';
                progressColor = 'bg-yellow-500';
              } else if (count === 3) {
                alertBg = 'bg-orange-50/80 border-orange-300 text-orange-900';
                badgeBg = 'bg-orange-100 text-orange-800 font-bold';
                alertText = 'Atención: Le queda 1 día disponible';
                progressColor = 'bg-orange-500';
              } else if (count >= config.topeDiasDescanso) {
                alertBg = 'bg-red-50 border-red-300 text-red-900';
                badgeBg = 'bg-red-100 text-red-800 font-bold';
                alertText = 'Tope mensual alcanzado (Requiere autorización)';
                progressColor = 'bg-red-600';
              }

              return (
                <div
                  key={op.id}
                  onClick={() => setSelectedOperarioId(op.id)}
                  className={`cursor-pointer rounded-xl p-4 border-2 transition shadow-sm ${alertBg} ${
                    isSelected ? 'ring-2 ring-blue-600 shadow-md scale-[1.01]' : 'hover:shadow'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 text-base">{op.nombre}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${badgeBg}`}>
                      {count}/{config.topeDiasDescanso} días
                    </span>
                  </div>

                  <div className="mt-2 text-xs font-medium text-gray-600">
                    Descansos trabajados en el mes:
                  </div>

                  <div className="w-full bg-gray-200/80 h-2 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${progressColor}`}
                      style={{ width: `${Math.min(100, (count / config.topeDiasDescanso) * 100)}%` }}
                    ></div>
                  </div>

                  <div className="mt-2 text-[11px] font-medium leading-tight flex items-center gap-1">
                    {count >= 4 ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    ) : count === 3 ? (
                      <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    )}
                    <span>{alertText}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main Input Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-200" />
                  Registro de Jornada y Días de Descanso
                </h2>
                <p className="text-xs text-blue-100">
                  Calcula horas ordinarias, extras diurnas/nocturnas/dominicales y audita el tope mensual de descansos trabajados.
                </p>
              </div>

              {/* Scheduled Shift Badge */}
              <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 text-xs flex items-center gap-2">
                <span className="font-semibold text-blue-100">Turno Programado:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold ${
                    shiftInfo.turno === 'Turno Día'
                      ? 'bg-amber-400 text-amber-950'
                      : shiftInfo.turno === 'Turno Noche'
                      ? 'bg-indigo-900 text-indigo-100'
                      : 'bg-yellow-300 text-yellow-950'
                  }`}
                >
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
              {/* Row 1: Operario, Fecha, Tipo de Día */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Operario de Maquinaria
                  </label>
                  <select
                    id="select-operario"
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
                    id="input-fecha"
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Tipo de Día
                  </label>
                  <select
                    id="select-tipo-dia"
                    value={tipoDia}
                    onChange={(e) => setTipoDia(e.target.value as any)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  >
                    <option value="Descanso entre semana">Descanso entre semana</option>
                    <option value="Domingo programado">Domingo programado</option>
                  </select>
                  <div className="text-[11px] text-gray-400 mt-1">Clasificación para trazabilidad de descansos</div>
                </div>
              </div>

              {/* Row 2: Checkboxes for Rest Day & Festivo with Inline Rest Day Status Tracker */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer bg-white px-3 py-2 rounded-lg border shadow-sm hover:bg-gray-50 transition">
                    <input
                      id="checkbox-es-festivo"
                      type="checkbox"
                      checked={esFestivoManual}
                      onChange={(e) => {
                        setEsFestivoManual(e.target.checked);
                        setManualOverride(false);
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-semibold">Tratar como Día Festivo (+75% Dominical/Festiva)</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer bg-white px-3 py-2 rounded-lg border shadow-sm hover:bg-gray-50 transition">
                    <input
                      id="checkbox-es-descanso"
                      type="checkbox"
                      checked={esDescansoTrabajado}
                      onChange={(e) => {
                        setEsDescansoTrabajado(e.target.checked);
                        setManualOverride(false);
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="font-semibold text-blue-900">Es Día de Descanso Trabajado</span>
                  </label>
                </div>

                {/* Inline Rest Days Counter Indicator */}
                {esDescansoTrabajado && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition ${
                      willBeRestDayCount > 4
                        ? 'bg-red-100 border-red-300 text-red-950'
                        : willBeRestDayCount === 4
                        ? 'bg-orange-100 border-orange-300 text-orange-950'
                        : willBeRestDayCount === 3
                        ? 'bg-yellow-100 border-yellow-300 text-yellow-950'
                        : 'bg-green-100 border-green-300 text-green-950'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {willBeRestDayCount > 4 ? (
                        <ShieldAlert className="w-5 h-5 text-red-700 shrink-0" />
                      ) : willBeRestDayCount === 4 ? (
                        <AlertTriangle className="w-5 h-5 text-orange-700 shrink-0" />
                      ) : (
                        <Info className="w-5 h-5 text-blue-700 shrink-0" />
                      )}
                      <div>
                        <strong>Impacto en Días de Descanso del Mes:</strong> Con este registro, el operario acumulará{' '}
                        <span className="font-bold underline">{willBeRestDayCount} de 4</span> descansos trabajados en el mes (
                        {selectedMonthOfDate}).
                      </div>
                    </div>

                    <span className="font-bold px-2.5 py-1 rounded bg-white/70 text-xs shadow-sm">
                      {willBeRestDayCount > 4
                        ? 'Bloqueo: Requiere Autorización Especial'
                        : willBeRestDayCount === 4
                        ? 'Tope de 4 días alcanzado'
                        : `${4 - willBeRestDayCount} días restantes`}
                    </span>
                  </div>
                )}

                {/* Special Authorization Checkbox if 5th day */}
                {isExceedingMonthlyLimit && (
                  <div className="bg-red-50 border-2 border-red-400 p-4 rounded-xl text-red-950 space-y-2 animate-fadeIn">
                    <div className="font-bold flex items-center gap-2 text-sm text-red-800">
                      <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                      Autorización Especial Obligatoria de Gestión Humana
                    </div>
                    <p className="text-xs text-red-800 leading-relaxed">
                      El operario ya ha cubierto su tope legal de 4 días de descanso en el mes. Para poder guardar este 5º día (o superior),
                      debe confirmarse formalmente la autorización previa.
                    </p>
                    <label className="flex items-center gap-2 text-xs font-bold text-red-900 cursor-pointer pt-1">
                      <input
                        id="checkbox-autorizacion-gh"
                        type="checkbox"
                        checked={autorizacionGestionHumana}
                        onChange={(e) => setAutorizacionGestionHumana(e.target.checked)}
                        className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
                      />
                      <span>Confirmo y autorizo expresamente este registro bajo el aval de Gestión Humana.</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Row 3: Horarios Real de Entrada y Salida */}
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
                      id="input-hora-inicio"
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
                      id="input-hora-fin"
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

              {/* Row 4: Live Automatic Breakdown Card */}
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

              {/* Row 5: Observaciones & Submit */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Observaciones / Motivo de Tiempo Extra (Opcional)
                  </label>
                  <input
                    id="input-observaciones"
                    type="text"
                    placeholder="Ej. Apoyo en excavación tramo norte, relevo extendido..."
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  />
                </div>

                <div>
                  <button
                    id="btn-guardar-registro"
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
                <h2 className="text-lg font-bold text-gray-800">Registros Guardados en Gestión del Talento</h2>
                <p className="text-xs text-gray-500">
                  Total de registros: {extraDays.length} | Sincronización automática de descansos y horas extra en Firestore
                </p>
              </div>

              <div className="text-xs text-gray-500">
                Tope legal: <span className="font-semibold text-gray-700">4 descansos/mes</span> · <span className="font-semibold text-gray-700">2h/día</span> · <span className="font-semibold text-gray-700">12h/semana</span>
              </div>
            </div>

            {extraDays.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>No hay registros de jornadas ingresados aún.</p>
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
                      <th className="text-left p-2.5 font-semibold">Turno / Tipo</th>
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
                              <div className="space-y-0.5">
                                <div>{ed.turnoProgramado || '-'}</div>
                                {ed.esDescansoTrabajado && (
                                  <span className="inline-block bg-yellow-100 text-yellow-900 text-[10px] px-1.5 py-0.5 rounded font-bold border border-yellow-300">
                                    Descanso Trabajado {ed.autorizacionGestionHumana ? '· (Aut. GH)' : ''}
                                  </span>
                                )}
                              </div>
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

      {/* VIEW 2: PROGRAMACIÓN SEMANAL */}
      {activeTab === 'programacion' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header Banner */}
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

                        let cellBg = 'bg-white';
                        let textColor = 'text-gray-900';

                        if (isDescanso) {
                          cellBg = 'bg-[#fafa00]';
                          textColor = 'text-black font-bold';
                        } else if (isNoche) {
                          cellBg = 'bg-[#3b5948]';
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
                        Máquina
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

      {/* VIEW 3: LIQUIDACIÓN Y ESTADÍSTICAS (With historical month selector and complete audit logs) */}
      {activeTab === 'liquidacion' && (
        <div className="space-y-6">
          {/* Period Selector Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Período de Liquidación e Histórico</h2>
              <p className="text-xs text-gray-500">Seleccione el mes y año para auditar descansos y liquidar horas extras.</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-700">Mes a consultar:</label>
              <input
                id="input-history-month"
                type="month"
                value={historyMonth}
                onChange={(e) => setHistoryMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Días de Descanso Trabajados en el Período */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Auditoría Mensual de Días de Descanso ({historyMonth})
                </h3>
                <p className="text-xs text-gray-500">
                  Control de cumplimiento del tope de 4 días de descanso trabajados por operario.
                </p>
              </div>
            </div>

            {/* Operarios Status for this selected month */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {operarios.map((op) => {
                const count = getMonthlyRestDaysCount(op.id, historyMonth);
                const badge =
                  count >= 4
                    ? 'bg-red-100 text-red-800 border-red-300'
                    : count === 3
                    ? 'bg-orange-100 text-orange-800 border-orange-300'
                    : count === 2
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                    : 'bg-green-100 text-green-800 border-green-300';

                return (
                  <div key={op.id} className={`p-4 rounded-xl border-2 ${badge}`}>
                    <div className="flex justify-between items-center font-bold text-base">
                      <span>{op.nombre}</span>
                      <span className="text-sm px-2 py-0.5 rounded-full bg-white shadow-sm font-black">
                        {count}/4 días
                      </span>
                    </div>
                    <div className="w-full bg-white/70 h-2 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full"
                        style={{ width: `${Math.min(100, (count / 4) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] mt-2 font-medium">
                      {count >= 4
                        ? 'Tope alcanzado / Requiere autorización'
                        : `${4 - count} días disponibles este mes`}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Detailed Table of Worked Rest Days for this Month */}
            <div className="pt-2">
              <h4 className="text-sm font-bold text-gray-700 mb-2">Desglose de Días de Descanso Registrados:</h4>
              {historyRestDays.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg text-xs">
                  No hay descansos trabajados registrados para {historyMonth}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="text-left p-2.5 font-semibold">Fecha</th>
                        <th className="text-left p-2.5 font-semibold">Operario</th>
                        <th className="text-left p-2.5 font-semibold">Tipo de Día</th>
                        <th className="text-center p-2.5 font-semibold">Horas</th>
                        <th className="text-left p-2.5 font-semibold">Autorización GH</th>
                        <th className="text-left p-2.5 font-semibold">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historyRestDays.map((rd) => {
                        const op = operarios.find((o) => o.id === rd.operarioId);
                        return (
                          <tr key={rd.id} className="hover:bg-gray-50">
                            <td className="p-2.5 font-medium">{rd.fecha}</td>
                            <td className="p-2.5 font-bold text-gray-900">{op?.nombre}</td>
                            <td className="p-2.5">{rd.tipoDia}</td>
                            <td className="p-2.5 text-center font-bold">{rd.horas}h</td>
                            <td className="p-2.5">
                              {rd.autorizado ? (
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold">
                                  Autorizado
                                </span>
                              ) : (
                                <span className="text-gray-400">Ordinario</span>
                              )}
                            </td>
                            <td className="p-2.5 text-gray-600">{rd.observaciones || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Liquidación de Horas Extra y Gráfica */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liquidation Table */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Liquidación Estimada de Horas Extra ({historyMonth})
              </h2>
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
                      const totalOT = getFilteredPeriodOT(op.id, historyMonth);
                      const liq = calculateLiquidacionMonth(op.id, historyMonth);
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
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                Comparativa de Horas Extra por Operario ({historyMonth})
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={operarios.map((op) => ({
                      name: op.nombre,
                      horas: getFilteredPeriodOT(op.id, historyMonth),
                    }))}
                  >
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
        </div>
      )}

      {/* MODAL: Special Authorization for 5th Day Blocking */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-2 border-red-500 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <ShieldAlert className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">Alerta de Bloqueo Legal</h3>
                <span className="text-xs text-red-600 font-semibold">Tope de 4 días de descanso alcanzado</span>
              </div>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed">
              Este registro corresponde al <strong className="text-red-700">{willBeRestDayCount}º día de descanso trabajado</strong> para el operario en el mes. No está permitido superar el tope de 4 días salvo que exista autorización expresa de Gestión Humana.
            </p>

            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
              <label className="flex items-start gap-2.5 text-xs text-red-950 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={autorizacionGestionHumana}
                  onChange={(e) => setAutorizacionGestionHumana(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500 w-4 h-4 mt-0.5"
                />
                <span>Confirmo formalmente que cuento con la autorización especial de Gestión Humana para este registro extraordinario.</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!autorizacionGestionHumana}
                onClick={() => executeSave(true)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <CheckCircle2 size={16} />
                Confirmar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overtime;
