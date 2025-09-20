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
const socialInsights = document.getElementById("socialInsights");

// Gráficos (Chart.js)
let chartSatisfaccion = null;
let chartConsumoMensual = null;
let chartCostoGramo = null;
let chartMetodo = null;
let chartMotivo = null;
let chartDesempenoSocial = null;
let chartSocialTendencia = null;
let chartDashboard = null;

// Theme toggle
const themeToggle = document.getElementById("themeToggle");

// Export PDF
const exportPDFBtn = document.getElementById("exportPDFBtn");
const exportMsg = document.getElementById("exportMsg");

// Menú hamburguesa
const hamburgerBtn = document.getElementById("hamburgerBtn");
const mobileNav = document.getElementById("mobileNav");
const mobileNavButtons = document.querySelectorAll(".mobile-nav button[data-tab]");
const themeToggleMobile = document.getElementById("themeToggleMobile");
const logoutBtnMobile = document.getElementById("logoutBtnMobile");

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
  // Tabs desktop
  tabs.forEach((btn) => {
    if (btn.getAttribute("data-tab") !== "login-tab") btn.disabled = !estado;
  });
  if (logoutBtn) {
    logoutBtn.hidden = !estado;
  }
  // Siempre mostrar el botón de tema
  if (themeToggle) {
    themeToggle.hidden = false;
  }

  // Tabs móvil
  mobileNavButtons.forEach((btn) => {
    if (btn.getAttribute("data-tab") !== "login-tab") btn.disabled = !estado;
  });
  if (logoutBtnMobile) {
    logoutBtnMobile.hidden = !estado;
  }
}

/** Cambia la pestaña visible y dispara resize de gráficos si corresponde */
function cambiarTab(tabId) {
  // Activar botón correcto en desktop
  tabs.forEach((b) => b.classList.remove("active"));
  sections.forEach((s) => s.classList.remove("active"));

  const btn = Array.from(tabs).find((b) => b.getAttribute("data-tab") === tabId);
  if (btn) btn.classList.add("active");

  // Activar botón correcto en móvil
  mobileNavButtons.forEach((b) => b.classList.remove("active"));
  const mobileBtn = Array.from(mobileNavButtons).find((b) => b.getAttribute("data-tab") === tabId);
  if (mobileBtn) mobileBtn.classList.add("active");

  const sec = Array.from(sections).find((s) => s.id === tabId);
  if (sec) sec.classList.add("active");

  // Cerrar menú móvil al cambiar tab
  cerrarMenuMovil();

  // Al mostrar una sección con gráficos, forzamos resize después del reflow
  if (tabId === "stats-tab" || tabId === "social-tab" || tabId === "dashboard-tab") {
    setTimeout(resizeAllCharts, 50);
  }
}

/** Alterna la visibilidad del menú hamburguesa */
function toggleMenuMovil() {
  if (mobileNav) {
    mobileNav.classList.toggle("show");
  }
}

/** Cierra el menú móvil */
function cerrarMenuMovil() {
  if (mobileNav) {
    mobileNav.classList.remove("show");
  }
}

/** Limpia inputs de login */
function limpiarLogin() {
  if (usernameInput) usernameInput.value = "";
  if (loginMsg) loginMsg.textContent = "";
}

