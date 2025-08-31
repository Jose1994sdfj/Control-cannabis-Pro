/* =========================================================================
   Control Consumo Cannabis Pro - script.js
   - Totalmente responsivo (Chart.js con maintainAspectRatio: false)
   - Corrección de IDs y tab social (graficoSocial)
   - Resize automático al mostrar pestañas con gráficos
   - Persistencia por usuario en localStorage
   - Recomendaciones básicas
   - Estructura robusta y comentada
   ========================================================================= */

/* =========================
   Estado global y referencias
   ========================= */
let registros = [];
let usuarioActual = null;

// Tabs y secciones
const tabs = document.querySelectorAll(".tabs button[data-tab]");
const sections = document.querySelectorAll("main .tab");

// Login
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const usernameInput = document.getElementById("usernameInput");
const loginMsg = document.getElementById("loginMsg");

// Agregar registro
const addForm = document.getElementById("addForm");
const addMsg = document.getElementById("addMsg");

// Registros
const recordsList = document.getElementById("recordsList");
const searchRecordsInput = document.getElementById("searchRecordsInput");

// Recomendaciones
const recomendacionesBox = document.getElementById("recomendacionesBox");

// Desempeño social
const socialForm = document.getElementById("socialForm");
const socialMsg = document.getElementById("socialMsg");
const socialRecordsList = document.getElementById("socialRecordsList"); // opcional (si lo agregas en HTML)

// Gráficos (Chart.js)
let chartSatisfaccion = null;
let chartConsumoMensual = null;
let chartCostoGramo = null;
let chartMetodo = null;
let chartMotivo = null;
let chartDesempenoSocial = null;
let chartDashboard = null;

// Theme toggle
const themeToggle = document.getElementById("themeToggle");

