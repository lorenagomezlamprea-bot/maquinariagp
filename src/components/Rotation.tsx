import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';
import { Operario, TipoTurno, TipoDisponibilidad, DiaProgramacion, ProgramacionSemanal } from '../types';

interface Props {
  operarios: Operario[];
}

const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const getWeekDates = (fechaInicio: string) => {
    const start = new Date(fechaInicio + 'T00:00:00');
    return dias.map((d, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return `${d} ${date.getDate()} ${date.toLocaleDateString('es-ES', { month: 'long' })}`;
    });
};

const baseProgramacion: Record<string, Record<string, DiaProgramacion>> = {
  '1': { // Fidel Castro
    Lunes: { turno: 'Turno Noche', disponibilidad: 'Ninguna' },
    Martes: { turno: 'Turno Noche', disponibilidad: 'Ninguna' },
    Miércoles: { turno: 'Turno Día', disponibilidad: 'Primario' },
    Jueves: { turno: 'Turno Día', disponibilidad: 'Respaldo' },
    Viernes: { turno: 'Descanso', disponibilidad: 'Primario' },
    Sábado: { turno: 'Turno Día', disponibilidad: 'Respaldo' },
    Domingo: { turno: 'Turno Día', disponibilidad: 'Respaldo' },
  },
  '2': { // Orlando Vargas
    Lunes: { turno: 'Turno Día', disponibilidad: 'Primario' },
    Martes: { turno: 'Turno Día', disponibilidad: 'Respaldo' },
    Miércoles: { turno: 'Turno Noche', disponibilidad: 'Ninguna' },
    Jueves: { turno: 'Turno Noche', disponibilidad: 'Ninguna' },
    Viernes: { turno: 'Turno Día', disponibilidad: 'Ninguna' },
    Sábado: { turno: 'Turno Día', disponibilidad: 'Primario' },
    Domingo: { turno: 'Descanso', disponibilidad: 'Primario' },
  },
  '3': { // Wilson Moreno
    Lunes: { turno: 'Turno Día', disponibilidad: 'Respaldo' },
    Martes: { turno: 'Turno Día', disponibilidad: 'Primario' },
    Miércoles: { turno: 'Turno Día', disponibilidad: 'Respaldo' },
    Jueves: { turno: 'Descanso', disponibilidad: 'Primario' },
    Viernes: { turno: 'Turno Noche', disponibilidad: 'Respaldo' },
    Sábado: { turno: 'Turno Noche', disponibilidad: 'Ninguna' },
    Domingo: { turno: 'Turno Día', disponibilidad: 'Ninguna' },
  }
};