/** Forzar resize de todos los gráficos visibles */
function resizeAllCharts() {
  [chartSatisfaccion, chartConsumoMensual, chartCostoGramo, chartMetodo, chartMotivo, chartDesempenoSocial, chartSocialTendencia, chartDashboard]
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
  inicializarGraficoSocialTendencia();
  mostrarSocialInsights();
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

  const recomendaciones = generarRecomendacionesAvanzadas();
  
  let html = `
    <div class="recomendaciones-container">
      <h3>🎯 Análisis Personalizado y Recomendaciones</h3>
      ${recomendaciones.map(rec => `
        <div class="recomendacion-item ${rec.tipo}">
          <div class="recomendacion-icon">${rec.icono}</div>
          <div class="recomendacion-content">
            <h4>${rec.titulo}</h4>
            <p>${rec.descripcion}</p>
            ${rec.detalles ? `<small class="recomendacion-detalles">${rec.detalles}</small>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  recomendacionesBox.innerHTML = html;
}

function generarRecomendacionesAvanzadas() {
  const recomendaciones = [];
  
  // Análisis de eficiencia precio-satisfacción
  const eficienciaPorTipo = analizarEficienciaTipo();
  if (eficienciaPorTipo.mejor) {
    recomendaciones.push({
      tipo: 'eficiencia',
      icono: '💰',
      titulo: 'Mejor Relación Calidad-Precio',
      descripcion: `${eficienciaPorTipo.mejor.tipo} te ofrece la mejor satisfacción por peso (${eficienciaPorTipo.mejor.eficiencia.toFixed(1)}/g)`,
      detalles: `Satisfacción promedio: ${eficienciaPorTipo.mejor.satisfaccionPromedio.toFixed(1)}/10 | Precio promedio: $${eficienciaPorTipo.mejor.precioPromedio.toFixed(0)}/g`
    });
  }

  // Análisis de proveedores
  const mejorProveedor = analizarProveedores();
  if (mejorProveedor) {
    recomendaciones.push({
      tipo: 'proveedor',
      icono: '🏆',
      titulo: 'Proveedor Recomendado',
      descripcion: `${mejorProveedor.nombre} tiene la mejor satisfacción promedio (${mejorProveedor.satisfaccion.toFixed(1)}/10)`,
      detalles: `${mejorProveedor.registros} registros | Precio promedio: $${mejorProveedor.precioPromedio.toFixed(0)}/g`
    });
  }

  // Análisis de métodos de consumo
  const mejorMetodo = analizarMetodos();
  if (mejorMetodo) {
    recomendaciones.push({
      tipo: 'metodo',
      icono: '🔥',
      titulo: 'Método Más Efectivo',
      descripcion: `${mejorMetodo.metodo} te da la mayor satisfacción promedio (${mejorMetodo.satisfaccion.toFixed(1)}/10)`,
      detalles: `Usado en ${mejorMetodo.cantidad} ocasiones`
    });
  }

  // Análisis de frecuencia
  const analisisFreq = analizarFrecuencia();
  if (analisisFreq.recomendacion) {
    recomendaciones.push({
      tipo: analisisFreq.tipo,
      icono: analisisFreq.icono,
      titulo: analisisFreq.titulo,
      descripcion: analisisFreq.recomendacion,
      detalles: analisisFreq.detalles
    });
  }

  // Análisis de efectos secundarios
  const efectosAnalisis = analizarEfectosSecundarios();
  if (efectosAnalisis.length > 0) {
    efectosAnalisis.forEach(efecto => recomendaciones.push(efecto));
  }

  // Análisis de motivos vs satisfacción
  const motivoOptimo = analizarMotivosSatisfaccion();
  if (motivoOptimo) {
    recomendaciones.push({
      tipo: 'motivo',
      icono: '🎯',
      titulo: 'Uso Más Satisfactorio',
      descripcion: `Cuando consumes para ${motivoOptimo.motivo.toLowerCase()}, obtienes mayor satisfacción (${motivoOptimo.satisfaccion.toFixed(1)}/10)`,
      detalles: `Basado en ${motivoOptimo.cantidad} registros`
    });
  }

  // Recomendaciones generales de optimización
  const optimizaciones = generarOptimizaciones();
  optimizaciones.forEach(opt => recomendaciones.push(opt));

  return recomendaciones;
}

function analizarEficienciaTipo() {
  const tipoStats = {};
  
  registros.forEach(r => {
    if (!tipoStats[r.tipo]) {
      tipoStats[r.tipo] = {
        satisfaccionTotal: 0,
        precioTotal: 0,
        cantidadTotal: 0,
        registros: 0
      };
    }
    
    tipoStats[r.tipo].satisfaccionTotal += r.satisfaccion;
    tipoStats[r.tipo].precioTotal += r.precioTotal;
    tipoStats[r.tipo].cantidadTotal += r.cantidadGramos;
    tipoStats[r.tipo].registros++;
  });

  let mejorEficiencia = null;
  let maxEficiencia = 0;

  Object.keys(tipoStats).forEach(tipo => {
    const stats = tipoStats[tipo];
    if (stats.registros >= 2) { // Mínimo 2 registros
      const satisfaccionPromedio = stats.satisfaccionTotal / stats.registros;
      const precioPromedio = stats.precioTotal / stats.cantidadTotal;
      const eficiencia = satisfaccionPromedio / (precioPromedio / 100); // Eficiencia por cada $100
      
      if (eficiencia > maxEficiencia) {
        maxEficiencia = eficiencia;
        mejorEficiencia = {
          tipo,
          eficiencia,
          satisfaccionPromedio,
          precioPromedio
        };
      }
    }
  });

  return { mejor: mejorEficiencia };
}

function analizarProveedores() {
  const proveedorStats = {};
  
  registros.forEach(r => {
    if (!proveedorStats[r.proveedor]) {
      proveedorStats[r.proveedor] = {
        satisfaccionTotal: 0,
        precioTotal: 0,
        cantidadTotal: 0,
        registros: 0
      };
    }
    
    proveedorStats[r.proveedor].satisfaccionTotal += r.satisfaccion;
    proveedorStats[r.proveedor].precioTotal += r.precioTotal;
    proveedorStats[r.proveedor].cantidadTotal += r.cantidadGramos;
    proveedorStats[r.proveedor].registros++;
  });

  let mejorProveedor = null;
  let maxSatisfaccion = 0;

  Object.keys(proveedorStats).forEach(proveedor => {
    const stats = proveedorStats[proveedor];
    if (stats.registros >= 2) {
      const satisfaccionPromedio = stats.satisfaccionTotal / stats.registros;
      
      if (satisfaccionPromedio > maxSatisfaccion) {
        maxSatisfaccion = satisfaccionPromedio;
        mejorProveedor = {
          nombre: proveedor,
          satisfaccion: satisfaccionPromedio,
          registros: stats.registros,
          precioPromedio: stats.precioTotal / stats.cantidadTotal
        };
      }
    }
  });

  return mejorProveedor;
}

function analizarMetodos() {
  const metodoStats = {};
  
  registros.forEach(r => {
    if (!metodoStats[r.metodoConsumo]) {
      metodoStats[r.metodoConsumo] = {
        satisfaccionTotal: 0,
        cantidad: 0
      };
    }
    
    metodoStats[r.metodoConsumo].satisfaccionTotal += r.satisfaccion;
    metodoStats[r.metodoConsumo].cantidad++;
  });

  let mejorMetodo = null;
  let maxSatisfaccion = 0;

  Object.keys(metodoStats).forEach(metodo => {
    const stats = metodoStats[metodo];
    if (stats.cantidad >= 2) {
      const satisfaccionPromedio = stats.satisfaccionTotal / stats.cantidad;
      
      if (satisfaccionPromedio > maxSatisfaccion) {
        maxSatisfaccion = satisfaccionPromedio;
        mejorMetodo = {
          metodo,
          satisfaccion: satisfaccionPromedio,
          cantidad: stats.cantidad
        };
      }
    }
  });

  return mejorMetodo;
}

function analizarFrecuencia() {
  if (registros.length < 5) return { recomendacion: null };

  const hoy = new Date();
  const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const registrosRecientes = registros.filter(r => new Date(r.fecha) >= hace30Dias);
  const frecuenciaMensual = registrosRecientes.length;

  if (frecuenciaMensual > 25) {
    return {
      tipo: 'warning',
      icono: '⚠️',
      titulo: 'Frecuencia Muy Alta',
      recomendacion: 'Considera reducir la frecuencia de consumo para mantener efectividad',
      detalles: `${frecuenciaMensual} registros en los últimos 30 días`
    };
  } else if (frecuenciaMensual < 5) {
    return {
      tipo: 'info',
      icono: 'ℹ️',
      titulo: 'Uso Ocasional',
      recomendacion: 'Tu patrón de consumo es moderado, considera registrar más detalles para mejores insights',
      detalles: `${frecuenciaMensual} registros en los últimos 30 días`
    };
  } else {
    return {
      tipo: 'success',
      icono: '✅',
      titulo: 'Frecuencia Equilibrada',
      recomendacion: 'Mantienes un patrón de consumo balanceado',
      detalles: `${frecuenciaMensual} registros en los últimos 30 días`
    };
  }
}

function analizarEfectosSecundarios() {
  const efectosComunes = {};
  const recomendaciones = [];
  
  registros.forEach(r => {
    if (r.efectosSecundarios && r.efectosSecundarios.trim()) {
      const efectos = r.efectosSecundarios.toLowerCase().split(',').map(e => e.trim());
      efectos.forEach(efecto => {
        if (efecto) {
          if (!efectosComunes[efecto]) efectosComunes[efecto] = 0;
          efectosComunes[efecto]++;
        }
      });
    }
  });

  Object.keys(efectosComunes).forEach(efecto => {
    if (efectosComunes[efecto] >= 3) {
      let recomendacion = '';
      let icono = '⚕️';
      
      if (efecto.includes('ansiedad')) {
        recomendacion = 'Prueba cepas con mayor contenido de CBD para reducir ansiedad';
        icono = '😰';
      } else if (efecto.includes('sueño') || efecto.includes('insomnio')) {
        recomendacion = 'Considera cepas Índica para problemas de sueño';
        icono = '😴';
      } else if (efecto.includes('dolor')) {
        recomendacion = 'Cepas híbridas con CBD pueden ayudar mejor con el dolor';
        icono = '🩹';
      } else {
        recomendacion = `Efecto frecuente: ${efecto}. Considera ajustar dosis o método`;
      }
      
      recomendaciones.push({
        tipo: 'health',
        icono,
        titulo: 'Efecto Secundario Recurrente',
        descripcion: recomendacion,
        detalles: `Reportado ${efectosComunes[efecto]} veces`
      });
    }
  });

  return recomendaciones;
}

function analizarMotivosSatisfaccion() {
  const motivoStats = {};
  
  registros.forEach(r => {
    if (!motivoStats[r.motivo]) {
      motivoStats[r.motivo] = {
        satisfaccionTotal: 0,
        cantidad: 0
      };
    }
    
    motivoStats[r.motivo].satisfaccionTotal += r.satisfaccion;
    motivoStats[r.motivo].cantidad++;
  });

  let mejorMotivo = null;
  let maxSatisfaccion = 0;

  Object.keys(motivoStats).forEach(motivo => {
    const stats = motivoStats[motivo];
    if (stats.cantidad >= 2) {
      const satisfaccionPromedio = stats.satisfaccionTotal / stats.cantidad;
      
      if (satisfaccionPromedio > maxSatisfaccion) {
        maxSatisfaccion = satisfaccionPromedio;
        mejorMotivo = {
          motivo,
          satisfaccion: satisfaccionPromedio,
          cantidad: stats.cantidad
        };
      }
    }
  });

  return mejorMotivo;
}

function generarOptimizaciones() {
  const optimizaciones = [];
  
  // Análisis de satisfacción general
  const satisfaccionPromedio = registros.reduce((acc, r) => acc + r.satisfaccion, 0) / registros.length;
  
  if (satisfaccionPromedio < 7) {
    optimizaciones.push({
      tipo: 'improvement',
      icono: '📈',
      titulo: 'Oportunidad de Mejora',
      descripcion: `Tu satisfacción promedio es ${satisfaccionPromedio.toFixed(1)}/10. Considera experimentar con diferentes cepas o métodos`,
      detalles: 'Basado en todos tus registros'
    });
  }

  // Análisis de gastos
  const gastoTotal = registros.reduce((acc, r) => acc + r.precioTotal, 0);
  const gastoMensual = gastoTotal / (registros.length / 30) * 30; // Estimación mensual
  
  if (gastoMensual > 800) {
    optimizaciones.push({
      tipo: 'budget',
      icono: '💸',
      titulo: 'Optimización de Presupuesto',
      descripcion: `Gasto estimado mensual: $${gastoMensual.toFixed(0)}. Considera proveedores más económicos`,
      detalles: 'Revisa la sección de eficiencia para mejores opciones'
    });
  }

  return optimizaciones;
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
   Export PDF Function
   ========================= */
function exportarPDF() {
  if (!usuarioActual || registros.length === 0) {
    if (exportMsg) {
      exportMsg.textContent = "❌ No hay datos para exportar";
      exportMsg.style.color = "var(--danger-color)";
    }
    return;
  }

  if (exportMsg) {
    exportMsg.textContent = "📄 Generando PDF...";
    exportMsg.style.color = "var(--accent-primary)";
  }

  try {
    // Usar jsPDF para generar PDF real
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const fecha = new Date().toLocaleDateString('es-ES');
    const totalRegistros = registros.length;
    const gastoTotal = registros.reduce((sum, r) => sum + (Number(r.precioTotal) || 0), 0);
    const consumoTotal = registros.reduce((sum, r) => sum + (Number(r.cantidadGramos) || 0), 0);
    const satisfaccionPromedio = totalRegistros > 0 
      ? registros.reduce((sum, r) => sum + (Number(r.satisfaccion) || 0), 0) / totalRegistros 
      : 0;

    const datosSocial = cargarDatosSocial();

    // Configurar fuente y colores
    doc.setFont("helvetica");
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(9, 105, 218);
    doc.text("🌿 Control Cannabis Pro", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.text(`Reporte Completo de ${usuarioActual}`, 105, 30, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generado el: ${fecha}`, 105, 40, { align: "center" });
    
    // Línea separadora
    doc.line(20, 45, 190, 45);
    
    let yPos = 55;
    
    // Resumen ejecutivo
    doc.setFontSize(12);
    doc.setTextColor(9, 105, 218);
    doc.text("📊 Resumen Ejecutivo", 20, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Registros: ${totalRegistros}`, 20, yPos);
    doc.text(`Gasto Total: $${gastoTotal.toFixed(2)}`, 70, yPos);
    yPos += 7;
    doc.text(`Consumo Total: ${consumoTotal.toFixed(1)}g`, 20, yPos);
    doc.text(`Satisfacción Promedio: ${satisfaccionPromedio.toFixed(1)}/10`, 70, yPos);
    yPos += 15;
    
    // Historial de registros
    doc.setFontSize(12);
    doc.setTextColor(9, 105, 218);
    doc.text("📋 Historial de Registros", 20, yPos);
    yPos += 10;
    
    // Tabla de registros (simplificada para PDF)
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    
    // Headers de tabla
    doc.text("Fecha", 20, yPos);
    doc.text("Tipo", 45, yPos);
    doc.text("Cantidad", 70, yPos);
    doc.text("Precio", 95, yPos);
    doc.text("Satisfacción", 120, yPos);
    doc.text("Motivo", 150, yPos);
    yPos += 5;
    
    // Línea bajo headers
    doc.line(20, yPos, 190, yPos);
    yPos += 5;
    
    // Registros (máximo 15 para evitar desbordamiento)
    const registrosParaPDF = registros.slice(-15); // últimos 15 registros
    
    registrosParaPDF.forEach(r => {
      if (yPos > 270) { // Nueva página si es necesario
        doc.addPage();
        yPos = 20;
      }
      
      doc.text(r.fecha.slice(5), 20, yPos); // MM-DD
      doc.text(r.tipo.slice(0, 8), 45, yPos);
      doc.text(`${r.cantidadGramos}g`, 70, yPos);
      doc.text(`$${r.precioTotal.toFixed(0)}`, 95, yPos);
      doc.text(`${r.satisfaccion}/10`, 120, yPos);
      doc.text(r.motivo.slice(0, 12), 150, yPos);
      yPos += 7;
    });
    
    // Datos sociales si existen
    if (datosSocial.length > 0) {
      yPos += 10;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setTextColor(9, 105, 218);
      doc.text("🤝 Desempeño Social", 20, yPos);
      yPos += 10;
      
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      
      // Headers sociales
      doc.text("Fecha", 20, yPos);
      doc.text("Social", 50, yPos);
      doc.text("Laboral", 90, yPos);
      doc.text("Ánimo", 130, yPos);
      yPos += 5;
      
      doc.line(20, yPos, 190, yPos);
      yPos += 5;
      
      datosSocial.slice(-10).forEach(d => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(d.fecha.slice(5), 20, yPos);
        doc.text(d.interaccionesSociales.slice(0, 10), 50, yPos);
        doc.text(d.desempenoLaboral.slice(0, 10), 90, yPos);
        doc.text(d.estadoAnimo.slice(0, 10), 130, yPos);
        yPos += 7;
      });
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`© 2025 Control Cannabis Pro - ${usuarioActual}`, 105, 280, { align: "center" });
    doc.text("Desarrollado por JJ Solutions - Tecnología e Innovación", 105, 285, { align: "center" });
    
    // Descargar automáticamente
    const nombreArchivo = `Reporte_Cannabis_${usuarioActual}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nombreArchivo);
    
    // Mensaje de éxito
    if (exportMsg) {
      exportMsg.textContent = "✅ PDF descargado correctamente.";
      exportMsg.style.color = "var(--success-color)";
    }
    
  } catch (error) {
    console.error("Error al generar PDF:", error);
    if (exportMsg) {
      exportMsg.textContent = "❌ Error al generar PDF. Intenta de nuevo.";
      exportMsg.style.color = "var(--danger-color)";
    }
  }
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
  
  // Si ya es un número, devolverlo directamente
  if (typeof valor === 'number') return Math.max(0, Math.min(10, valor));
  
  valor = (valor + "").toLowerCase().trim();
  if (["baja", "bajo", "poca", "poco", "mala", "malo", "negativo"].includes(valor)) return 3;
  if (["media", "medio", "regular", "moderada", "moderado", "neutral"].includes(valor)) return 6;
  if (["alta", "alto", "buena", "bueno", "excelente", "muy buena", "positivo"].includes(valor)) return 9;
  const n = parseInt(valor, 10);
  if (!isNaN(n)) return Math.max(0, Math.min(10, n));
  return 5;
}