// Export/Import
const exportBtn = document.getElementById("exportBtn");
const exportCSVBtn = document.getElementById("exportCSVBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const importMsg = document.getElementById("importMsg");

/* =========================
   Utilidades
   ========================= */

/** Devuelve el contexto 2D del canvas si existe, o null si no está presente */
function ctxOf(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const ctx = el.getContext("2d");
  return ctx || null;
}

/** Activa o desactiva tabs (excepto login) y muestra/oculta logout */
function activarTabs(estado) {
  tabs.forEach((btn) => {
    if (btn.getAttribute("data-tab") !== "login-tab") btn.disabled = !estado;
  });
  if (logoutBtn) {
    logoutBtn.hidden = !estado;
  }
}

/** Cambia la pestaña visible y dispara resize de gráficos si corresponde */
function cambiarTab(tabId) {
  // Activar botón correcto
  tabs.forEach((b) => b.classList.remove("active"));
  sections.forEach((s) => s.classList.remove("active"));

  const btn = Array.from(tabs).find((b) => b.getAttribute("data-tab") === tabId);
  if (btn) btn.classList.add("active");

  const sec = Array.from(sections).find((s) => s.id === tabId);
  if (sec) sec.classList.add("active");

  // Al mostrar una sección con gráficos, forzamos resize después del reflow
  if (tabId === "stats-tab" || tabId === "social-tab" || tabId === "dashboard-tab") {
    setTimeout(resizeAllCharts, 50);
  }
}

/** Limpia inputs de login */
function limpiarLogin() {
  if (usernameInput) usernameInput.value = "";
  if (loginMsg) loginMsg.textContent = "";
}

/** Forzar resize de todos los gráficos visibles */
function resizeAllCharts() {
  [chartSatisfaccion, chartConsumoMensual, chartCostoGramo, chartMetodo, chartMotivo, chartDesempenoSocial, chartDashboard]
    .forEach((ch) => {
      try {
        if (ch) ch.resize();
      } catch (e) {
        // no-op
      }
    });
}

/** Debounce simple */
function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/* =========================
   Persistencia (localStorage)
   ========================= */
function guardarDatos() {
  if (!usuarioActual) return;
  localStorage.setItem("registros_" + usuarioActual, JSON.stringify(registros));
}

function cargarDatos() {
  if (!usuarioActual) {
    registros = [];
    return;
  }
  const datos = localStorage.getItem("registros_" + usuarioActual);
  registros = datos ? JSON.parse(datos) : [];
}

function cargarDatosSocial() {
  if (!usuarioActual) return [];
  const datosSocial = localStorage.getItem("desempenoSocial_" + usuarioActual);
  return datosSocial ? JSON.parse(datosSocial) : [];
}

function guardarDatosSocial(data) {
  if (!usuarioActual) return;
  localStorage.setItem("desempenoSocial_" + usuarioActual, JSON.stringify(data));
}

/* =========================
   Render UI
   ========================= */
function actualizarUI() {
  actualizarDashboard();
  mostrarRegistros();
  inicializarGraficos();
  mostrarRecomendaciones();
  mostrarRegistrosSociales();
  inicializarGraficoSocial();
  inicializarGraficoDashboard();
}

/** Actualiza las métricas del dashboard */
function actualizarDashboard() {
  const totalRegistrosEl = document.getElementById("totalRegistros");
  const gastoTotalEl = document.getElementById("gastoTotal");
  const consumoTotalEl = document.getElementById("consumoTotal");
  const satisfaccionPromedioEl = document.getElementById("satisfaccionPromedio");

  if (!totalRegistrosEl) return;

  const totalRegistros = registros.length;
  const gastoTotal = registros.reduce((sum, r) => sum + (Number(r.precioTotal) || 0), 0);
  const consumoTotal = registros.reduce((sum, r) => sum + (Number(r.cantidadGramos) || 0), 0);
  const satisfaccionPromedio = totalRegistros > 0 
    ? registros.reduce((sum, r) => sum + (Number(r.satisfaccion) || 0), 0) / totalRegistros 
    : 0;

  totalRegistrosEl.textContent = totalRegistros.toLocaleString();
  gastoTotalEl.textContent = `$${gastoTotal.toFixed(2)}`;
  consumoTotalEl.textContent = `${consumoTotal.toFixed(1)}g`;
  satisfaccionPromedioEl.textContent = `${satisfaccionPromedio.toFixed(1)}/10`;
}

/** Registros con filtro por tipo o proveedor */
function mostrarRegistros() {
  if (!recordsList) return;

  const filtro = (searchRecordsInput?.value || "").trim().toLowerCase();
  const filtrados = registros.filter(
    (r) =>
      r.tipo.toLowerCase().includes(filtro) ||
      r.proveedor.toLowerCase().includes(filtro)
  );

  if (filtrados.length === 0) {
    recordsList.innerHTML = "<p>No hay registros que coincidan.</p>";
    return;
  }

  recordsList.innerHTML = filtrados
    .map(
      (r) => `
      <div class="record-item">
        <div><strong>Fecha:</strong> ${r.fecha}</div>
        <div><strong>Tipo:</strong> ${r.tipo}</div>
        <div><strong>Proveedor:</strong> ${r.proveedor}</div>
        <div><strong>Cantidad:</strong> ${r.cantidadGramos}g</div>
        <div><strong>Precio:</strong> $${r.precioTotal.toFixed(2)}</div>
        <div><strong>Motivo:</strong> ${r.motivo}</div>
        <div><strong>Método:</strong> ${r.metodoConsumo}</div>
        <div><strong>Satisfacción:</strong> ${r.satisfaccion}</div>
        <div><strong>Efectos secundarios:</strong> ${r.efectosSecundarios || "-"}</div>
      </div>
    `
    )
    .join("");
}

/** Recomendaciones en base a los datos */
function mostrarRecomendaciones() {
  if (!recomendacionesBox) return;
  if (registros.length === 0) {
    recomendacionesBox.innerHTML = "<p>No hay datos para recomendaciones.</p>";
    return;
  }

  let texto = "<ul>";
  if (registros.length > 20)
    texto += "<li>Considera hacer un descanso o disminuir frecuencia.</li>";

  const gastoPromedio =
    registros.reduce((acc, r) => acc + r.precioTotal, 0) / registros.length;
  if (gastoPromedio > 1000)
    texto += "<li>Revisa tu presupuesto mensual, podrías ahorrar más.</li>";

  if (registros.some((r) => (r.efectosSecundarios || "").toLowerCase().includes("ansiedad")))
    texto += "<li>Si experimentas ansiedad, prueba variedades con mayor CBD.</li>";

  texto += "<li>Mantén un registro constante para mejorar tu experiencia.</li></ul>";
  recomendacionesBox.innerHTML = texto;
}

/* =========================
   Cálculos para gráficos
   ========================= */
function mesesOrdenados() {
  // Devuelve lista única de AAAA-MM ordenada
  return Array.from(new Set(registros.map((r) => r.fecha.slice(0, 7)))).sort();
}

function calcularConsumoMensual() {
  const meses = {};
  registros.forEach((r) => {
    const mes = r.fecha.slice(0, 7);
    if (!meses[mes]) meses[mes] = 0;
    meses[mes] += Number(r.cantidadGramos) || 0;
  });
  return meses;
}

function calcularCostoPromedioPorGramo() {
  const costoPorMes = {};
  registros.forEach((r) => {
    const mes = r.fecha.slice(0, 7);
    if (!costoPorMes[mes]) costoPorMes[mes] = { totalPrecio: 0, totalGramos: 0 };
    costoPorMes[mes].totalPrecio += Number(r.precioTotal) || 0;
    costoPorMes[mes].totalGramos += Number(r.cantidadGramos) || 0;
  });

  const promedio = {};
  for (const mes in costoPorMes) {
    const g = costoPorMes[mes].totalGramos || 1;
    promedio[mes] = costoPorMes[mes].totalPrecio / g;
  }
  return promedio;
}

function calcularFrecuenciaPorMetodo() {
  const metodos = {};
  registros.forEach((r) => {
    const met = (r.metodoConsumo || "").toLowerCase();
    if (!met) return;
    metodos[met] = (metodos[met] || 0) + 1;
  });
  return metodos;
}

function calcularSatisfaccionPorMotivo() {
  const motivos = {};
  registros.forEach((r) => {
    const mot = (r.motivo || "").toLowerCase();
    if (!mot) return;
    if (!motivos[mot]) motivos[mot] = { total: 0, count: 0 };
    motivos[mot].total += Number(r.satisfaccion) || 0;
    motivos[mot].count++;
  });

  const promedios = {};
  for (const mot in motivos) {
    promedios[mot] = motivos[mot].total / (motivos[mot].count || 1);
  }
  return promedios;
}

/* =========================
   Gráficos (Stats)
   ========================= */
function crearGradienteVertical(ctx, color1, color2) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

function inicializarGraficos() {
  // Destruir si existen
  if (chartSatisfaccion) chartSatisfaccion.destroy();
  if (chartConsumoMensual) chartConsumoMensual.destroy();
  if (chartCostoGramo) chartCostoGramo.destroy();
  if (chartMetodo) chartMetodo.destroy();
  if (chartMotivo) chartMotivo.destroy();

  if (!registros.length) return;

  // 1) Satisfacción mensual promedio
  const ctxSat = ctxOf("graficoSatisfaccion");
  if (ctxSat) {
    const gradientSat = crearGradienteVertical(ctxSat, "#00ffea", "#007acc");
    const meses = mesesOrdenados();
    const satPorMes = meses.map((mes) => {
      const regs = registros.filter((r) => r.fecha.slice(0, 7) === mes);
      const total = regs.reduce((acc, r) => acc + (Number(r.satisfaccion) || 0), 0);
      return regs.length ? total / regs.length : 0;
    });

    chartSatisfaccion = new Chart(ctxSat, {
      type: "line",
      data: {
        labels: meses,
        datasets: [
          {
            label: "Satisfacción Promedio",
            data: satPorMes,
            borderColor: "#00ffe7",
            backgroundColor: gradientSat,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: "#00ffe7",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // clave para usar altura del contenedor
        scales: {
          y: {
            min: 0,
            max: 10,
            grid: { borderDash: [5, 5], color: "#00ffe7aa" },
            ticks: { color: "#00ffe7" },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#00ffe7" },
          },
        },
        plugins: {
          legend: { labels: { color: "#00ffe7" } },
          tooltip: {
            backgroundColor: "#00ffe7cc",
            titleColor: "#000",
            bodyColor: "#000",
            cornerRadius: 10,
            padding: 10,
          },
        },
        animation: { duration: 900, easing: "easeInOutQuad" },
      },
    });
  }

  // 2) Consumo mensual (gramos)
  const ctxCons = ctxOf("graficoConsumoMensual");
  if (ctxCons) {
    const consumoMensual = calcularConsumoMensual();
    const labels = Object.keys(consumoMensual).sort();
    const dataVals = labels.map((m) => consumoMensual[m]);
    const grad = crearGradienteVertical(ctxCons, "#ff00ff", "#800080");

    chartConsumoMensual = new Chart(ctxCons, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Consumo mensual (gramos)",
            data: dataVals,
            backgroundColor: grad,
            borderRadius: 10,
            borderSkipped: false,
            hoverBackgroundColor: "#ff6fff",
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { borderDash: [3, 3], color: "#ff00ffaa" },
            ticks: { color: "#ff00ff" },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#ff00ff" },
          },
        },
        plugins: {
          legend: { labels: { color: "#ff00ff" } },
          tooltip: {
            backgroundColor: "#ff00ffcc",
            titleColor: "#000",
            bodyColor: "#000",
            cornerRadius: 6,
            padding: 8,
          },
        },
        animation: { duration: 800, easing: "easeOutQuart" },
      },
    });
  }

  // 3) Costo promedio por gramo
  const ctxCosto = ctxOf("graficoCostoGramo");
  if (ctxCosto) {
    const costoProm = calcularCostoPromedioPorGramo();
    const labels = Object.keys(costoProm).sort();
    const dataVals = labels.map((m) => costoProm[m]);
    const grad = crearGradienteVertical(ctxCosto, "#00ff00", "#006600");

    chartCostoGramo = new Chart(ctxCosto, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Costo promedio por gramo ($)",
            data: dataVals,
            borderColor: "#00ff00",
            backgroundColor: grad,
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "#00ff0077", borderDash: [4, 4] },
            ticks: { color: "#00ff00" },
          },
          x: {
            ticks: { color: "#00ff00" },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { labels: { color: "#00ff00" } },
          tooltip: {
            backgroundColor: "#00ff0077",
            titleColor: "#000",
            bodyColor: "#000",
            cornerRadius: 5,
            padding: 7,
          },
        },
        animation: { duration: 800, easing: "easeInOutCubic" },
      },
    });
  }

  // 4) Frecuencia por método (doughnut)
  const ctxMetodo = ctxOf("graficoMetodo");
  if (ctxMetodo) {
    const frecMetodo = calcularFrecuenciaPorMetodo();
    const labels = Object.keys(frecMetodo).map((m) => m.charAt(0).toUpperCase() + m.slice(1));
    const dataVals = Object.values(frecMetodo);
    const coloresMetodo = ["#ff6384", "#36a2eb", "#ffce56", "#4bc0c0", "#9966ff", "#ff9f40"];

    chartMetodo = new Chart(ctxMetodo, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: dataVals,
            backgroundColor: coloresMetodo,
            borderColor: "#0d1117",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: "#79c0ff" } },
          tooltip: {
            backgroundColor: "#79c0ffcc",
            titleColor: "#000",
            bodyColor: "#000",
            cornerRadius: 6,
            padding: 6,
          },
        },
        animation: { duration: 700 },
      },
    });
  }

  // 5) Satisfacción por motivo (bar horizontal)
  const ctxMotivo = ctxOf("graficoMotivo");
  if (ctxMotivo) {
    const satMotivo = calcularSatisfaccionPorMotivo();
    const labels = Object.keys(satMotivo).map((m) => m.charAt(0).toUpperCase() + m.slice(1));
    const dataVals = Object.values(satMotivo);
    const grad = crearGradienteVertical(ctxMotivo, "#ff4500", "#ffa500");

    chartMotivo = new Chart(ctxMotivo, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Satisfacción promedio",
            data: dataVals,
            backgroundColor: grad,
            borderRadius: 8,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: 0,
            max: 10,
            ticks: { color: "#ffa500" },
            grid: { color: "#ffa50055", borderDash: [3, 3] },
          },
          y: {
            ticks: { color: "#ffa500" },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { labels: { color: "#ffa500" } },
          tooltip: {
            backgroundColor: "#ffa500cc",
            titleColor: "#000",
            bodyColor: "#000",
            cornerRadius: 8,
            padding: 8,
          },
        },
        animation: { duration: 800, easing: "easeOutQuart" },
      },
    });
  }
}

