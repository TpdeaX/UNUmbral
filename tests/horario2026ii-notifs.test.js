const test = require("node:test");
const assert = require("node:assert/strict");
const { construirHorario2026II } = require("../lib/miHorario2026II.js");
const { generarICS } = require("../lib/icsExport.js");
const { planificarNotificaciones, formatearResumenProximaAlerta } = require("../lib/planificador.js");

test("construirHorario2026II genera los 6 cursos y 9 sesiones del VIII ciclo", () => {
  const { ciclo, cursos, clases } = construirHorario2026II();
  assert.equal(ciclo.nombre, "Ciclo 2026-II (VIII)");
  assert.equal(cursos.length, 6);
  assert.equal(clases.length, 9);

  const nombres = new Set(cursos.map(c => c.nombre));
  assert.ok(nombres.has("Taller de Desarrollo"));
  assert.ok(nombres.has("Modelos y Simulación de Sistemas"));
  assert.ok(nombres.has("Desarrollo de Soluciones en Software Libre"));
  assert.ok(nombres.has("Sistemas Distribuidos"));
  assert.ok(nombres.has("Derecho Informático"));
  assert.ok(nombres.has("Prácticas Pre Profesionales II"));

  const practicas = cursos.find(c => c.nombre === "Prácticas Pre Profesionales II");
  const sesionPracticas = clases.find(cl => cl.curso_id === practicas.id);
  assert.equal(sesionPracticas.dia_semana, "SABADO");
  assert.equal(sesionPracticas.hora_inicio, "09:00");
  assert.equal(sesionPracticas.hora_fin, "12:20");

  const swLibre = cursos.find(c => c.nombre === "Desarrollo de Soluciones en Software Libre");
  assert.equal(swLibre.profesor, "Mg. Richard Piero Bardales Linares");
  assert.equal(swLibre.grupo_seccion, "GA");
});

test("generarICS genera archivo iCalendar válido con RRULE y VALARM", () => {
  const { ciclo, cursos, clases } = construirHorario2026II();
  const tareas = [
    { id: "t1", titulo: "Entrega Parcial", curso_id: cursos[0].id, fecha_limite: "2026-11-20T18:00", importancia: 4, completada: false },
    { id: "t2", titulo: "Ya hecha", curso_id: cursos[0].id, fecha_limite: "2026-11-20T18:00", importancia: 3, completada: true }
  ];

  const ics = generarICS({ cursos, clases, tareas, ciclo, avisoMinutos: 30 });
  assert.match(ics, /^BEGIN:VCALENDAR/m);
  assert.match(ics, /END:VCALENDAR$/m);
  assert.match(ics, /SUMMARY:Taller de Desarrollo/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=TU/);
  assert.match(ics, /TRIGGER:-PT30M/);
  assert.match(ics, /SUMMARY:\[Entrega\] Entrega Parcial/);
  assert.doesNotMatch(ics, /Ya hecha/);
});

test("planificarNotificaciones agrega avisos 2 h / 1 h para tareas creadas el mismo día (< 8 h)", () => {
  const ahora = new Date(2026, 10, 17, 19, 0, 0); // 7:00 PM
  const cursos = [{ id: "c1", nombre: "Sistemas Distribuidos" }];
  const tareas = [
    { id: "t_hoy", titulo: "Subir avance", curso_id: "c1", fecha_limite: "2026-11-17T23:59", importancia: 2, completada: false }
  ];

  const notifs = planificarNotificaciones({
    ahora,
    cursos,
    clases: [],
    tareas,
    eventos: [],
    excepciones: [],
    ajustes: { silencio_activo: false, resumen_activo: false },
    dias: 2
  });

  const avisos = notifs.filter(n => n.extra?.ref_id === "t_hoy");
  assert.equal(avisos.length, 3); // 2 h, 1 h, 20 min
  assert.match(avisos[0].titulo, /Vence en 2 h/);
});

test("formatearResumenProximaAlerta formatea correctamente la próxima alerta", () => {
  const ahora = new Date(2026, 10, 17, 16, 0, 0);
  const notifs = [
    { cuando: new Date(2026, 10, 17, 16, 20, 0), titulo: "Taller de Desarrollo en 10 min" }
  ];
  const txt = formatearResumenProximaAlerta(notifs, ahora);
  assert.match(txt, /Taller de Desarrollo en 10 min/);
  assert.match(txt, /en 20 min/);
  assert.equal(formatearResumenProximaAlerta([], ahora), "Sin alertas próximas programadas");
});