function mostrarSocialInsights() {
  if (!socialInsights) return;
  
  const datosSocial = cargarDatosSocial();
  if (datosSocial.length === 0) {
    socialInsights.innerHTML = "<p>No hay datos suficientes para generar insights.</p>";
    return;
  }

  const insights = generarInsightsSociales(datosSocial);
  
  let html = `
    <h4>🔍 Análisis de Bienestar Personal</h4>
    ${insights.map(insight => `
      <div class="social-insight-item ${insight.clase}">
        <div class="social-insight-icon">${insight.icono}</div>
        <div class="social-insight-content">
          <h4>${insight.titulo}</h4>
          <p>${insight.descripcion}</p>
        </div>
      </div>
    `).join('')}
  `;
  
  socialInsights.innerHTML = html;
}

function generarInsightsSociales(datos) {
  const insights = [];
  
  if (datos.length < 3) {
    insights.push({
      icono: 'ℹ️',
      titulo: 'Datos Insuficientes',
      descripcion: 'Registra al menos 3 evaluaciones para obtener análisis más detallados.',
      clase: ''
    });
    return insights;
  }

  // Calcular promedios
  const promedios = {
    interacciones: datos.reduce((acc, d) => acc + valorNumerico(d.interaccionesSociales), 0) / datos.length,
    productividad: datos.reduce((acc, d) => acc + valorNumerico(d.desempenoLaboral), 0) / datos.length,
    animo: datos.reduce((acc, d) => acc + valorNumerico(d.estadoAnimo), 0) / datos.length,
    sueno: datos.reduce((acc, d) => acc + valorNumerico(d.calidadSueno), 0) / datos.length,
    estres: datos.reduce((acc, d) => acc + valorNumerico(d.niveleEstres), 0) / datos.length,
    motivacion: datos.reduce((acc, d) => acc + valorNumerico(d.motivacionGeneral), 0) / datos.length,
  };

  // Análisis de tendencias (últimos vs primeros registros)
  const ultimos = datos.slice(-Math.max(1, Math.floor(datos.length / 3)));
  const primeros = datos.slice(0, Math.max(1, Math.floor(datos.length / 3)));
  
  const tendencias = {
    interacciones: (ultimos.reduce((acc, d) => acc + valorNumerico(d.interaccionesSociales), 0) / ultimos.length) - 
                   (primeros.reduce((acc, d) => acc + valorNumerico(d.interaccionesSociales), 0) / primeros.length),
    productividad: (ultimos.reduce((acc, d) => acc + valorNumerico(d.desempenoLaboral), 0) / ultimos.length) - 
                   (primeros.reduce((acc, d) => acc + valorNumerico(d.desempenoLaboral), 0) / primeros.length),
    animo: (ultimos.reduce((acc, d) => acc + valorNumerico(d.estadoAnimo), 0) / ultimos.length) - 
           (primeros.reduce((acc, d) => acc + valorNumerico(d.estadoAnimo), 0) / primeros.length),
  };

  // Insight sobre interacciones sociales
  if (promedios.interacciones >= 7) {
    insights.push({
      icono: '🤝',
      titulo: 'Vida Social Activa',
      descripcion: `Mantienes excelentes interacciones sociales (${promedios.interacciones.toFixed(1)}/10). ¡Sigue así!`,
      clase: 'social-metric-good'
    });
  } else if (promedios.interacciones < 5) {
    insights.push({
      icono: '😔',
      titulo: 'Oportunidad Social',
      descripcion: `Tus interacciones sociales están por debajo del promedio (${promedios.interacciones.toFixed(1)}/10). Considera actividades sociales.`,
      clase: 'social-metric-bad'
    });
  }

  // Insight sobre productividad
  if (promedios.productividad >= 7) {
    insights.push({
      icono: '💪',
      titulo: 'Alta Productividad',
      descripcion: `Tu productividad laboral es excelente (${promedios.productividad.toFixed(1)}/10). ¡Gran desempeño!`,
      clase: 'social-metric-good'
    });
  } else if (promedios.productividad < 5) {
    insights.push({
      icono: '📉',
      titulo: 'Productividad Baja',
      descripcion: `Tu productividad podría mejorar (${promedios.productividad.toFixed(1)}/10). Revisa tu rutina y hábitos.`,
      clase: 'social-metric-bad'
    });
  }

  // Insight sobre estado de ánimo
  if (promedios.animo >= 7) {
    insights.push({
      icono: '😊',
      titulo: 'Estado de Ánimo Positivo',
      descripcion: `Mantienes un excelente estado de ánimo (${promedios.animo.toFixed(1)}/10). ¡Fantástico!`,
      clase: 'social-metric-good'
    });
  } else if (promedios.animo < 5) {
    insights.push({
      icono: '😟',
      titulo: 'Estado de Ánimo Bajo',
      descripcion: `Tu estado de ánimo está por debajo del promedio (${promedios.animo.toFixed(1)}/10). Considera buscar apoyo.`,
      clase: 'social-metric-bad'
    });
  }

  // Insight sobre sueño
  if (promedios.sueno >= 7) {
    insights.push({
      icono: '😴',
      titulo: 'Buen Descanso',
      descripcion: `Tu calidad de sueño es buena (${promedios.sueno.toFixed(1)}/10). El descanso es clave para el bienestar.`,
      clase: 'social-metric-good'
    });
  } else if (promedios.sueno < 5) {
    insights.push({
      icono: '😪',
      titulo: 'Problemas de Sueño',
      descripcion: `Tu calidad de sueño necesita atención (${promedios.sueno.toFixed(1)}/10). Revisa tu higiene del sueño.`,
      clase: 'social-metric-bad'
    });
  }

  // Insight sobre estrés
  if (promedios.estres > 7) {
    insights.push({
      icono: '😰',
      titulo: 'Estrés Alto',
      descripcion: `Tus niveles de estrés son altos (${promedios.estres.toFixed(1)}/10). Considera técnicas de relajación.`,
      clase: 'social-metric-bad'
    });
  } else if (promedios.estres <= 4) {
    insights.push({
      icono: '😌',
      titulo: 'Estrés Controlado',
      descripcion: `Mantienes bien controlado el estrés (${promedios.estres.toFixed(1)}/10). ¡Excelente manejo!`,
      clase: 'social-metric-good'
    });
  }

  // Insight sobre motivación
  if (promedios.motivacion >= 7) {
    insights.push({
      icono: '🔥',
      titulo: 'Alta Motivación',
      descripcion: `Tu motivación general es excelente (${promedios.motivacion.toFixed(1)}/10). ¡Sigue adelante!`,
      clase: 'social-metric-good'
    });
  } else if (promedios.motivacion < 5) {
    insights.push({
      icono: '😴',
      titulo: 'Motivación Baja',
      descripcion: `Tu motivación podría mejorar (${promedios.motivacion.toFixed(1)}/10). Busca nuevas metas u objetivos.`,
      clase: 'social-metric-bad'
    });
  }

  // Análisis de tendencias
  if (tendencias.animo > 1) {
    insights.push({
      icono: '📈',
      titulo: 'Tendencia Positiva',
      descripcion: `Tu estado de ánimo ha mejorado notablemente en tus últimos registros. ¡Sigue así!`,
      clase: 'social-metric-good'
    });
  } else if (tendencias.animo < -1) {
    insights.push({
      icono: '📉',
      titulo: 'Tendencia Descendente',
      descripcion: `Tu estado de ánimo ha disminuido en registros recientes. Considera revisar qué ha cambiado.`,
      clase: 'social-metric-warning'
    });
  }

  // Correlación con consumo (si hay datos de registros)
  if (registros.length > 0 && datos.length > 3) {
    const correlacionConsumo = analizarCorrelacionConsumo(datos);
    if (correlacionConsumo) {
      insights.push(correlacionConsumo);
    }
  }

  return insights;
}

