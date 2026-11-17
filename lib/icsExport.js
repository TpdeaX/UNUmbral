// lib/icsExport.js
// Generador puro de archivo iCalendar (.ics) para exportar el horario semanal y tareas con recordatorios.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    const mod = factory();
    root.UNUmbralICS = mod;
    Object.assign(root, mod);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DIA_A_BYDAY = {
    LUNES: "MO",
    MARTES: "TU",
    MIERCOLES: "WE",
    JUEVES: "TH",
    VIERNES: "FR",
    SABADO: "SA",
    DOMINGO: "SU"
  };

  const DIA_A_JS_DAY = {
    DOMINGO: 0,
    LUNES: 1,
    MARTES: 2,
    MIERCOLES: 3,
    JUEVES: 4,
    VIERNES: 5,
    SABADO: 6
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function escapeICS(str) {
    return String(str || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function formatLocalICSDateTime(dateObj, hhmm) {
    const y = dateObj.getFullYear();
    const m = pad2(dateObj.getMonth() + 1);
    const d = pad2(dateObj.getDate());
    const [hh, mm] = String(hhmm || "08:00").split(":").map(Number);
    return `${y}${m}${d}T${pad2(hh || 0)}${pad2(mm || 0)}00`;
  }

  function nextOccurrenceDate(baseDate, diaSemana) {
    const targetDay = DIA_A_JS_DAY[String(diaSemana || "").toUpperCase()];
    if (targetDay === undefined) return new Date(baseDate.getTime());
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const diff = (targetDay - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function generarICS({ cursos = [], clases = [], tareas = [], ciclo = null, ahora = new Date(), avisoMinutos = 30 }) {
    const cursosMap = new Map((cursos || []).map(c => [c.id, c]));
    const inicioBase = ciclo && ciclo.fecha_inicio
      ? new Date(`${ciclo.fecha_inicio}T00:00:00`)
      : new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const baseValida = isNaN(inicioBase.getTime()) ? ahora : inicioBase;

    const untilStr = ciclo && ciclo.fecha_fin
      ? `${ciclo.fecha_fin.replace(/-/g, "")}T235959`
      : null;

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//UNUmbral//Horario Universitario//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];

    const triggerMin = Math.max(5, Number(avisoMinutos) || 30);

    for (const cl of (clases || [])) {
      const byDay = DIA_A_BYDAY[String(cl.dia_semana || "").toUpperCase()];
      if (!byDay || !cl.hora_inicio || !cl.hora_fin) continue;
      const curso = cl.curso_id ? cursosMap.get(cl.curso_id) : null;
      const titulo = cl.tipo === "actividad"
        ? (cl.titulo || cl.materia || "Actividad")
        : (curso ? curso.nombre : (cl.materia || "Clase"));
      const aula = cl.aula || (curso && curso.aula) || "";
      const prof = (curso && curso.profesor) || cl.profesor || "";

      const firstDate = nextOccurrenceDate(baseValida, cl.dia_semana);
      const dtStart = formatLocalICSDateTime(firstDate, cl.hora_inicio);
      const dtEnd = formatLocalICSDateTime(firstDate, cl.hora_fin);
      const rrule = untilStr
        ? `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${untilStr}`
        : `RRULE:FREQ=WEEKLY;BYDAY=${byDay};COUNT=17`;

      const descParts = [];
      if (prof) descParts.push(`Docente: ${prof}`);
      if (curso && curso.grupo_seccion) descParts.push(`Grupo: ${curso.grupo_seccion}`);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:unumbral-cls-${cl.id || Math.random().toString(36).slice(2)}@unumbral`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(rrule);
      lines.push(`SUMMARY:${escapeICS(titulo)}`);
      if (aula) lines.push(`LOCATION:${escapeICS(aula)}`);
      if (descParts.length) lines.push(`DESCRIPTION:${escapeICS(descParts.join(" · "))}`);
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${escapeICS(titulo)} en ${triggerMin} min`);
      lines.push(`TRIGGER:-PT${triggerMin}M`);
      lines.push("END:VALARM");
      lines.push("END:VEVENT");
    }

    for (const t of (tareas || [])) {
      if (t.completada || !t.fecha_limite) continue;
      const raw = String(t.fecha_limite).trim();
      const datePart = raw.slice(0, 10);
      const timePart = raw.includes("T") ? raw.slice(11, 16) : "23:59";
      const dueDate = new Date(`${datePart}T00:00:00`);
      if (isNaN(dueDate.getTime())) continue;
      const curso = t.curso_id ? cursosMap.get(t.curso_id) : null;
      const dtStart = formatLocalICSDateTime(dueDate, timePart);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:unumbral-tsk-${t.id || Math.random().toString(36).slice(2)}@unumbral`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtStart}`);
      lines.push(`SUMMARY:${escapeICS(`[Entrega] ${t.titulo}`)}`);
      if (curso) lines.push(`DESCRIPTION:${escapeICS(`Curso: ${curso.nombre} · Importancia ${t.importancia || 3}/5`)}`);
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:Entrega próxima: ${escapeICS(t.titulo)}`);
      lines.push("TRIGGER:-PT2H");
      lines.push("END:VALARM");
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  return { generarICS };
});