/** Gráfico resumen para dashboard - últimos 30 días */
function inicializarGraficoDashboard() {
  if (chartDashboard) {
    chartDashboard.destroy();
    chartDashboard = null;
  }

  if (!registros.length) return;

  const ctx = ctxOf("graficoDashboard");
  if (!ctx) return;

  // Filtrar últimos 30 días
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const registrosRecientes = registros.filter(r => {
    const fechaRegistro = new Date(r.fecha);
    return fechaRegistro >= hace30Dias;
  });

  if (registrosRecientes.length === 0) return;

  // Agrupar por día
  const datosPorDia = {};
  registrosRecientes.forEach(r => {
    const dia = r.fecha;
    if (!datosPorDia[dia]) {
      datosPorDia[dia] = { consumo: 0, gasto: 0, satisfaccion: 0, count: 0 };
    }
    datosPorDia[dia].consumo += Number(r.cantidadGramos) || 0;
    datosPorDia[dia].gasto += Number(r.precioTotal) || 0;
    datosPorDia[dia].satisfaccion += Number(r.satisfaccion) || 0;
    datosPorDia[dia].count += 1;
  });

  const dias = Object.keys(datosPorDia).sort();
  const consumoDiario = dias.map(d => datosPorDia[d].consumo);
  const satisfaccionDiaria = dias.map(d => datosPorDia[d].satisfaccion / datosPorDia[d].count);

  const gradient1 = crearGradienteVertical(ctx, "#00ffe7", "#007acc");
  const gradient2 = crearGradienteVertical(ctx, "#ff6384", "#ff1744");

  chartDashboard = new Chart(ctx, {
    type: "line",
    data: {
      labels: dias.map(d => new Date(d).toLocaleDateString()),
      datasets: [
        {
          label: "Consumo (g)",
          data: consumoDiario,
          borderColor: "#00ffe7",
          backgroundColor: gradient1,
          fill: false,
          tension: 0.4,
          yAxisID: "y",
        },
        {
          label: "Satisfacción",
          data: satisfaccionDiaria,
          borderColor: "#ff6384",
          backgroundColor: gradient2,
          fill: false,
          tension: 0.4,
          yAxisID: "y1",
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') },
          grid: { display: false },
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          ticks: { color: "#00ffe7" },
          grid: { color: "#00ffe755" },
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 10,
          ticks: { color: "#ff6384" },
          grid: { drawOnChartArea: false },
        },
      },
      plugins: {
        legend: { 
          labels: { 
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
          } 
        },
        tooltip: {
          backgroundColor: "rgba(13, 17, 23, 0.9)",
          titleColor: "#00ffe7",
          bodyColor: "#c9d1d9",
          cornerRadius: 8,
        },
      },
      animation: { duration: 800 },
    },
  });
}