function analizarCorrelacionConsumo(datosSocial) {
  // Analizar si hay correlación entre frecuencia de consumo y bienestar social
  const fechasConsumo = registros.map(r => r.fecha);
  const fechasSocial = datosSocial.map(d => d.fecha);
  
  // Encontrar fechas comunes en ventanas de ±2 días
  let coincidencias = 0;
  let bienestarEnCoincidencias = 0;
  
  datosSocial.forEach(social => {
    const fechaSocial = new Date(social.fecha);
    const hayConsumo = fechasConsumo.some(fechaConsumo => {
      const fechaC = new Date(fechaConsumo);
      const diffDias = Math.abs((fechaSocial - fechaC) / (1000 * 60 * 60 * 24));
      return diffDias <= 2;
    });
    
    if (hayConsumo) {
      coincidencias++;
      bienestarEnCoincidencias += valorNumerico(social.estadoAnimo);
    }
  });

  if (coincidencias >= 3) {
    const promedioBienestarConConsumo = bienestarEnCoincidencias / coincidencias;
    const promedioBienestarGeneral = datosSocial.reduce((acc, d) => acc + valorNumerico(d.estadoAnimo), 0) / datosSocial.length;
    
    const diferencia = promedioBienestarConConsumo - promedioBienestarGeneral;
    
    if (diferencia > 0.5) {
      return {
        icono: '📊',
        titulo: 'Correlación Positiva',
        descripcion: `Tu estado de ánimo tiende a ser mejor en períodos cercanos al consumo (+${diferencia.toFixed(1)} puntos).`,
        clase: 'social-metric-good'
      };
    } else if (diferencia < -0.5) {
      return {
        icono: '⚠️',
        titulo: 'Correlación Negativa',
        descripcion: `Tu estado de ánimo tiende a ser menor en períodos cercanos al consumo (${diferencia.toFixed(1)} puntos).`,
        clase: 'social-metric-warning'
      };
    }
  }
  
  return null;
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
  let sumaSueno = 0;
  let sumaEstres = 0;
  let sumaMotivacion = 0;

  datosSocial.forEach((d) => {
    sumaInteracciones += valorNumerico(d.interaccionesSociales);
    sumaDesempeno += valorNumerico(d.desempenoLaboral);
    sumaEstado += valorNumerico(d.estadoAnimo);
    sumaSueno += valorNumerico(d.calidadSueno);
    sumaEstres += valorNumerico(d.niveleEstres);
    sumaMotivacion += valorNumerico(d.motivacionGeneral);
  });

  const promedioInteracciones = +(sumaInteracciones / total).toFixed(1);
  const promedioDesempeno = +(sumaDesempeno / total).toFixed(1);
  const promedioEstado = +(sumaEstado / total).toFixed(1);
  const promedioSueno = +(sumaSueno / total).toFixed(1);
  const promedioEstres = +(sumaEstres / total).toFixed(1);
  const promedioMotivacion = +(sumaMotivacion / total).toFixed(1);

  const ctx = ctxOf("graficoSocial");
  if (!ctx) return;

  chartDesempenoSocial = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Interacciones", "Productividad", "Ánimo", "Sueño", "Motivación", "Estrés (inv.)"],
      datasets: [
        {
          label: "Tu Bienestar",
          data: [promedioInteracciones, promedioDesempeno, promedioEstado, promedioSueno, promedioMotivacion, 10 - promedioEstres], // Estrés invertido para mejor visualización
          backgroundColor: "rgba(121, 192, 255, 0.2)",
          borderColor: "#79c0ff",
          borderWidth: 2,
          pointBackgroundColor: "#79c0ff",
          pointBorderColor: "#fff",
          pointRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: { 
            color: "#79c0ff", 
            stepSize: 2,
            backdropColor: "transparent",
          },
          grid: { color: "#79c0ff44" },
          pointLabels: { color: "#79c0ff", font: { size: 12 } },
        },
      },
      plugins: {
        legend: { 
          labels: { color: "#79c0ff" },
          position: 'bottom'
        },
        tooltip: {
          backgroundColor: "#79c0ffcc",
          titleColor: "#000",
          bodyColor: "#000",
          cornerRadius: 6,
          padding: 8,
          callbacks: {
            label: function(context) {
              let value = context.parsed.r;
              if (context.label === 'Estrés (inv.)') {
                value = 10 - value; // Mostrar valor real de estrés
                return `Estrés: ${value.toFixed(1)}/10`;
              }
              return `${context.label}: ${value.toFixed(1)}/10`;
            }
          }
        },
      },
      animation: { duration: 800, easing: "easeInOutQuad" },
    },
  });
}