const Rotation: React.FC<Props> = ({ operarios }) => {
  const [current, setCurrent] = useState<ProgramacionSemanal | null>(null);
  const [history, setHistory] = useState<ProgramacionSemanal[]>([]);
  const weekDates = current ? getWeekDates(current.fechaInicio) : dias.map(d => `${d} (Sin fecha)`);

  useEffect(() => {
    const saved = localStorage.getItem('programacion');
    if (saved) {
      setCurrent(JSON.parse(saved));
    } else {
      const initial: ProgramacionSemanal = {
        id: 'base',
        fechaInicio: '2026-08-31',
        rotacion: baseProgramacion
      };
      setCurrent(initial);
      localStorage.setItem('programacion', JSON.stringify(initial));
    }
    const savedHist = localStorage.getItem('progHistory');
    if (savedHist) setHistory(JSON.parse(savedHist));
  }, []);

  const save = (prog: ProgramacionSemanal) => {
    setCurrent(prog);
    localStorage.setItem('programacion', JSON.stringify(prog));
  };

  const calculateCargaNocturna = (rotacion: Record<string, Record<string, DiaProgramacion>>) => {
    const carga: Record<string, number> = {};
    Object.keys(rotacion).forEach(opId => {
      let count = 0;
      Object.values(rotacion[opId]).forEach(dia => {
        if (dia.turno === 'Turno Noche') count++;
        if (dia.disponibilidad !== 'Ninguna') count++;
      });
      carga[opId] = count;
    });
    return carga;
  };

  const generateNext = () => {
    if (!confirm('¿Deseas sobreescribir la programación actual? Esta acción no se puede deshacer')) return;
    if (!current) {
        console.error("No hay programación actual cargada.");
        return;
    }

    // 1. Calculate cargaAnterior
    const cargaAnterior = calculateCargaNocturna(current.rotacion);
    
    // 2. Sort operarios by workload (Low to High)
    const sortedOps = [...operarios].sort((a, b) => (cargaAnterior[a.id] || 0) - (cargaAnterior[b.id] || 0));
    
    // 3. Define new patterns based on workload
    const oldPatterns = current.rotacion;
    const newRotacion: Record<string, Record<string, DiaProgramacion>> = {};
    
    // Mapping: Dynamic assignment based on workload
    const patternAssignment: Record<string, string> = {};
    const n = sortedOps.length;
    for (let i = 0; i < n; i++) {
        // Assign in reverse order (lowest load gets highest load pattern)
        patternAssignment[sortedOps[i].id] = sortedOps[n - 1 - i].id;
    }

    // 4. Build newRotacion and rotate rest days
    operarios.forEach(op => {
        const sourceOpId = patternAssignment[op.id];
        const oldPattern = oldPatterns[sourceOpId];
        const newPattern: Record<string, DiaProgramacion> = {};
        
        // Find old rest day
        const oldRestDay = dias.find(d => oldPattern[d].turno === 'Descanso') || 'Lunes';
        
        // New rest day (simple rotation: move to next day)
        const oldRestIndex = dias.indexOf(oldRestDay);
        const newRestDay = dias[(oldRestIndex + 1) % 7];
        
        dias.forEach(d => {
            if (d === newRestDay) {
                newPattern[d] = { turno: 'Descanso', disponibilidad: 'Ninguna' };
            } else {
                newPattern[d] = { ...oldPattern[d] };
            }
        });
        
        newRotacion[op.id] = newPattern;
    });

    // 6. Calculate new workload (now that it's built)
    const newCarga = calculateCargaNocturna(newRotacion);

    const newProg: ProgramacionSemanal = {
        id: Date.now().toString(),
        fechaInicio: new Date(new Date(current.fechaInicio).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        rotacion: newRotacion,
        cargaNocturna: newCarga
    };
    
    const newHistory = [newProg, ...history].slice(0, 4);
    setHistory(newHistory);
    localStorage.setItem('progHistory', JSON.stringify(newHistory));
    
    save(newProg);
  };

  const exportExcel = () => {
    if (!current) return;
    
    // 1. Prepare dynamic data
    const carga = current.cargaNocturna || calculateCargaNocturna(current.rotacion);
    const wb = XLSXStyle.utils.book_new();
    const ws: any = {};

    // Styles
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "006400" } }, alignment: { horizontal: "center", wrapText: true } };
    const baseCell = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
    const shiftStyle = (color: string) => ({ ...baseCell, fill: { fgColor: { rgb: color } } });
    
    const addCell = (r: number, c: number, v: any, style: any) => {
        ws[XLSXStyle.utils.encode_cell({ c, r })] = { v: v, t: typeof v === 'number' ? 'n' : 's', s: style };
    };

    // 2. Build Sheet
    // Title & Subtitle
    ws["!merges"] = [
        { s: { c: 0, r: 0 }, e: { c: 7, r: 0 } },
        { s: { c: 0, r: 1 }, e: { c: 7, r: 1 } }
    ];
    addCell(0, 0, "PROGRAMACIÓN SEMANAL DE OPERARIOS", headerStyle);
    addCell(1, 0, "TURNO DÍA 06:00–14:00 (2 op/2 máq) · TURNO NOCHE 14:00–22:00 (1 op/2 máq) · DISP. 22:00–06:00 (rotativo) · relevo 14:00", { ...headerStyle, font: { bold: false } });

    // Columns & Headings (with dates)
    ws['!cols'] = [{ wch: 20 }, ...Array(7).fill({ wch: 20 })];
    const colHeadings = ["OPERARIO", ...weekDates];
    colHeadings.forEach((h, i) => addCell(2, i, h, headerStyle));

    // Data rows
    let row = 3;
    operarios.forEach(op => {
        addCell(row, 0, op.nombre, baseCell);
        addCell(row + 1, 0, "", baseCell);
        ws["!merges"].push({ s: { c: 0, r: row }, e: { c: 0, r: row + 1 } });
        
        dias.forEach((d, i) => {
            const prog = current.rotacion[op.id]?.[d];
            const color = prog?.turno === 'Turno Día' ? 'ADD8E6' : prog?.turno === 'Turno Noche' ? 'D8BFD8' : 'D3D3D3';
            
            const turnoText = prog?.turno === 'Descanso' ? 'DESCANSO' : `${prog?.turno.toUpperCase()}\n06:00–14:00 (7 h)`;
            addCell(row, i + 1, turnoText, shiftStyle(color));
            addCell(row + 1, i + 1, prog?.disponibilidad !== 'Ninguna' ? `DISP.: ${prog?.disponibilidad.toUpperCase()}` : '-', shiftStyle(color));
        });
        row += 2;
    });

    // 4. Sections
    row += 1;
    addCell(row, 0, "COBERTURA MÁQUINAS / DISPONIBILIDAD", headerStyle);
    ws["!merges"].push({ s: { c: 0, r: row }, e: { c: 7, r: row } });
    row += 1;
    addCell(row, 0, "Día 2 op./Noche 1 op. 1 primario+1 respaldo (semana) / Solo turno día ampliado (noche: mantenimiento) (domingo)", baseCell);
    ws["!merges"].push({ s: { c: 0, r: row }, e: { c: 7, r: row } });

    row += 2;
    addCell(row, 0, "CONVENCIONES", headerStyle);
    ws["!merges"].push({ s: { c: 0, r: row }, e: { c: 7, r: row } });
    row += 1;
    const conv = [
        { c: 'ADD8E6', t: 'Turno Día' }, { c: 'D8BFD8', t: 'Turno Noche' },
        { c: 'D3D3D3', t: 'Descanso' }, { c: 'FFCC99', t: 'Disp. Primario' },
        { c: 'CCFFFF', t: 'Disp. Respaldo' }
    ];
    conv.forEach((item, i) => {
        addCell(row, i, item.t, shiftStyle(item.c));
    });

    row += 2;
    addCell(row, 0, "NOTAS DE LA INTEGRACIÓN", headerStyle);
    ws["!merges"].push({ s: { c: 0, r: row }, e: { c: 7, r: row } });
    row += 1;
    const notes = ["Se integran turnos día/noche y disponibilidad.", "Rotación 2 días para carga nocturna equitativa.", "42 h ordinarias + descanso escalonado.", "Cobertura extra en descanso de operarios.", "Protocolo estricto de disponibilidad."];
    notes.forEach((note, i) => {
        addCell(row + i, 0, `• ${note}`, { ...baseCell, alignment: { horizontal: 'left', wrapText: true } });
        ws["!merges"].push({ s: { c: 0, r: row + i }, e: { c: 7, r: row + i } });
    });
    row += notes.length;

    // Finalize
    ws["!ref"] = XLSXStyle.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 7, r: row } });
    XLSXStyle.utils.book_append_sheet(wb, ws, "Programacion");
    XLSXStyle.writeFile(wb, `Programacion_${current.fechaInicio}.xlsx`);
  };

  const getCellColor = (turno: TipoTurno) => {
    switch (turno) {
      case 'Turno Día': return 'bg-blue-100';
      case 'Turno Noche': return 'bg-purple-100';
      case 'Descanso': return 'bg-gray-200';
      default: return 'bg-white';
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Rotación Semanal</h1>
      
      <div className="flex gap-2 mb-4">
        <button onClick={generateNext} className="bg-blue-600 text-white p-2 rounded">Generar rotación próxima semana</button>
        <button onClick={exportExcel} className="bg-green-600 text-white p-2 rounded">Exportar a Excel</button>
        <button 
          onClick={() => {
            if(confirm('¿Limpiar todos los datos?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          className="bg-red-600 text-white p-2 rounded"
        >
          Limpiar Datos
        </button>
      </div>

      {current && (
        <table className="w-full border-collapse border mb-8">
            <thead>
                <tr>
                    <th className="border p-2">Operario</th>
                    {weekDates.map(d => <th key={d} className="border p-2">{d}</th>)}
                </tr>
            </thead>
            <tbody>
                {operarios.map(op => (
                    <tr key={op.id}>
                        <td className="border p-2 font-semibold">{op.nombre}</td>
                        {dias.map(d => {
                            const prog = current.rotacion[op.id]?.[d];
                            return (
                                <td key={d} className={`border p-2 text-xs ${getCellColor(prog?.turno)}`}>
                                    <div className="font-semibold">{prog?.turno}</div>
                                    {prog?.disponibilidad !== 'Ninguna' && (
                                        <div className="text-gray-600">Disp: {prog?.disponibilidad}</div>
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
      )}

      {history.length > 0 && (
        <details className="border p-4 rounded bg-white">
          <summary className="font-bold cursor-pointer">Historial de rotaciones</summary>
          <div className="mt-4 space-y-4">
            {history.map((h, i) => (
              <div key={i} className="border p-2 text-sm">
                <p>Semana del: {h.fechaInicio}</p>
                <p>Carga nocturna: {h.cargaNocturna ? Object.entries(h.cargaNocturna).map(([id, c]) => `${operarios.find(o=>o.id===id)?.nombre}: ${c}`).join(', ') : 'N/A'}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default Rotation;