/* =========================
   Export/Import Functions
   ========================= */
function exportarDatos() {
  if (!usuarioActual || registros.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  const dataToExport = {
    usuario: usuarioActual,
    fechaExport: new Date().toISOString(),
    registros: registros,
    datosSocial: cargarDatosSocial(),
    version: "2.0"
  };

  const dataStr = JSON.stringify(dataToExport, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `cannabis-control-${usuarioActual}-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
}

function exportarCSV() {
  if (!usuarioActual || registros.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  const headers = [
    "Fecha", "Tipo", "Proveedor", "Cantidad(g)", "Precio($)", 
    "Motivo", "Método", "Satisfacción", "Efectos Secundarios"
  ];

  const csvContent = [
    headers.join(","),
    ...registros.map(r => [
      r.fecha,
      `"${r.tipo}"`,
      `"${r.proveedor}"`,
      r.cantidadGramos,
      r.precioTotal,
      `"${r.motivo}"`,
      `"${r.metodoConsumo}"`,
      r.satisfaccion,
      `"${r.efectosSecundarios || ''}"`
    ].join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `cannabis-control-${usuarioActual}-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}

function importarDatos(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);

      if (!importedData.registros || !Array.isArray(importedData.registros)) {
        throw new Error("Formato de archivo inválido");
      }

      // Confirmación antes de importar
      const confirmImport = confirm(
        `¿Confirmas importar ${importedData.registros.length} registros? Esto se agregará a tus datos existentes.`
      );

      if (confirmImport) {
        // Agregar registros importados a los existentes
        registros.push(...importedData.registros);

        // Importar datos sociales si existen
        if (importedData.datosSocial && Array.isArray(importedData.datosSocial)) {
          const datosSocialActuales = cargarDatosSocial();
          datosSocialActuales.push(...importedData.datosSocial);
          guardarDatosSocial(datosSocialActuales);
        }

        guardarDatos();
        actualizarUI();

        if (importMsg) {
          importMsg.textContent = `✅ ${importedData.registros.length} registros importados correctamente`;
          importMsg.style.color = "var(--success-color)";
        }
      }
    } catch (error) {
      if (importMsg) {
        importMsg.textContent = "❌ Error: Archivo inválido o corrupto";
        importMsg.style.color = "var(--danger-color)";
      }
    }

    // Limpiar input
    importFile.value = "";
  };

  reader.readAsText(file);
}

