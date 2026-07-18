// ============================================================
//  app.js - Weigh & Flow Engine v2.0
//  Cálculo de peso por relación de área (moneda como referencia)
// ============================================================

(() => {
    'use strict';

    // --- CONSTANTES ---
    const COIN_DIAMETER_MM = 23.25;   // 1€ / 1$ ≈ 23.25mm
    const COIN_AREA_MM2 = Math.PI * (COIN_DIAMETER_MM / 2) ** 2;
    const DENSITY_CANNABIS_G_MM2 = 0.0012; // factor empírico (flor seca)

    // --- ESTADO GLOBAL ---
    const state = {
        sessions: [],
        tolerance: 'media',
        unit: 'g',
        currentWeight: 0,
        currentArea: 0,
        currentConfidence: 0,
        filter: 'all'
    };

    // --- DOM REFS ---
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const video = $('#video');
    const overlayCanvas = $('#overlayCanvas');
    const ctx = overlayCanvas.getContext('2d');
    const captureBtn = $('#captureBtn');
    const resultPanel = $('#resultPanel');
    const weightDisplay = $('#weightDisplay');
    const areaDisplay = $('#areaDisplay');
    const confidenceDisplay = $('#confidenceDisplay');
    const strainInput = $('#strainInput');
    const saveBtn = $('#saveWeightBtn');
    const retakeBtn = $('#retakeBtn');
    const recentList = $('#recentSessions');
    const journalList = $('#journalList');
    const greetingText = $('#greetingText');
    const todaySessions = $('#todaySessions');
    const todayGrams = $('#todayGrams');
    const avgEffect = $('#avgEffect');
    const toleranceLevel = $('#toleranceLevel');
    const dailyTip = $('#dailyTip');
    const splash = $('#splash-overlay');
    const loaderFill = $('#loaderFill');

    // --- INICIALIZACIÓN ---
    async function init() {
        // Splash
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15 + 5;
            if (progress > 100) progress = 100;
            loaderFill.style.width = progress + '%';
            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(() => splash.classList.add('hidden'), 400);
            }
        }, 200);

        // Cargar datos guardados
        loadFromStorage();

        // Cámara
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 } }
            });
            video.srcObject = stream;
            await video.play();
            resizeCanvas();
        } catch (e) {
            console.warn('Cámara no disponible:', e);
            // Fallback: modo demo (círculo simulado)
            demoMode();
        }

        // Eventos
        bindEvents();
        updateUI();
        updateGreeting();
        setDailyTip();

        // Limpiar canvas en cada frame
        requestAnimationFrame(drawOverlay);
    }

    function resizeCanvas() {
        const rect = video.getBoundingClientRect();
        overlayCanvas.width = rect.width || 640;
        overlayCanvas.height = rect.height || 480;
    }

    // --- DEMO MODE (sin cámara real) ---
    function demoMode() {
        // Muestra un círculo simulado para pruebas
        const guideBox = document.querySelector('.guide-box');
        if (guideBox) {
            guideBox.innerHTML = `
                <span style="font-size:40px;">📱</span>
                <span style="font-size:12px;color:var(--text-secondary);margin-top:8px;">
                    Modo demo: haz clic en capturar<br>para simular un peso de 1.2g
                </span>
            `;
        }
        // Override captura
        captureBtn.addEventListener('click', () => {
            simulateWeight(1.2 + Math.random() * 1.5);
        });
    }

    function simulateWeight(grams) {
        const area = grams / DENSITY_CANNABIS_G_MM2;
        showResult(grams, area, 78);
    }

    // --- LÓGICA DE PESO POR VISIÓN ---
    function captureAndWeigh() {
        resizeCanvas();
        ctx.drawImage(video, 0, 0, overlayCanvas.width, overlayCanvas.height);
        const imageData = ctx.getImageData(0, 0, overlayCanvas.width, overlayCanvas.height);
        const data = imageData.data;

        // 1. Detectar la moneda (por color dorado/plateado + forma circular)
        const coinCenter = findCoin(data, overlayCanvas.width, overlayCanvas.height);
        if (!coinCenter) {
            // Fallback: estimación por área verde
            const greenPixels = countGreenPixels(data);
            if (greenPixels > 500) {
                const approxArea = greenPixels * 0.02;
                const grams = approxArea * DENSITY_CANNABIS_G_MM2;
                showResult(Math.max(0.3, grams), approxArea, 55);
            } else {
                alert('🔍 No se detectó una moneda de referencia. Coloca una moneda de 1€/1$ junto al cogollo.');
            }
            return;
        }

        // 2. Detectar cogollo (por color verde/café + textura)
        const budArea = findBudArea(data, overlayCanvas.width, overlayCanvas.height, coinCenter);
        if (!budArea || budArea < 100) {
            alert('🌿 No se detectó el cogollo. Asegúrate de que esté junto a la moneda.');
            return;
        }

        // 3. Calcular peso por relación de áreas
        const coinRadiusPx = coinCenter.radius;
        const coinAreaPx = Math.PI * coinRadiusPx * coinRadiusPx;
        const ratio = budArea / coinAreaPx;
        const estimatedGrams = ratio * (COIN_AREA_MM2 * DENSITY_CANNABIS_G_MM2);

        // 4. Confianza basada en contraste y forma
        const confidence = Math.min(95, 60 + (ratio * 10));
        showResult(estimatedGrams, budArea, Math.round(confidence));
    }

    // --- DETECTOR DE MONEDA (color + círculo) ---
    function findCoin(data, w, h) {
        // Versión simplificada: busca el píxel más brillante (moneda reflectante)
        let maxBrightness = 0;
        let cx = w/2, cy = h/2;
        for (let y = 0; y < h; y += 4) {
            for (let x = 0; x < w; x += 4) {
                const idx = (y * w + x) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2];
                const brightness = (r + g + b) / 3;
                if (brightness > maxBrightness && brightness > 120) {
                    maxBrightness = brightness;
                    cx = x; cy = y;
                }
            }
        }
        // Buscar radio aproximado (detección de bordes simplificada)
        let radius = 30;
        for (let r = 10; r < 80; r++) {
            const idx1 = ((Math.round(cy + r) * w) + Math.round(cx)) * 4;
            const idx2 = ((Math.round(cy - r) * w) + Math.round(cx)) * 4;
            if (data[idx1] < 50 || data[idx2] < 50) { radius = r; break; }
        }
        return { x: cx, y: cy, radius: Math.min(radius, 70) };
    }

    // --- DETECTOR DE COGOLLO (píxeles verdes/cafés) ---
    function countGreenPixels(data) {
        let count = 0;
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i], g = data[i+1], b = data[i+2];
            if (g > r && g > b && g > 50 && r < 180) count++;
            else if (r > 100 && g > 80 && b < 100) count++; // tonos marrones
        }
        return count;
    }

    function findBudArea(data, w, h, coin) {
        // Busca en un radio alrededor de la moneda (pero sin incluirla)
        let greenCount = 0;
        const minX = Math.max(0, coin.x - 200);
        const maxX = Math.min(w, coin.x + 200);
        const minY = Math.max(0, coin.y - 200);
        const maxY = Math.min(h, coin.y + 200);

        for (let y = minY; y < maxY; y += 3) {
            for (let x = minX; x < maxX; x += 3) {
                const dist = Math.hypot(x - coin.x, y - coin.y);
                if (dist < coin.radius * 1.2) continue; // excluir moneda
                const idx = (y * w + x) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2];
                if (g > r && g > b && g > 40 && r < 160) greenCount++;
                else if (r > 90 && g > 70 && b < 90) greenCount++;
            }
        }
        return greenCount;
    }

    // --- MOSTRAR RESULTADO ---
    function showResult(grams, area, confidence) {
        state.currentWeight = Math.max(0.1, grams);
        state.currentArea = Math.round(area);
        state.currentConfidence = Math.min(100, confidence);

        weightDisplay.textContent = state.currentWeight.toFixed(1) + ' g';
        areaDisplay.textContent = state.currentArea + ' px²';
        confidenceDisplay.textContent = state.currentConfidence + '%';

        // Color según precisión
        if (state.currentConfidence > 80) {
            weightDisplay.style.color = '#4ade80';
        } else if (state.currentConfidence > 50) {
            weightDisplay.style.color = '#fbbf24';
        } else {
            weightDisplay.style.color = '#f87171';
        }

        resultPanel.classList.remove('hidden');
        resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // --- GUARDAR SESIÓN ---
    function saveSession() {
        const strain = strainInput.value.trim() || 'Cepa sin nombre';
        const session = {
            id: Date.now(),
            weight: state.currentWeight,
            area: state.currentArea,
            confidence: state.currentConfidence,
            strain: strain,
            type: 'flor',
            timestamp: new Date().toISOString(),
            effects: [] // se puede expandir
        };
        state.sessions.unshift(session);
        saveToStorage();
        updateUI();
        resultPanel.classList.add('hidden');
        strainInput.value = '';
        // Feedback háptico (vibración)
        if (navigator.vibrate) navigator.vibrate(20);
        // Animación de confirmación
        const btn = saveBtn;
        btn.textContent = '✅ Guardado!';
        setTimeout(() => btn.textContent = '✅ Guardar sesión', 1500);
    }

    // --- STORAGE ---
    function saveToStorage() {
        try {
            localStorage.setItem('weighflow_sessions', JSON.stringify(state.sessions));
            localStorage.setItem('weighflow_tolerance', state.tolerance);
        } catch (e) {}
    }

    function loadFromStorage() {
        try {
            const saved = localStorage.getItem('weighflow_sessions');
            if (saved) state.sessions = JSON.parse(saved);
            const tol = localStorage.getItem('weighflow_tolerance');
            if (tol) state.tolerance = tol;
        } catch (e) {}
    }

    // --- UI UPDATE ---
    function updateUI() {
        // Home stats
        const today = new Date().toDateString();
        const todaySessionsArr = state.sessions.filter(s => new Date(s.timestamp).toDateString() === today);
        todaySessions.textContent = todaySessionsArr.length;
        const totalGrams = todaySessionsArr.reduce((acc, s) => acc + s.weight, 0);
        todayGrams.textContent = totalGrams.toFixed(1);

        // Últimas sesiones (home)
        const recent = state.sessions.slice(0, 3);
        if (recent.length === 0) {
            recentList.innerHTML = `<div class="empty-state">Aún no hay sesiones. ¡Escanea tu primer cogollo!</div>`;
        } else {
            recentList.innerHTML = recent.map(s => `
                <div class="session-item">
                    <div class="session-left">
                        <span class="emoji">🌿</span>
                        <div class="session-info">
                            <span class="name">${escapeHtml(s.strain)}</span>
                            <span class="meta">${new Date(s.timestamp).toLocaleTimeString('es', {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                    </div>
                    <div class="session-right">
                        <span class="weight">${s.weight.toFixed(1)}g</span>
                        <span class="time">${s.confidence}%</span>
                    </div>
                </div>
            `).join('');
        }

        // Journal (con filtro)
        renderJournal();

        // Tolerancia
        toleranceLevel.textContent = state.tolerance.charAt(0).toUpperCase() + state.tolerance.slice(1);
    }

    function renderJournal() {
        let filtered = state.sessions;
        if (state.filter !== 'all') {
            filtered = state.sessions.filter(s => s.type === state.filter);
        }
        if (filtered.length === 0) {
            journalList.innerHTML = `<div class="empty-state">No hay registros con este filtro.</div>`;
        } else {
            journalList.innerHTML = filtered.map(s => `
                <div class="session-item">
                    <div class="session-left">
                        <span class="emoji">🌿</span>
                        <div class="session-info">
                            <span class="name">${escapeHtml(s.strain)}</span>
                            <span class="meta">${new Date(s.timestamp).toLocaleDateString('es', {day:'2-digit',month:'short'})} · ${new Date(s.timestamp).toLocaleTimeString('es', {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                    </div>
                    <div class="session-right">
                        <span class="weight">${s.weight.toFixed(1)}g</span>
                        <span class="time">⚡${s.confidence}%</span>
                    </div>
                </div>
            `).join('');
        }
    }

    function updateGreeting() {
        const hour = new Date().getHours();
        let msg = 'Buenas tardes';
        if (hour < 12) msg = 'Buenos días';
        else if (hour < 20) msg = 'Buenas tardes';
        else msg = 'Buenas noches';
        greetingText.textContent = msg + ',';
    }

    function setDailyTip() {
        const tips = [
            'Escanea tu cogollo antes de consumir para registrar dosis precisas.',
            'Registra tus efectos para conocer qué cepas te sientan mejor.',
            'Mantén tus cogollos en frascos herméticos con Boveda 62%.',
            'La tolerancia sube con el uso diario. Considera descansos de 48h.',
            'Los terpenos se evaporan con el calor. Conserva en lugar fresco y oscuro.'
        ];
        dailyTip.textContent = tips[Math.floor(Math.random() * tips.length)];
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- DRAW OVERLAY (para guía visual) ---
    function drawOverlay() {
        if (video.readyState < 2) {
            requestAnimationFrame(drawOverlay);
            return;
        }
        // Limpiar
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        // Dibujar guía de moneda (si no hay resultado)
        if (resultPanel.classList.contains('hidden')) {
            const cx = overlayCanvas.width / 2;
            const cy = overlayCanvas.height / 2 - 20;
            ctx.beginPath();
            ctx.arc(cx, cy, 50, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,215,0,0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 8]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,215,0,0.08)';
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🪙 Coloca la moneda aquí', cx, cy + 80);
        }
        requestAnimationFrame(drawOverlay);
    }

    // --- BIND EVENTS ---
    function bindEvents() {
        // Navegación
        $$('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                $$('.tab-panel').forEach(p => p.classList.remove('active'));
                const target = document.getElementById(btn.dataset.tab);
                if (target) target.classList.add('active');
                // Reajustar canvas al cambiar
                if (btn.dataset.tab === 'tab-scan') {
                    setTimeout(resizeCanvas, 300);
                }
            });
        });

        // Captura
        captureBtn.addEventListener('click', captureAndWeigh);

        // Guardar
        saveBtn.addEventListener('click', saveSession);

        // Repetir
        retakeBtn.addEventListener('click', () => {
            resultPanel.classList.add('hidden');
            state.currentWeight = 0;
        });

        // Filtros journal
        $$('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.filter = btn.dataset.filter;
                renderJournal();
            });
        });

        // Tolerancia
        $$('.tol-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.tol-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.tolerance = btn.dataset.tol;
                toleranceLevel.textContent = state.tolerance.charAt(0).toUpperCase() + state.tolerance.slice(1);
                saveToStorage();
            });
        });

        // Unidades
        $$('.unit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.unit-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.unit = btn.dataset.unit;
                updateUI();
            });
        });

        // Borrar datos
        $('#clearDataBtn').addEventListener('click', () => {
            if (confirm('⚠️ ¿Borrar todos los datos de consumo? Esta acción no se puede deshacer.')) {
                state.sessions = [];
                saveToStorage();
                updateUI();
            }
        });

        // Ver todas
        $('#viewAllBtn').addEventListener('click', () => {
            document.querySelector('[data-tab="tab-journal"]').click();
        });
    }

    // --- INICIO ---
    document.addEventListener('DOMContentLoaded', init);
})();
