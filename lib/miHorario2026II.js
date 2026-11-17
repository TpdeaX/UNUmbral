// lib/miHorario2026II.js
// Plantilla oficial del Horario Semestre 2026-II (Ciclo VIII - Ingeniería de Sistemas UNU)
// Horas y docentes contrastados con "HORARIO DOCENTE -SEMESTRE 2026 - II.xlsx" (Hoja HORARIO X CICLO, Ciclo VIII Sección A).

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    const mod = factory();
    root.UNUMiHorario2026II = mod;
    Object.assign(root, mod);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CICLO_PRESET_2026_II = Object.freeze({
    id: "ciclo_unu_2026_2_viii",
    nombre: "Ciclo 2026-II (VIII)",
    // Semestre 2026-II inició lunes 2026-08-31 / septiembre; editable desde el gestor de ciclo
    fecha_inicio: "2026-08-31",
    fecha_fin: "2026-12-27"
  });

  const CURSOS_2026_II = Object.freeze([
    {
      key: "taller_desarrollo",
      nombre: "Taller de Desarrollo",
      ciclo_curso: "VIII",
      tipo_condicion: "obligatorio",
      grupo_seccion: "A",
      profesor: "Por contratar",
      aula: "Lab Compu 1",
      color: "#BAE6FD",
      creditos: 3,
      notas: "Horario 2026-II · Martes 4:30 pm – 7:00 pm."
    },
    {
      key: "modelos_simulacion",
      nombre: "Modelos y Simulación de Sistemas",
      ciclo_curso: "VIII",
      tipo_condicion: "obligatorio",
      grupo_seccion: "A",
      profesor: "Mg. Arturo Yupanqui Villanueva",
      aula: "Lab Cómputo 3",
      color: "#C7D2FE",
      creditos: 4,
      notas: "Horario 2026-II · Miércoles 3:40 – 5:20 pm y Jueves 5:20 – 7:00 pm."
    },
    {
      key: "software_libre",
      nombre: "Desarrollo de Soluciones en Software Libre",
      ciclo_curso: "VIII",
      tipo_condicion: "obligatorio",
      grupo_seccion: "GA",
      profesor: "Mg. Richard Piero Bardales Linares",
      aula: "Lab Cómputo 1",
      color: "#BBF7D0",
      creditos: 4,
      notas: "Horario 2026-II · Miércoles 5:20 – 7:00 pm y Viernes 7:30 – 9:10 pm."
    },
    {
      key: "sistemas_distribuidos",
      nombre: "Sistemas Distribuidos",
      ciclo_curso: "VIII",
      tipo_condicion: "obligatorio",
      grupo_seccion: "A",
      profesor: "Mg. Richard Piero Bardales Linares",
      aula: "Lab Redes",
      color: "#FED7AA",
      creditos: 4,
      notas: "Horario 2026-II · Miércoles y Jueves 7:30 – 9:10 pm."
    },
    {
      key: "derecho_informatico",
      nombre: "Derecho Informático",
      ciclo_curso: "VIII",
      tipo_condicion: "obligatorio",
      grupo_seccion: "GA",
      profesor: "Mg. Arturo Yupanqui Villanueva",
      aula: "Aula 08 (Pab. 7)",
      color: "#F5D0FE",
      creditos: 3,
      notas: "Horario 2026-II · Viernes 2:50 – 5:20 pm."
    },
    {
      key: "practicas_pre_ii",
      nombre: "Prácticas Pre Profesionales II",
      ciclo_curso: "VIII",
      tipo_condicion: "obligatorio",
      grupo_seccion: "A",
      profesor: "Ing. Mg. Diana Díaz Estrada",
      aula: "",
      color: "#99F6E4",
      creditos: 4,
      notas: "Excel oficial: Sábado 9:00 am – 12:20 pm (verificar si tu bloque inicia 10:20 am)."
    }
  ]);

  const SESIONES_2026_II = Object.freeze([
    { cursoKey: "taller_desarrollo", dia_semana: "MARTES", hora_inicio: "16:30", hora_fin: "19:00", aula: "Lab Compu 1" },
    { cursoKey: "modelos_simulacion", dia_semana: "MIERCOLES", hora_inicio: "15:40", hora_fin: "17:20", aula: "Lab Cómputo 3" },
    { cursoKey: "software_libre", dia_semana: "MIERCOLES", hora_inicio: "17:20", hora_fin: "19:00", aula: "Lab Cómputo 1" },
    { cursoKey: "sistemas_distribuidos", dia_semana: "MIERCOLES", hora_inicio: "19:30", hora_fin: "21:10", aula: "Lab Redes" },
    { cursoKey: "modelos_simulacion", dia_semana: "JUEVES", hora_inicio: "17:20", hora_fin: "19:00", aula: "Lab Cómputo 3" },
    { cursoKey: "sistemas_distribuidos", dia_semana: "JUEVES", hora_inicio: "19:30", hora_fin: "21:10", aula: "Lab Redes" },
    { cursoKey: "derecho_informatico", dia_semana: "VIERNES", hora_inicio: "14:50", hora_fin: "17:20", aula: "" },
    { cursoKey: "software_libre", dia_semana: "VIERNES", hora_inicio: "19:30", hora_fin: "21:10", aula: "Lab Cómputo 1" },
    { cursoKey: "practicas_pre_ii", dia_semana: "SABADO", hora_inicio: "09:00", hora_fin: "12:20", aula: "" }
  ]);

  function construirHorario2026II(opts = {}) {
    const genId = typeof opts.generarId === "function"
      ? opts.generarId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

    const cicloId = opts.cicloId || CICLO_PRESET_2026_II.id;
    const fechaInicio = opts.fechaInicio || CICLO_PRESET_2026_II.fecha_inicio;
    const fechaFin = opts.fechaFin || CICLO_PRESET_2026_II.fecha_fin;

    const ciclo = {
      id: cicloId,
      nombre: CICLO_PRESET_2026_II.nombre,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado: "activo",
      creado_por_usuario: true,
      fecha_creacion: new Date().toISOString()
    };

    const keyToCursoId = new Map();
    const cursos = CURSOS_2026_II.map((c) => {
      const id = genId(`cur_${c.key}`);
      keyToCursoId.set(c.key, id);
      return {
        id,
        ciclo_id: cicloId,
        ciclo_curso: c.ciclo_curso,
        tipo_condicion: c.tipo_condicion,
        codigo_asignatura: "",
        grupo_seccion: c.grupo_seccion,
        nombre: c.nombre,
        profesor: c.profesor,
        aula: c.aula,
        color: c.color,
        creditos: c.creditos,
        notas: c.notas,
        evaluacion: { parcial: null, final: null, practicas: [] }
      };
    });

    const clases = SESIONES_2026_II.map((s, idx) => ({
      id: genId(`cls_${idx}`),
      curso_id: keyToCursoId.get(s.cursoKey),
      ciclo_id: cicloId,
      tipo: "curso",
      dia_semana: s.dia_semana,
      hora_inicio: s.hora_inicio,
      hora_fin: s.hora_fin,
      aula: s.aula
    }));

    return { ciclo, cursos, clases };
  }

  return {
    CICLO_PRESET_2026_II,
    CURSOS_2026_II,
    SESIONES_2026_II,
    construirHorario2026II
  };
});