/* =========================
   Theme Toggle
   ========================= */
function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.contains("light-theme");

  if (isLight) {
    body.classList.remove("light-theme");
    themeToggle.textContent = "🌙";
    localStorage.setItem("theme", "dark");
  } else {
    body.classList.add("light-theme");
    themeToggle.textContent = "☀️";
    localStorage.setItem("theme", "light");
  }

  // Actualizar gráficos para el nuevo tema
  setTimeout(() => {
    resizeAllCharts();
    inicializarGraficos();
    inicializarGraficoSocial();
    inicializarGraficoDashboard();
  }, 100);
}

function aplicarTemaGuardado() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
    if (themeToggle) themeToggle.textContent = "☀️";
  } else {
    if (themeToggle) themeToggle.textContent = "🌙";
  }
}

/* =========================
   Desempeño Social
   ========================= */
function mostrarRegistrosSociales() {
  if (!socialRecordsList) return; // si no existe en HTML, omitir
  const datosSocial = cargarDatosSocial();

  if (datosSocial.length === 0) {
    socialRecordsList.innerHTML = "<p>No hay registros de desempeño social.</p>";
    return;
  }

  socialRecordsList.innerHTML = datosSocial
    .map(
      (d) => `
        <div class="record-item">
          <div><strong>Fecha:</strong> ${d.fecha}</div>
          <div><strong>Interacciones Sociales:</strong> ${d.interaccionesSociales}</div>
          <div><strong>Desempeño Laboral:</strong> ${d.desempenoLaboral}</div>
          <div><strong>Estado de Ánimo:</strong> ${d.estadoAnimo}</div>
        </div>
      `
    )
    .join("");
}

