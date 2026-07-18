// ============================================================
//  Weigh & Flow - v2.1 (SIEMPRE FUNCIONA, con o sin cámara)
// ============================================================

(() => {
    'use strict';

    // --- ESTADO ---
    const state = {
        sessions: [],
        tolerance: 'media',
        filter: 'all',
        isDemo: true, // Por defecto usamos demo
        currentWeight: 0,
        currentArea: 0,
        currentConfidence: 0
    };

    // --- DOM REFS ---
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const splash = $('#splash-overlay');
    const loaderFill = $('#loaderFill');
    const splashStatus = $('#splashStatus');
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
    const demoBtn = $('#demoModeBtn');

    // --- INICIALIZACIÓN ---
    function init() {
        // Cargar datos
        loadFromStorage();

        // Actualizar UI
        updateUI();
        updateGreeting();
        setDailyTip();

        // Animar splash
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 10 + 5;
            if (progress > 100) progress = 100;
            loaderFill.style.width = progress + '%';
            
            if (progress >= 100) {
                clearInterval(interval);
                splashStatus.textContent = '✅ Listo!';
                setTimeout(() => {
                    splash.classList.add('hidden');
                }, 400);
            }
        }, 200);

        // Intentar cámara en segundo plano (no bloquea)
        tryInitCamera();

        // Eventos
        bindEvents();

        // Dibujar overlay
        drawOverlay();
    }

    // --- CÁMARA (no bloqueante) ---
    async function tryInitCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 640 } }
            });
            video.srcObject = stream;
            await video.play();
            video.style.display = 'block';
            state.isDemo = false;
            splashStatus.textContent = '📷 Cámara activa';
            resizeCanvas();
            console.log('✅ Cámara iniciada correctamente');
        } catch (e) {
            console.log('ℹ️ Modo demo activo (sin cámara)');
            state.isDemo = true;
            video.style.display = 'none';
            // Mostrar indicador visual
            const guideBox = $('#guideBox');
            if (guideBox) {
                guideBox.innerHTML = `
                    <span style="font-size:40px;">🧪</span>
                    <span style="font-size:14px;color:var(--text-secondary);margin-top:8px;">
                        Modo Demo<br>
                        <span style="font-size:12px;">Haz clic en 📷 para simular un peso</span>
                    </span>
                    <button id="demoModeBtn" class="demo-btn" style="margin-top:16px;background:rgba(139,124,247,0.2);border:1px solid rgba(139,124,247,0.3);color:#fff;padding:8px 20px;border-radius:40px;font-family:inherit;cursor:pointer;font-size:13px;pointer-events:auto;">
                        🧪 Simular peso aleatorio
                    </button>
                `;
                // Rebindear el botón
                const newDemoBtn = document.getElementById('demoModeBtn');
                if (newDemoBtn) {
                    newDemoBtn.addEventListener('click', () => {
                        const grams = 0.5 + Math.random() * 2.5;
                        showResult(grams, Math.round(200 + Math.random() * 800), Math.round(60 + Math.random() * 35));
                    });
                }
            }
        }
    }

    function resizeCanvas() {
        const rect = video.getBoundingClientRect();
        overlayCanvas.width = rect.width || 640;
        overlayCanvas.height = rect.height || 480;
    }

    // --- CAPTURAR PESO ---
    function captureAndWeigh() {
        if (state.isDemo) {
            // Simular peso
            const grams = 0.5 + Math.random() * 2.5;
            const area = Math.round(200 + Math.random() * 800);
            const confidence = Math.round(60 + Math.random() * 35);
            showResult(grams, area, confidence);
            return;
        }

        // Modo real (con cámara)
        if (!video.srcObject || video.readyState < 2) {
            alert('📷 La cámara no está lista. Usa el modo demo.');
            return;
        }

        resizeCanvas();
        ctx.drawImage(video, 0, 0, overlayCanvas.width, overlayCanvas.height);
        const imageData = ctx.getImageData(0, 0, overlayCanvas.width, overlayCanvas.height);
        const data = imageData.data;

        // Detectar moneda
        const coin = findCoin(data, overlayCanvas.width, overlayCanvas.height);
        if (!coin) {
            // Fallback: contar píxeles verdes
            const green = countGreen(data);
            if (green > 300) {
                const grams = Math.max(0.3, green * 0.003);
                showResult(grams, green, 50);
                return;
            }
            alert('🔍 No se detectó moneda. Coloca una moneda de 1€ junto al cogollo.');
            return;
        }

        // Detectar cogollo
        const bud = findBud(data, overlayCanvas.width, overlayCanvas.height, coin);
        if (!bud || bud < 80) {
            alert('🌿 No se detectó el cogollo. Asegúrate de que esté junto a la moneda.');
            return;
        }

        const coinAreaPx = Math.PI * coin.radius * coin.radius;
        const ratio = bud / coinAreaPx;
        const grams = ratio * (Math.PI * (23.25/2) ** 2 * 0.0012);
        const confidence = Math.min(92, 50 + ratio * 12);

        showResult(Math.max(0.2, grams), bud, Math.round(confidence));
    }

    // --- DETECTORES (simplificados) ---
    function findCoin(data, w, h) {
        let maxB = 0, cx = w/2, cy = h/2, found = false;
        for (let y = 20; y < h-20; y += 5) {
            for (let x = 20; x < w-20; x += 5) {
                const idx = (y * w + x) * 4;
                const b = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                if (b > maxB && b > 80) {
                    maxB = b; cx = x; cy = y; found = true;
                }
            }
        }
        if (!found) return null;
        let radius = 25;
        for (let r = 10; r < 80; r++) {
            const x1 = Math.min(w-1, Math.round(cx + r));
            const y1 = Math.min(h-1, Math.round(cy + r));
            const idx = (y1 * w + x1) * 4;
            if ((data[idx] + data[idx+1] + data[idx+2]) / 3 < 50 && r > 15) {
                radius = r; break;
            }
        }
        return { x: cx, y: cy, radius: Math.min(Math.max(radius, 18), 75) };
    }

    function countGreen(data) {
        let c = 0;
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i], g = data[i+1], b = data[i+2];
            if (g > r && g > b && g > 35 && r < 180) c++;
            else if (r > 80 && g > 60 && b < 100 && r < 190) c++;
        }
        return c;
    }

    function findBud(data, w, h, coin) {
        let c = 0;
        const minX = Math.max(10, coin.x - 220);
        const maxX = Math.min(w-10, coin.x + 220);
        const minY = Math.max(10, coin.y - 220);
        const maxY = Math.min(h-10, coin.y + 220);
        for (let y = minY; y < maxY; y += 3) {
            for (let x = minX; x < maxX; x += 3) {
                if (Math.hypot(x - coin.x, y - coin.y) < coin.radius * 1.3) continue;
                const idx = (y * w + x) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2];
                if (g > r && g > b && g > 30 && r < 180) c++;
                else if (r > 75 && g > 55 && b < 100 && r < 190) c++;
            }
        }
        return c;
    }

    // --- MOSTRAR RESULTADO ---
    function showResult(grams, area, confidence) {
        state.currentWeight = Math.max(0.1, grams);
        state.currentArea = area;
        state.currentConfidence = confidence;

        weightDisplay.textContent = state.currentWeight.toFixed(1) + ' g';
        areaDisplay.textContent = state.currentArea + ' px²';
        confidenceDisplay.textContent = state.currentConfidence + '%';

        if (state.currentConfidence > 75) weightDisplay.style.color = '#4ade80';
        else if (state.currentConfidence > 50) weightDisplay.style.color = '#fbbf24';
        else weightDisplay.style.color = '#f87171';

        resultPanel.classList.remove('hidden');
        resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (navigator.vibrate) navigator.vibrate(15);
    }

    // --- GUARDAR ---
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
        saveBtn.textContent = '✅ Guardado!';
        setTimeout(() => saveBtn.textContent = '✅ Guardar sesión', 1500);
    }

    // --- STORAGE ---
    function saveToStorage() {
        try {
            localStorage.setItem('wf_sessions', JSON.stringify(state.sessions));
            localStorage.setItem('wf_tolerance', state.tolerance);
        } catch(e) {}
    }

    function loadFromStorage() {
        try {
            const s = localStorage.getItem('wf_sessions');
            if (s) state.sessions = JSON.parse(s);
            const t = localStorage.getItem('wf_tolerance');
            if (t) state.tolerance = t;
        } catch(e) {}
    }

    // --- UI ---
    function updateUI() {
        const today = new Date().toDateString();
        const todayArr = state.sessions.filter(s => new Date(s.timestamp).toDateString() === today);
        todaySessions.textContent = todayArr.length;
        todayGrams.textContent = todayArr.reduce((a, s) => a + s.weight, 0).toFixed(1);

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
        const h = new Date().getHours();
        let msg = 'Buenas tardes';
        if (h < 12) msg = 'Buenos días';
        else if (h < 20) msg = 'Buenas tardes';
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

    function escapeHtml(t) {
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    // --- DRAW OVERLAY ---
    function drawOverlay() {
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        if (resultPanel.classList.contains('hidden') && !state.isDemo && video.style.display !== 'none') {
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

    // --- EVENTOS ---
    function bindEvents() {
        // Navegación
        $$('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                $$('.tab-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(btn.dataset.tab).classList.add('active');
                if (btn.dataset.tab === 'tab-scan') setTimeout(resizeCanvas, 300);
            });
        });

        // Capturar
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
                updateUI();
            });
        });

        // Borrar
        $('#clearDataBtn').addEventListener('click', () => {
            if (confirm('⚠️ ¿Borrar todos los datos?')) {
                state.sessions = [];
                saveToStorage();
                updateUI();
            }
        });

        // Ver todas
        $('#viewAllBtn').addEventListener('click', () => {
            document.querySelector('[data-tab="tab-journal"]').click();
        });

        // Demo button (si existe)
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                const grams = 0.5 + Math.random() * 2.5;
                showResult(grams, Math.round(200 + Math.random() * 800), Math.round(60 + Math.random() * 35));
            });
        }
    }

    // --- INICIO ---
    document.addEventListener('DOMContentLoaded', init);
})();
