// ============================================================
//  app.js - Weigh & Flow Engine v2.1 (con timeout de seguridad)
// ============================================================

(() => {
    'use strict';

    // --- CONSTANTES ---
    const COIN_DIAMETER_MM = 23.25;
    const COIN_AREA_MM2 = Math.PI * (COIN_DIAMETER_MM / 2) ** 2;
    const DENSITY_CANNABIS_G_MM2 = 0.0012;
    const CAMERA_TIMEOUT = 4000; // 4 segundos máximo

    // --- ESTADO GLOBAL ---
    const state = {
        sessions: [],
        tolerance: 'media',
        unit: 'g',
        currentWeight: 0,
        currentArea: 0,
        currentConfidence: 0,
        filter: 'all',
        cameraReady: false,
        isDemo: false
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
    const splashStatus = $('#splashStatus');
    const skipBtn = $('#skipCameraBtn');

    let cameraStream = null;
    let splashHidden = false;

    // --- INICIALIZACIÓN ---
    async function init() {
        // Cargar datos guardados
        loadFromStorage();

        // Actualizar UI con datos guardados
        updateUI();
        updateGreeting();
        setDailyTip();

        // Iniciar splash y cámara con timeout
        startSplash();

        try {
            await Promise.race([
                initCamera(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('TIMEOUT')), CAMERA_TIMEOUT)
                )
            ]);
            // Si llegamos aquí, la cámara funciona
            state.cameraReady = true;
            splashStatus.textContent = '✅ Cámara lista';
            await sleep(400);
            hideSplash();
        } catch (err) {
            console.warn('Cámara no disponible:', err.message);
            splashStatus.textContent = '⚠️ Sin acceso a cámara';
            skipBtn.classList.add('visible');
            // Esperamos a que el usuario decida, pero no bloqueamos
            // La app ya está funcional con datos guardados
        }

        // Eventos
        bindEvents();
        requestAnimationFrame(drawOverlay);
    }

    function startSplash() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 8 + 3;
            if (progress > 100) progress = 100;
            loaderFill.style.width = progress + '%';
            if (progress >= 100 && state.cameraReady) {
                clearInterval(interval);
                if (!splashHidden) hideSplash();
            }
        }, 150);
        // Si pasa el timeout, el loader se llena igual
        setTimeout(() => {
            clearInterval(interval);
            if (loaderFill.style.width !== '100%') {
                loaderFill.style.width = '100%';
            }
        }, CAMERA_TIMEOUT + 500);
    }

    function hideSplash() {
        if (splashHidden) return;
        splashHidden = true;
        splash.classList.add('hidden');
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // --- INICIALIZAR CÁMARA ---
    async function initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment', 
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            cameraStream = stream;
            video.srcObject = stream;
            await video.play();
            resizeCanvas();
            state.cameraReady = true;
            return true;
        } catch (e) {
            throw new Error('Camera access denied');
        }
    }

    function resizeCanvas() {
        const rect = video.getBoundingClientRect();
        overlayCanvas.width = rect.width || 640;
        overlayCanvas.height = rect.height || 480;
    }

    // --- MODO DEMO ---
    function enableDemoMode() {
        state.isDemo = true;
        splashStatus.textContent = '🔄 Modo demostración activo';
        skipBtn.classList.remove('visible');
        
        // Modificar la guía visual
        const guideBox = document.querySelector('.guide-box');
        if (guideBox) {
            guideBox.innerHTML = `
                <span style="font-size:40px;">🧪</span>
                <span style="font-size:13px;color:var(--text-secondary);margin-top:8px;">
                    Modo Demo activo<br>
                    <span style="font-size:11px;">Haz clic en capturar para simular un peso</span>
                </span>
            `;
        }

        // Ocultar splash después de 1s
        setTimeout(() => {
            if (!splashHidden) hideSplash();
        }, 1000);
    }

    // --- LÓGICA DE PESO POR VISIÓN ---
    function captureAndWeigh() {
        if (state.isDemo) {
            const grams = 0.8 + Math.random() * 2.2;
            const area = grams / DENSITY_CANNABIS_G_MM2;
            showResult(grams, area, Math.round(65 + Math.random() * 30));
            return;
        }

        if (!state.cameraReady || !video.srcObject) {
            alert('📷 La cámara no está disponible. Usa el modo demo.');
            return;
        }

        resizeCanvas();
        ctx.drawImage(video, 0, 0, overlayCanvas.width, overlayCanvas.height);
        const imageData = ctx.getImageData(0, 0, overlayCanvas.width, overlayCanvas.height);
        const data = imageData.data;

        // 1. Detectar moneda
        const coinCenter = findCoin(data, overlayCanvas.width, overlayCanvas.height);
        if (!coinCenter) {
            const greenPixels = countGreenPixels(data);
            if (greenPixels > 500) {
                const approxArea = greenPixels * 0.02;
                const grams = approxArea * DENSITY_CANNABIS_G_MM2;
                showResult(Math.max(0.3, grams), approxArea, 50);
                return;
            }
            alert('🔍 No se detectó una moneda de referencia. Coloca una moneda de 1€/1$ junto al cogollo.');
            return;
        }

        // 2. Detectar cogollo
        const budArea = findBudArea(data, overlayCanvas.width, overlayCanvas.height, coinCenter);
        if (!budArea || budArea < 100) {
            alert('🌿 No se detectó el cogollo. Asegúrate de que esté junto a la moneda.');
            return;
        }

        // 3. Calcular peso
        const coinRadiusPx = coinCenter.radius;
        const coinAreaPx = Math.PI * coinRadiusPx * coinRadiusPx;
        const ratio = budArea / coinAreaPx;
        const estimatedGrams = ratio * (COIN_AREA_MM2 * DENSITY_CANNABIS_G_MM2);

        const confidence = Math.min(92, 55 + (ratio * 12));
        showResult(Math.max(0.2, estimatedGrams), budArea, Math.round(confidence));
    }

    // --- DETECTOR DE MONEDA ---
    function findCoin(data, w, h) {
        let maxBrightness = 0;
        let cx = w/2, cy = h/2;
        let found = false;
        for (let y = 20; y < h - 20; y += 4) {
            for (let x = 20; x < w - 20; x += 4) {
                const idx = (y * w + x) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2];
                const brightness = (r + g + b) / 3;
                if (brightness > maxBrightness && brightness > 100) {
                    maxBrightness = brightness;
                    cx = x; cy = y;
                    found = true;
                }
            }
        }
        if (!found) return null;

        let radius = 25;
        for (let r = 10; r < 80; r++) {
            const x1 = Math.min(w-1, Math.round(cx + r));
            const x2 = Math.max(0, Math.round(cx - r));
            const y1 = Math.min(h-1, Math.round(cy + r));
            const y2 = Math.max(0, Math.round(cy - r));
            const idx1 = (y1 * w + x1) * 4;
            const idx2 = (y2 * w + x2) * 4;
            if ((data[idx1] < 60 || data[idx2] < 60) && r > 15) {
                radius = r;
                break;
            }
        }
        return { x: cx, y: cy, radius: Math.min(Math.max(radius, 18), 75) };
    }

    // --- DETECTOR DE PÍXELES VERDES ---
    function countGreenPixels(data) {
        let count = 0;
        for (let i = 0; i < data.length; i += 12) {
            const r = data[i], g = data[i+1], b = data[i+2];
            if (g > r && g > b && g > 40 && r < 180) count++;
            else if (r > 90 && g > 70 && b < 100 && r < 180) count++;
        }
        return count;
    }

    function findBudArea(data, w, h, coin) {
        let greenCount = 0;
        const minX = Math.max(20, coin.x - 220);
        const maxX = Math.min(w - 20, coin.x + 220);
        const minY = Math.max(20, coin.y - 220);
        const maxY = Math.min(h - 20, coin.y + 220);

        for (let y = minY; y < maxY; y += 3) {
            for (let x = minX; x < maxX; x += 3) {
                const dist = Math.hypot(x - coin.x, y - coin.y);
                if (dist < coin.radius * 1.3) continue;
                const idx = (y * w + x) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2];
                if (g > r && g > b && g > 35 && r < 170) greenCount++;
                else if (r > 85 && g > 65 && b < 95 && r < 180) greenCount++;
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

        if (state.currentConfidence > 75) {
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
            timestamp: new Date().toISOString()
        };
        state.sessions.unshift(session);
        saveToStorage();
        updateUI();
        resultPanel.classList.add('hidden');
        strainInput.value = '';
        if (navigator.vibrate) navigator.vibrate(20);
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
        const today = new Date().toDateString();
        const todaySessionsArr = state.sessions.filter(s => new Date(s.timestamp).toDateString() === today);
        todaySessions.textContent = todaySessionsArr.length;
        const totalGrams = todaySessionsArr.reduce((acc, s) => acc + s.weight, 0);
        todayGrams.textContent = totalGrams.toFixed(1);

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

        renderJournal();
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

    // --- DRAW OVERLAY ---
    function drawOverlay() {
        if (video.readyState < 2 && !state.isDemo) {
            requestAnimationFrame(drawOverlay);
            return;
        }
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        if (resultPanel.classList.contains('hidden') && !state.isDemo) {
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

        // Filtros
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

        // BOTÓN SKIP (modo demo)
        skipBtn.addEventListener('click', enableDemoMode);
    }

    // --- INICIO ---
    document.addEventListener('DOMContentLoaded', init);
})();