function valorNumerico(valor) {
  if (!valor) return 5;
  valor = (valor + "").toLowerCase().trim();
  if (["baja", "bajo", "poca", "poco", "mala", "malo", "negativo"].includes(valor)) return 3;
  if (["media", "medio", "regular", "moderada", "moderado", "neutral"].includes(valor)) return 6;
  if (["alta", "alto", "buena", "bueno", "excelente", "muy buena", "positivo"].includes(valor)) return 9;
  const n = parseInt(valor, 10);
  if (!isNaN(n)) return Math.max(0, Math.min(10, n));
  return 5;
}

function inicializarGraficoSocial() {
  if (chartDesempenoSocial) {
    chartDesempenoSocial.destroy();
    chartDesempenoSocial = null;
  }

  const datosSocial = cargarDatosSocial();
  if (!datosSocial.length) return;

  const total = datosSocial.length;
  let sumaInteracciones = 0;
  let sumaDesempeno = 0;
  let sumaEstado = 0;

  datosSocial.forEach((d) => {
    sumaInteracciones += valorNumerico(d.interaccionesSociales);
    sumaDesempeno += valorNumerico(d.desempenoLaboral);
    sumaEstado += valorNumerico(d.estadoAnimo);
  });

  const promedioInteracciones = +(sumaInteracciones / total).toFixed(2);
  const promedioDesempeno = +(sumaDesempeno / total).toFixed(2);
  const promedioEstado = +(sumaEstado / total).toFixed(2);

  const ctx = ctxOf("graficoSocial"); // ← coincide con tu HTML
  if (!ctx) return;

  chartDesempenoSocial = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Interacciones Sociales", "Desempeño Laboral", "Estado de Ánimo"],
      datasets: [
        {
          label: "Promedio",
          data: [promedioInteracciones, promedioDesempeno, promedioEstado],
          backgroundColor: ["#79c0ff", "#238636", "#58a6ff"],
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#79c0ff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // ✅ adapta al contenedor
      scales: {
        y: {
          min: 0,
          max: 10,
          ticks: { color: "#79c0ff", stepSize: 1 },
          grid: { color: "#79c0ff44", borderDash: [5, 5] },
        },
        x: {
          ticks: { color: "#79c0ff" },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { labels: { color: "#79c0ff" } },
        tooltip: {
          backgroundColor: "#79c0ffcc",
          titleColor: "#000",
          bodyColor: "#000",
          cornerRadius: 6,
          padding: 6,
        },
      },
      animation: { duration: 800, easing: "easeInOutQuad" },
    },
  });
}