function inicializarGraficoSocialTendencia() {
  if (chartSocialTendencia) {
    chartSocialTendencia.destroy();
    chartSocialTendencia = null;
  }

  const datosSocial = cargarDatosSocial();
  if (datosSocial.length < 2) return;

  // Ordenar por fecha
  const datosOrdenados = datosSocial.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  
  const labels = datosOrdenados.map(d => {
    const fecha = new Date(d.fecha);
    return fecha.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
  });

  const interacciones = datosOrdenados.map(d => valorNumerico(d.interaccionesSociales));
  const productividad = datosOrdenados.map(d => valorNumerico(d.desempenoLaboral));
  const animo = datosOrdenados.map(d => valorNumerico(d.estadoAnimo));
  const sueno = datosOrdenados.map(d => valorNumerico(d.calidadSueno));
  const estres = datosOrdenados.map(d => valorNumerico(d.niveleEstres));
  const motivacion = datosOrdenados.map(d => valorNumerico(d.motivacionGeneral));

  const ctx = ctxOf("graficoSocialTendencia");
  if (!ctx) return;

  chartSocialTendencia = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Estado de Ánimo",
          data: animo,
          borderColor: "#58a6ff",
          backgroundColor: "rgba(88, 166, 255, 0.1)",
          borderWidth: 3,
          fill: false,
          tension: 0.4,
        },
        {
          label: "Productividad",
          data: productividad,
          borderColor: "#238636",
          backgroundColor: "rgba(35, 134, 54, 0.1)",
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
        {
          label: "Calidad Sueño",
          data: sueno,
          borderColor: "#6f42c1",
          backgroundColor: "rgba(111, 66, 193, 0.1)",
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
        {
          label: "Motivación",
          data: motivacion,
          borderColor: "#20c997",
          backgroundColor: "rgba(32, 201, 151, 0.1)",
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
        {
          label: "Estrés",
          data: estres,
          borderColor: "#f85149",
          backgroundColor: "rgba(248, 81, 73, 0.1)",
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          borderDash: [5, 5], // Línea punteada para estrés
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      scales: {
        y: {
          min: 0,
          max: 10,
          ticks: { color: "#79c0ff", stepSize: 1 },
          grid: { color: "#79c0ff44", borderDash: [3, 3] },
          title: {
            display: true,
            text: 'Puntuación (1-10)',
            color: "#79c0ff"
          }
        },
        x: {
          ticks: { color: "#79c0ff" },
          grid: { display: false },
          title: {
            display: true,
            text: 'Tiempo',
            color: "#79c0ff"
          }
        },
      },
      plugins: {
        legend: { 
          labels: { color: "#79c0ff" },
          position: 'top'
        },
        tooltip: {
          backgroundColor: "#0d1117",
          titleColor: "#79c0ff",
          bodyColor: "#c9d1d9",
          borderColor: "#79c0ff",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          mode: 'index',
          intersect: false,
        },
      },
      animation: { duration: 1000, easing: "easeInOutQuart" },
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
    [chartSatisfaccion, chartConsumoMensual, chartCostoGramo, chartMetodo, chartMotivo, chartDesempenoSocial, chartSocialTendencia, chartDashboard]
      .forEach((ch) => {
        try { if (ch) ch.destroy(); } catch (e) {}
      });
    chartSatisfaccion = chartConsumoMensual = chartCostoGramo = chartMetodo = chartMotivo = chartDesempenoSocial = chartSocialTendencia = chartDashboard = null;
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
      interaccionesSociales: parseInt(document.getElementById("interaccionesSociales").value),
      desempenoLaboral: parseInt(document.getElementById("desempenoLaboral").value),
      estadoAnimo: parseInt(document.getElementById("estadoAnimo").value),
      calidadSueno: parseInt(document.getElementById("calidadSueno").value),
      niveleEstres: parseInt(document.getElementById("niveleEstres").value),
      motivacionGeneral: parseInt(document.getElementById("motivacionGeneral").value),
      notasSociales: document.getElementById("notasSociales").value.trim() || "",
    };

    const datosSocial = cargarDatosSocial();
    datosSocial.push(nuevoSocial);
    guardarDatosSocial(datosSocial);

    if (socialMsg) socialMsg.textContent = "✅ Evaluación de bienestar registrada correctamente.";
    socialForm.reset();

    mostrarRegistrosSociales();
    inicializarGraficoSocial();
    inicializarGraficoSocialTendencia();
    mostrarSocialInsights();
    setTimeout(resizeAllCharts, 50);
  });
}

