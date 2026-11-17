/**
 * UNUmbral — lib/focusTimer.js
 * Temporizador de enfoque offline (Pomodoro 25/15/5) + puente al ecosistema
 * (Atelier Diario, SOS Calma y OMNI ARENA) + resumen rápido del día.
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    const mod = factory();
    root.UNUmbralFocus = mod;
    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => mod.initFocusWidget());
      } else {
        mod.initFocusWidget();
      }
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function formatearMinSeg(segundos) {
    const s = Math.max(0, Math.floor(Number(segundos) || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function resolverUrlEcosistema(app, hostname) {
    const host = hostname || (typeof window !== "undefined" ? window.location.hostname : "");
    if (host && host.endsWith("github.io")) {
      if (app === "atelier") return "../atelier-diario/";
      if (app === "calm") return "../atelier-diario/#calm";
      return "../omni-arena/";
    }
    if (app === "atelier") return "http://localhost:5176/";
    if (app === "calm") return "http://localhost:5176/#calm";
    return "http://localhost:5175/";
  }

  function playGentleChime() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(528, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.16, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.25);
    } catch {
      // Ignore audio restrictions
    }
  }

  function initFocusWidget() {
    const clockEl = document.getElementById("focus-clock-display");
    const toggleBtn = document.getElementById("btn-focus-toggle");
    const resetBtn = document.getElementById("btn-focus-reset");
    const presetBtns = document.querySelectorAll("[data-focus-min]");
    const copyBtn = document.getElementById("btn-copy-day-summary");

    const linkDir = document.getElementById("eco-link-directorio");
    const linkAtelier = document.getElementById("eco-link-atelier");
    const linkCalm = document.getElementById("eco-link-calm");
    const linkArena = document.getElementById("eco-link-arena");
    if (linkDir) linkDir.setAttribute("href", resolverUrlEcosistema("atelier"));
    if (linkAtelier) linkAtelier.setAttribute("href", resolverUrlEcosistema("atelier"));
    if (linkCalm) linkCalm.setAttribute("href", resolverUrlEcosistema("calm"));
    if (linkArena) linkArena.setAttribute("href", resolverUrlEcosistema("arena"));

    if (!clockEl || !toggleBtn || !resetBtn) return;

    let selectedMinutes = 25;
    let remainingSec = 25 * 60;
    let running = false;
    let intervalId = null;

    const renderClock = () => {
      clockEl.textContent = formatearMinSeg(remainingSec);
      toggleBtn.textContent = running ? "Pausar" : "Iniciar";
    };

    const stopTimer = () => {
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      renderClock();
    };

    presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mins = parseInt(btn.getAttribute("data-focus-min"), 10) || 25;
        selectedMinutes = mins;
        remainingSec = mins * 60;
        presetBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        stopTimer();
      });
    });

    toggleBtn.addEventListener("click", () => {
      if (running) {
        stopTimer();
        return;
      }
      running = true;
      renderClock();
      intervalId = setInterval(() => {
        remainingSec -= 1;
        if (remainingSec <= 0) {
          remainingSec = 0;
          stopTimer();
          playGentleChime();
          const toast = document.getElementById("toast");
          if (toast) {
            toast.textContent = `Bloque de ${selectedMinutes} min completado`;
            toast.classList.remove("hidden");
            setTimeout(() => toast.classList.add("hidden"), 3000);
          }
          return;
        }
        renderClock();
      }, 1000);
    });

    resetBtn.addEventListener("click", () => {
      remainingSec = selectedMinutes * 60;
      stopTimer();
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const classesText = Array.from(document.querySelectorAll("#today-classes-list .class-card, #today-classes-list .card"))
          .map((el) => el.textContent.replace(/\s+/g, " ").trim())
          .slice(0, 8);
        const tasksText = Array.from(document.querySelectorAll("#urgent-tasks-list .task-card, #urgent-tasks-list .card"))
          .map((el) => el.textContent.replace(/\s+/g, " ").trim())
          .slice(0, 6);

        const summary = [
          "Resumen UNUmbral de Hoy:",
          classesText.length ? `Clases:\n- ${classesText.join("\n- ")}` : "Sin clases registradas hoy.",
          tasksText.length ? `Pendientes clave:\n- ${tasksText.join("\n- ")}` : "Sin tareas urgentes.",
        ].join("\n\n");

        try {
          await navigator.clipboard.writeText(summary);
          copyBtn.textContent = "Resumen copiado";
          setTimeout(() => {
            copyBtn.textContent = "Copiar resumen";
          }, 1800);
        } catch {
          // Clipboard unavailable
        }
      });
    }

    renderClock();
  }

  return {
    formatearMinSeg,
    resolverUrlEcosistema,
    initFocusWidget,
  };
});