/* =========================
   Eventos
   ========================= */
// Tabs navegación
tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    const tabId = btn.getAttribute("data-tab");
    cambiarTab(tabId);
  });
});

// Login
if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    const user = (usernameInput?.value || "").trim();
    if (!user) {
      if (loginMsg) loginMsg.textContent = "Por favor ingresa un nombre de usuario.";
      return;
    }
    usuarioActual = user;
    if (loginMsg) loginMsg.textContent = `¡Bienvenido, ${usuarioActual}!`;
    localStorage.setItem("usuarioActual", usuarioActual);
    cargarDatos();
    activarTabs(true);
    cambiarTab("dashboard-tab");
    limpiarLogin();
    actualizarUI();
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    usuarioActual = null;
    localStorage.removeItem("usuarioActual");
    registros = [];
    activarTabs(false);
    cambiarTab("login-tab");
    if (recordsList) recordsList.innerHTML = "";
    if (recomendacionesBox) recomendacionesBox.innerHTML = "";
    if (loginMsg) loginMsg.textContent = "";
    // destruir gráficos
    [chartSatisfaccion, chartConsumoMensual, chartCostoGramo, chartMetodo, chartMotivo, chartDesempenoSocial, chartDashboard]
      .forEach((ch) => {
        try { if (ch) ch.destroy(); } catch (e) {}
      });
    chartSatisfaccion = chartConsumoMensual = chartCostoGramo = chartMetodo = chartMotivo = chartDesempenoSocial = chartDashboard = null;
  });
}