// Theme toggle
if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
}

// Theme toggle móvil
if (themeToggleMobile) {
  themeToggleMobile.addEventListener("click", toggleTheme);
}

// Menú hamburguesa
if (hamburgerBtn) {
  hamburgerBtn.addEventListener("click", toggleMenuMovil);
}

// Navegación móvil
mobileNavButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    const tabId = btn.getAttribute("data-tab");
    cambiarTab(tabId);
  });
});

// Logout móvil
if (logoutBtnMobile) {
  logoutBtnMobile.addEventListener("click", () => {
    usuarioActual = null;
    localStorage.removeItem("usuarioActual");
    registros = [];
    activarTabs(false);
    cambiarTab("login-tab");
    if (recordsList) recordsList.innerHTML = "";
    if (recomendacionesBox) recomendacionesBox.innerHTML = "";
    if (loginMsg) loginMsg.textContent = "";
    // destruir gráficos
    [chartSatisfaccion, chartConsumoMensual, chartCostoGramo, chartMetodo, chartMotivo, chartDesempenoSocial, chartSocialTendencia, chartDashboard]
      .forEach((ch) => {
        try { if (ch) ch.destroy(); } catch (e) {}
      });
    chartSatisfaccion = chartConsumoMensual = chartCostoGramo = chartMetodo = chartMotivo = chartDesempenoSocial = chartSocialTendencia = chartDashboard = null;
  });
}

// Cerrar menú móvil al hacer clic fuera
document.addEventListener("click", (e) => {
  if (mobileNav && !mobileNav.contains(e.target) && !hamburgerBtn.contains(e.target)) {
    cerrarMenuMovil();
  }
});

// Export PDF event
if (exportPDFBtn) {
  exportPDFBtn.addEventListener("click", exportarPDF);
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

  // Mostrar botón de tema siempre
  if (themeToggle) {
    themeToggle.hidden = false;
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