// Agregar registro de consumo
if (addForm) {
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!usuarioActual) {
      if (addMsg) addMsg.textContent = "Debes iniciar sesión primero.";
      return;
    }

    const nuevo = {
      fecha: document.getElementById("fecha").value,
      tipo: document.getElementById("tipo").value.trim(),
      proveedor: document.getElementById("proveedor").value.trim(),
      cantidadGramos: parseFloat(document.getElementById("cantidad").value),
      precioTotal: parseFloat(document.getElementById("precio").value),
      motivo: document.getElementById("motivo").value.trim(),
      metodoConsumo: document.getElementById("metodo").value.trim(),
      satisfaccion: parseInt(document.getElementById("satisfaccion").value, 10),
      efectosSecundarios: document.getElementById("efectos").value.trim(),
      consciente: document.getElementById("consciente").value === "true",
    };

    registros.push(nuevo);
    guardarDatos();
    actualizarUI();

    addForm.reset();
    if (addMsg) addMsg.textContent = "✅ Registro agregado correctamente.";
  });
}

// Buscar en registros
if (searchRecordsInput) {
  searchRecordsInput.addEventListener("input", debounce(() => mostrarRegistros(), 150));
}

// Formulario de desempeño social
if (socialForm) {
  socialForm.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!usuarioActual) {
      if (socialMsg) socialMsg.textContent = "Debes iniciar sesión primero.";
      return;
    }

    const nuevoSocial = {
      fecha: new Date().toISOString().slice(0, 10),
      interaccionesSociales: document.getElementById("interaccionesSociales").value,
      desempenoLaboral: document.getElementById("desempenoLaboral").value,
      estadoAnimo: document.getElementById("estadoAnimo").value,
    };

    const datosSocial = cargarDatosSocial();
    datosSocial.push(nuevoSocial);
    guardarDatosSocial(datosSocial);

    if (socialMsg) socialMsg.textContent = "✅ Desempeño social registrado correctamente.";
    socialForm.reset();

    mostrarRegistrosSociales();
    inicializarGraficoSocial();
    setTimeout(resizeAllCharts, 50);
  });
}

// Theme toggle
if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
}

// Export/Import events
if (exportBtn) {
  exportBtn.addEventListener("click", exportarDatos);
}

if (exportCSVBtn) {
  exportCSVBtn.addEventListener("click", exportarCSV);
}

if (importBtn) {
  importBtn.addEventListener("click", () => importFile.click());
}

if (importFile) {
  importFile.addEventListener("change", importarDatos);
}

/* =========================
   Inicialización
   ========================= */
window.addEventListener("load", () => {
  aplicarTemaGuardado();
  usuarioActual = localStorage.getItem("usuarioActual");
  if (usuarioActual) {
    activarTabs(true);
    cambiarTab("dashboard-tab");
    cargarDatos();
    actualizarUI();
  } else {
    activarTabs(false);
    cambiarTab("login-tab");
  }
});

// Redimensionar gráficos al cambiar tamaño de ventana
window.addEventListener("resize", debounce(resizeAllCharts, 100));

// Observa mutaciones por si el CSS/DOM cambian tamaños de contenedor
const ro = new ResizeObserver(debounce(() => resizeAllCharts(), 80));
document.querySelectorAll(".chart-container").forEach((c) => ro.observe(c));

/* =========================
   Fin del archivo
   ========================= */