/**
     * =================================================================================
     * GEMA M365 LIZENZ-MONITOR – MVP (mit Historiensuche & Aktivitätsgrafik)
     * =================================================================================
     */

    // ---------------------------------------------------------------
    // MOCK-DATEN (10 Lizenzen)
    // ---------------------------------------------------------------
    const mockLicenses = [
        { id: 1,  name: "Visio Professional",        sku: "VISIO_P1",           total: 50,  used: 49, blocked: false, trend: +2 },
        { id: 2,  name: "Project Plan 3",            sku: "PROJECT_P3",         total: 20,  used: 12, blocked: false, trend: 0 },
        { id: 3,  name: "Power BI Pro",              sku: "POWER_BI_PRO",       total: 100, used: 85, blocked: false, trend: +4 },
        { id: 4,  name: "Adobe Acrobat Pro (Custom)",sku: "ADOBE_PRO",          total: 30,  used: 30, blocked: true,  trend: 0 },
        { id: 5,  name: "Microsoft 365 E5",          sku: "M365_E5",            total: 200, used: 178, blocked: false, trend: +1 },
        { id: 6,  name: "Exchange Online Plan 2",    sku: "EXO_P2",             total: 80,  used: 72, blocked: false, trend: +3 },
        { id: 7,  name: "SharePoint Online Plan 2",  sku: "SPO_P2",             total: 60,  used: 58, blocked: false, trend: 0 },
        { id: 8,  name: "Teams Phone Standard",      sku: "TEAMS_PHONE",        total: 40,  used: 39, blocked: false, trend: +1 },
        { id: 9,  name: "Defender for Office 365 P2",sku: "DEFENDER_O365_P2",   total: 120, used: 90, blocked: false, trend: +5 },
        { id: 10, name: "Information Protection",    sku: "AIP_P2",             total: 150, used: 140,blocked: false, trend: +2 }
    ];
    const BASE_LICENSES = mockLicenses.map(lic => ({ ...lic, source: 'm365' }));
    const CUSTOM_PACKAGES_STORAGE_KEY = 'licenseMonitor.customPackages.v1';

    // ---------------------------------------------------------------
    // MOCK-HISTORIE (zufällige Einträge über 30 Tage)
    // ---------------------------------------------------------------
    function generateMockHistory() {
        const baseDate = new Date();
        const users = [
            "max.muster@gema.de", "anna.schmidt@gema.de", "tom.weber@gema.de",
            "lisa.meier@gema.de", "jan.becker@gema.de", "sarah.klein@gema.de"
        ];
        const reasonsApproved = "Freie Lizenz vorhanden";
        const reasonsDenied = ["Keine freien Lizenzen", "Pool erschöpft", "Wartungsfenster"];
        
        function randomDate(daysBack = 30) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
            d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
            return d;
        }

        const entries = [];
        BASE_LICENSES.forEach(lic => {
            const count = Math.floor(Math.random() * 5) + 2; // 2-6 Einträge
            for (let i = 0; i < count; i++) {
                const date = randomDate();
                const isDenied = lic.blocked || (lic.used >= lic.total) || Math.random() < 0.3;
                const result = isDenied ? "denied" : "approved";
                const reason = result === "approved"
                    ? reasonsApproved
                    : reasonsDenied[Math.floor(Math.random() * reasonsDenied.length)] + ` (${lic.used}/${lic.total})`;
                entries.push({
                    time: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`,
                    user: users[Math.floor(Math.random() * users.length)],
                    package: lic.name,
                    sku: lic.sku,
                    result: result,
                    reason: reason,
                    requestId: `REQ-${Math.floor(1000 + Math.random() * 9000)}`
                });
            }
        });
        entries.sort((a, b) => new Date(b.time) - new Date(a.time));
        return entries;
    }
    const mockHistory = generateMockHistory();

    // ---------------------------------------------------------------
    // MOCK-LOGS
    // ---------------------------------------------------------------
    const mockLogs = [
        { time: "11:34:01", level: "INFO",    msg: "AutoApprover Timer ausgelöst." },
        { time: "11:34:02", level: "INFO",    msg: "1 neue PendingApproval-Anfrage für VISIO_P1 (max.muster@gema.de)." },
        { time: "11:34:03", level: "SUCCESS", msg: "Bestand ausreichend: 2 frei. Genehmigung erteilt (REQ-4821)." },
        { time: "09:12:01", level: "INFO",    msg: "AutoApprover Timer ausgelöst." },
        { time: "09:12:02", level: "INFO",    msg: "1 neue PendingApproval-Anfrage für ADOBE_PRO (anna.schmidt@gema.de)." },
        { time: "09:12:03", level: "WARN",    msg: "Bestand erschöpft (0/30). Blockiere Anfrage." },
        { time: "09:12:04", level: "SUCCESS", msg: "Ablehnung gesendet mit Grund: 'Keine Lizenzen verfügbar'." },
        { time: "09:12:05", level: "ERROR",   msg: "Teams-Webhook-Fehler (401). Bitte App Settings prüfen." },
        { time: "10:00:00", level: "INFO",    msg: "Logic App Health Check: OK. Latenz 120ms." }
    ];

    // ---------------------------------------------------------------
    // GLOBALER ZUSTAND
    // ---------------------------------------------------------------
    let customLicensePackages = loadCustomPackages();
    let currentLicenses = getLicenseCatalog();
    let currentHistory = [...mockHistory];
    let currentLogs = [...mockLogs];
    let thresholds = JSON.parse(localStorage.getItem('licenseThresholds')) || {};
    const DEFAULT_THRESHOLD = 80;
    let autoApproverActive = localStorage.getItem('autoApproverActive') !== 'false';
    let logPaused = false;
    let autoRefreshInterval = null;
    let logicAppOnline = true;
    let currentLicenseChart = null; // Referenz auf Chart.js-Instanz

    // ---------------------------------------------------------------
    // BACKEND-SIMULATIONSFUNKTIONEN
    // ---------------------------------------------------------------
    async function fetchLicenses() {
        showToast('Lade Lizenzen...', 'info');
        await new Promise(resolve => setTimeout(resolve, 300));
        return getLicenseCatalog();
    }

    async function fetchHistory() {
        await new Promise(resolve => setTimeout(resolve, 200));
        return [...currentHistory];
    }

    async function fetchLogs() {
        await new Promise(resolve => setTimeout(resolve, 150));
        return [...mockLogs];
    }

    async function saveThresholds(newThresholds) {
        await new Promise(resolve => setTimeout(resolve, 200));
        thresholds = newThresholds;
        persistThresholds();
        showToast('Schwellwerte gespeichert', 'success');
    }

    function getLicenseCatalog() {
        return [...BASE_LICENSES, ...customLicensePackages].map(lic => ({ ...lic }));
    }

    function loadCustomPackages() {
        try {
            const stored = JSON.parse(localStorage.getItem(CUSTOM_PACKAGES_STORAGE_KEY) || '[]');
            if (!Array.isArray(stored)) return [];
            return stored.map(normalizeStoredCustomPackage).filter(Boolean);
        } catch (error) {
            console.warn('Eigene Pakete konnten nicht geladen werden.', error);
            return [];
        }
    }

    function normalizeStoredCustomPackage(pkg) {
        if (!pkg || typeof pkg !== 'object') return null;
        const id = Number(pkg.id);
        const name = String(pkg.name || '').trim();
        const sku = normalizeSku(pkg.sku || '');
        const total = Math.max(1, parseInt(pkg.total, 10) || 1);
        const used = Math.min(total, Math.max(0, parseInt(pkg.used, 10) || 0));
        if (!Number.isFinite(id) || !name || !sku) return null;

        return {
            id,
            name,
            sku,
            total,
            used,
            blocked: Boolean(pkg.blocked),
            trend: Number(pkg.trend) || 0,
            source: 'manual',
            createdAt: pkg.createdAt || new Date().toISOString(),
            updatedAt: pkg.updatedAt || new Date().toISOString()
        };
    }

    function persistCustomPackages() {
        localStorage.setItem(CUSTOM_PACKAGES_STORAGE_KEY, JSON.stringify(customLicensePackages));
    }

    function persistThresholds() {
        localStorage.setItem('licenseThresholds', JSON.stringify(thresholds));
    }

    async function createCustomPackage(packageData) {
        await new Promise(resolve => setTimeout(resolve, 150));
        const packageId = Date.now();
        const newPackage = {
            id: packageId,
            name: packageData.name,
            sku: packageData.sku,
            total: packageData.total,
            used: packageData.used,
            blocked: packageData.blocked,
            trend: 0,
            source: 'manual',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        customLicensePackages = [...customLicensePackages, newPackage];
        thresholds[packageId] = packageData.threshold;
        persistCustomPackages();
        persistThresholds();
        currentLicenses = getLicenseCatalog();
        return newPackage;
    }

    async function removeCustomPackage(packageId) {
        await new Promise(resolve => setTimeout(resolve, 150));
        const numericId = Number(packageId);
        customLicensePackages = customLicensePackages.filter(pkg => pkg.id !== numericId);
        delete thresholds[numericId];
        persistCustomPackages();
        persistThresholds();
        currentLicenses = getLicenseCatalog();
    }

    // ---------------------------------------------------------------
    // UI-HILFEN
    // ---------------------------------------------------------------
    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function normalizeSku(value) {
        return String(value || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '_');
    }

    function getUsagePercent(license) {
        if (!license || !license.total) return 0;
        return (license.used / license.total) * 100;
    }

    function getFreeCount(license) {
        return Math.max(0, (license.total || 0) - (license.used || 0));
    }

    function parseThreshold(value, fallback = DEFAULT_THRESHOLD) {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(100, Math.max(1, parsed));
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        container.className = `toast px-4 py-3 rounded shadow-lg font-medium text-sm ${
            type === 'success' ? 'bg-emerald-600 text-white' :
            type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
        }`;
        container.textContent = message;
        container.classList.remove('hidden');
        setTimeout(() => container.classList.add('hidden'), 3000);
    }

    function dismissBanner() {
        document.getElementById('critical-banner').classList.add('hidden');
    }

    function updateCriticalBanner() {
        const high = currentLicenses.filter(l => getUsagePercent(l) >= (thresholds[l.id] || DEFAULT_THRESHOLD));
        const banner = document.getElementById('critical-banner');
        if (high.length > 0) {
            banner.classList.remove('hidden');
            document.getElementById('critical-banner-text').textContent =
                `⚠️ ${high.length} Lizenzpool(s) über dem Schwellwert – Zuweisungen könnten blockiert werden.`;
        } else {
            banner.classList.add('hidden');
        }
    }

    function updateKPIs() {
        const total = currentLicenses.length;
        const critical = currentLicenses.filter(l => getUsagePercent(l) >= (thresholds[l.id] || DEFAULT_THRESHOLD)).length;
        document.getElementById('kpi-total').textContent = total;
        document.getElementById('kpi-critical').textContent = critical;
        document.getElementById('critical-indicator').style.display = critical > 0 ? 'inline-block' : 'none';
        document.getElementById('threshold-display').textContent = Object.values(thresholds)[0] || DEFAULT_THRESHOLD;
    }

    function updateApproverStatusUI() {
        const dot = document.getElementById('approver-dot');
        const text = document.getElementById('approver-status-text');
        const toggleBtn = document.getElementById('toggle-approver-btn');
        const toggleText = document.getElementById('toggle-approver-text');
        const globalStatus = document.getElementById('approver-global-status');
        if (autoApproverActive) {
            dot.className = 'w-3 h-3 rounded-full bg-emerald-500';
            text.textContent = 'Aktiv';
            text.className = 'font-semibold text-emerald-700';
            if (toggleBtn) {
                toggleBtn.className = 'btn-danger px-4 py-2 rounded font-medium text-sm';
                toggleText.textContent = 'Auto-Approver deaktivieren';
            }
            if (globalStatus) globalStatus.innerHTML = 'Derzeit: <strong>Aktiv</strong>';
        } else {
            dot.className = 'w-3 h-3 rounded-full bg-red-500';
            text.textContent = 'Inaktiv';
            text.className = 'font-semibold text-red-700';
            if (toggleBtn) {
                toggleBtn.className = 'bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-medium text-sm';
                toggleText.textContent = 'Auto-Approver aktivieren';
            }
            if (globalStatus) globalStatus.innerHTML = 'Derzeit: <strong>Inaktiv</strong>';
        }
    }

    function updateLogicAppStatusUI() {
        const dot = document.getElementById('logicapp-dot');
        const text = document.getElementById('logicapp-status-text');
        if (logicAppOnline) {
            dot.className = 'w-3 h-3 rounded-full bg-emerald-500 animate-pulse';
            text.textContent = 'Online';
            text.className = 'font-semibold text-emerald-700';
        } else {
            dot.className = 'w-3 h-3 rounded-full bg-red-500';
            text.textContent = 'Offline';
            text.className = 'font-semibold text-red-700';
        }
    }

    // ---------------------------------------------------------------
    // DASHBOARD
    // ---------------------------------------------------------------
    function renderDashboard() {
        const container = document.getElementById('license-grid');
        container.innerHTML = '';
        if (currentLicenses.length === 0) {
            document.getElementById('empty-dashboard').classList.remove('hidden');
            container.classList.add('hidden');
        } else {
            document.getElementById('empty-dashboard').classList.add('hidden');
            container.classList.remove('hidden');
        }

        currentLicenses.forEach(lic => {
            const threshold = thresholds[lic.id] || DEFAULT_THRESHOLD;
            const pct = getUsagePercent(lic);
            const free = getFreeCount(lic);
            const safeName = escapeHtml(lic.name);
            const safeSku = escapeHtml(lic.sku);
            let ringColor = '#10b981';
            let textColor = 'text-emerald-700';
            if (pct >= 100) { ringColor = '#A6111E'; textColor = 'text-[#A6111E]'; }
            else if (pct >= threshold) { ringColor = '#f59e0b'; textColor = 'text-amber-700'; }

            const blockedHtml = lic.blocked
                ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200"><i data-lucide="lock" class="w-3 h-3 mr-1"></i> Blockiert</span>`
                : '';
            const sourceHtml = lic.source === 'manual'
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">Manuell</span>`
                : '';

            container.insertAdjacentHTML('beforeend', `
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer group"
                     onclick="openLicenseDetail(${lic.id})">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="font-semibold text-gray-800 text-lg flex flex-wrap items-center gap-2">${safeName} ${sourceHtml} ${blockedHtml}</h3>
                            <span class="text-xs font-mono text-gray-400">SKU: ${safeSku}</span>
                        </div>
                        <i data-lucide="chevron-right" class="w-5 h-5 text-gray-300 group-hover:text-[#A6111E] transition-colors"></i>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="relative w-16 h-16">
                            <svg class="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" stroke-width="3" />
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="${ringColor}" stroke-width="3"
                                    stroke-dasharray="${(Math.min(pct, 100)/100) * 97.4} 97.4" stroke-linecap="round" />
                            </svg>
                            <span class="absolute inset-0 flex items-center justify-center text-sm font-bold ${textColor}">${Math.round(pct)}%</span>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between text-sm mb-1">
                                <span class="text-gray-500">Verbraucht</span>
                                <span class="font-medium">${lic.used} / ${lic.total}</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-500">Frei</span>
                                <span class="font-medium ${free === 0 ? 'text-red-600' : 'text-emerald-600'}">${free}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `);
        });

        lucide.createIcons();
        updateKPIs();
        updateCriticalBanner();
        updateApproverStatusUI();
        updateLogicAppStatusUI();
    }

    async function refreshDashboard() {
        try {
            currentLicenses = await fetchLicenses();
            await checkLogicAppHealth();
            renderDashboard();
            showToast('Daten aktualisiert', 'success');
        } catch (e) {
            showToast('Fehler beim Laden', 'error');
        }
    }

    function toggleAutoRefresh(enable) {
        if (enable) {
            autoRefreshInterval = setInterval(refreshDashboard, 5 * 60 * 1000);
            showToast('Auto-Refresh aktiviert (5 Min)', 'info');
        } else {
            clearInterval(autoRefreshInterval);
            showToast('Auto-Refresh deaktiviert', 'info');
        }
    }

    async function checkLogicAppHealth() {
        await new Promise(resolve => setTimeout(resolve, 400));
        logicAppOnline = Math.random() > 0.1;
        updateLogicAppStatusUI();
    }

    // ---------------------------------------------------------------
    // LIZENZ-DETAIL MODAL (30-Tage-Aktivitätsgrafik)
    // ---------------------------------------------------------------
    function openLicenseDetail(id) {
        const lic = currentLicenses.find(l => l.id === id);
        if (!lic) return;
        const free = getFreeCount(lic);
        const safeName = escapeHtml(lic.name);
        const safeSku = escapeHtml(lic.sku);
        const sourceLabel = lic.source === 'manual' ? 'Manuell gepflegt' : 'Microsoft 365';

        // Historie für diese SKU filtern (letzte 30 Tage sind bereits in currentHistory)
        const relevantHistory = currentHistory.filter(h => h.sku === lic.sku);

        // Modal-Inhalt aufbauen
        document.getElementById('modal-content').innerHTML = `
            <div class="border-b border-gray-200 pb-4 mb-4">
                <h3 class="text-xl font-bold mb-1">${safeName}</h3>
                <p class="text-sm text-gray-500">${safeSku} – ${sourceLabel} – Gesamtlizenzen: ${lic.total}</p>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-gray-50 p-3 rounded">
                    <p class="text-xs text-gray-500">Verbraucht</p>
                    <p class="text-2xl font-bold">${lic.used}</p>
                </div>
                <div class="bg-gray-50 p-3 rounded">
                    <p class="text-xs text-gray-500">Verfügbar</p>
                    <p class="text-2xl font-bold ${free===0 ? 'text-red-600' : 'text-emerald-600'}">${free}</p>
                </div>
            </div>
            <h4 class="font-semibold text-sm text-gray-700 mb-2">Buchungsaktivitäten (letzte 30 Tage)</h4>
            <div class="w-full h-64">
                <canvas id="licenseActivityChart"></canvas>
            </div>
        `;

        // Modal öffnen
        document.getElementById('license-modal').classList.remove('hidden');
        document.getElementById('license-modal').classList.add('flex');

        // Chart.js initialisieren
        renderLicenseActivityChart(relevantHistory);
    }

    /**
     * Erstellt ein Balkendiagramm mit täglichen Genehmigungen/Ablehnungen.
     * @param {Array} historyForSku - Array der Zuweisungseinträge für diese SKU
     */
    function renderLicenseActivityChart(historyEntries) {
        // Letzte 30 Tage aufbereiten
        const days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
        }

        // Zählung pro Tag: approved / denied
        const approvedCounts = new Array(30).fill(0);
        const deniedCounts = new Array(30).fill(0);

        historyEntries.forEach(entry => {
            const dateStr = entry.time.slice(0, 10); // YYYY-MM-DD
            const idx = days.indexOf(dateStr);
            if (idx !== -1) {
                if (entry.result === 'approved') approvedCounts[idx]++;
                else deniedCounts[idx]++;
            }
        });

        // Altes Chart zerstören, falls vorhanden
        if (currentLicenseChart) {
            currentLicenseChart.destroy();
            currentLicenseChart = null;
        }

        const ctx = document.getElementById('licenseActivityChart').getContext('2d');
        currentLicenseChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: days.map(d => d.slice(5)), // MM-DD
                datasets: [
                    {
                        label: 'Genehmigt',
                        data: approvedCounts,
                        backgroundColor: '#10b981',
                        borderRadius: 2,
                    },
                    {
                        label: 'Abgelehnt',
                        data: deniedCounts,
                        backgroundColor: '#A6111E',
                        borderRadius: 2,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    function closeModal(event) {
        if (event && event.target !== document.getElementById('license-modal')) return;
        document.getElementById('license-modal').classList.add('hidden');
        document.getElementById('license-modal').classList.remove('flex');
        // Chart zerstören
        if (currentLicenseChart) {
            currentLicenseChart.destroy();
            currentLicenseChart = null;
        }
    }

    // ---------------------------------------------------------------
    // HISTORY TAB (mit Suche & Export)
    // ---------------------------------------------------------------
    async function renderHistory() {
        const container = document.getElementById('history-list-container');
        container.innerHTML = '';
        try {
            if (currentHistory.length === 0) {
                document.getElementById('empty-history').classList.remove('hidden');
            } else {
                document.getElementById('empty-history').classList.add('hidden');
                // Vollständige Liste anzeigen (Suche startet erst nach Filtereingabe)
                rebuildHistoryTable(currentHistory);
            }
        } catch (e) {
            showToast('Fehler beim Laden der Historie', 'error');
        }
        lucide.createIcons();
        attachHistorySort();

        // Suchfeld-Listener
        const searchInput = document.getElementById('history-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const query = this.value.toLowerCase();
                const filtered = currentHistory.filter(h =>
                    h.user.toLowerCase().includes(query) ||
                    h.package.toLowerCase().includes(query) ||
                    h.sku.toLowerCase().includes(query) ||
                    h.reason.toLowerCase().includes(query) ||
                    h.requestId.toLowerCase().includes(query)
                );
                rebuildHistoryTable(filtered);
            });
        }

        // Export-Buttons
        document.getElementById('export-history-csv').onclick = () => exportHistory('csv');
        document.getElementById('export-history-json').onclick = () => exportHistory('json');
        document.getElementById('export-history-txt').onclick = () => exportHistory('txt');
    }

    /**
     * Baut die History-Tabelle mit einem optionalen gefilterten Array neu auf.
     * @param {Array|null} dataArray - zu rendernde Einträge (wenn null, dann currentHistory)
     */
    function rebuildHistoryTable(dataArray) {
        const container = document.getElementById('history-list-container');
        container.innerHTML = '';
        const data = dataArray || currentHistory;
        if (data.length === 0) {
            document.getElementById('empty-history').classList.remove('hidden');
        } else {
            document.getElementById('empty-history').classList.add('hidden');
            data.forEach(h => {
                const isApproved = h.result === 'approved';
                container.insertAdjacentHTML('beforeend', `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${h.time}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">${h.user}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${h.package} <span class="text-xs text-gray-400 font-mono">(${h.sku})</span></td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                isApproved ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'
                            }">
                                <i data-lucide="${isApproved ? 'check' : 'x'}" class="w-3 h-3"></i> ${isApproved ? 'Genehmigt' : 'Abgelehnt'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500">${h.reason} <span class="text-gray-400">(${h.requestId})</span></td>
                    </tr>
                `);
            });
        }
        lucide.createIcons();
    }

    let historySortKey = null;
    let historySortAsc = true;

    function attachHistorySort() {
        document.querySelectorAll('#content-history .sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sort;
                if (historySortKey === key) historySortAsc = !historySortAsc;
                else { historySortKey = key; historySortAsc = true; }
                sortHistory(key, historySortAsc);
            });
        });
    }

    function sortHistory(key, asc) {
        currentHistory.sort((a, b) => {
            let valA = a[key] || '';
            let valB = b[key] || '';
            if (key === 'time') { valA = new Date(valA); valB = new Date(valB); }
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });
        // Nach dem Sortieren die aktuelle Filterung berücksichtigen
        const query = document.getElementById('history-search')?.value.toLowerCase() || '';
        const filtered = query
            ? currentHistory.filter(h =>
                h.user.toLowerCase().includes(query) ||
                h.package.toLowerCase().includes(query) ||
                h.sku.toLowerCase().includes(query) ||
                h.reason.toLowerCase().includes(query) ||
                h.requestId.toLowerCase().includes(query)
            )
            : currentHistory;
        rebuildHistoryTable(filtered);
    }

    function exportHistory(format) {
        if (currentHistory.length === 0) {
            showToast('Keine Daten zum Exportieren', 'error');
            return;
        }
        let content, filename, mimeType;
        if (format === 'csv') {
            const rows = [['Zeitpunkt','Nutzer','Paket','Entscheidung','Grund','Request-ID']];
            currentHistory.forEach(h => rows.push([h.time, h.user, h.package, h.result, h.reason, h.requestId]));
            content = rows.map(r => r.join(';')).join('\n');
            filename = 'history.csv';
            mimeType = 'text/csv';
        } else if (format === 'json') {
            content = JSON.stringify(currentHistory, null, 2);
            filename = 'history.json';
            mimeType = 'application/json';
        } else if (format === 'txt') {
            content = currentHistory.map(h =>
                `[${h.time}] ${h.user} – ${h.package} (${h.sku}): ${h.result.toUpperCase()} – ${h.reason} (${h.requestId})`
            ).join('\n');
            filename = 'history.txt';
            mimeType = 'text/plain';
        }
        downloadBlob(content, filename, mimeType);
    }

    // ---------------------------------------------------------------
    // LOGS TAB
    // ---------------------------------------------------------------
    async function renderLogs() {
        const container = document.getElementById('logs-container');
        container.innerHTML = '';
        try {
            currentLogs = await fetchLogs();
            applyLogFilter();
        } catch (e) {
            showToast('Fehler beim Laden der Logs', 'error');
        }
    }

    function displayLogs(logArray) {
        const container = document.getElementById('logs-container');
        container.innerHTML = '';
        const emptyLogs = document.getElementById('empty-logs');
        if (logArray.length === 0) {
            emptyLogs.classList.remove('hidden');
        } else {
            emptyLogs.classList.add('hidden');
            logArray.forEach(log => {
                let colorClass = 'text-blue-400';
                if (log.level === 'SUCCESS') colorClass = 'text-emerald-400';
                else if (log.level === 'WARN') colorClass = 'text-amber-400';
                else if (log.level === 'ERROR') colorClass = 'text-red-400 font-semibold';
                container.insertAdjacentHTML('beforeend', `
                    <div class="terminal-line flex gap-4 border-b border-gray-800 pb-1 text-xs">
                        <span class="text-gray-500 shrink-0 w-14">[${log.time}]</span>
                        <span class="${colorClass} w-16 shrink-0">[${log.level}]</span>
                        <span class="text-gray-300">${log.msg}</span>
                    </div>
                `);
            });
        }
        document.getElementById('log-error-count').textContent = logArray.filter(l => l.level === 'ERROR').length;
    }

    function applyLogFilter() {
        const filterText = document.getElementById('log-filter').value.toLowerCase();
        const filtered = currentLogs.filter(log =>
            log.msg.toLowerCase().includes(filterText) || log.level.toLowerCase().includes(filterText)
        );
        displayLogs(filtered);
    }

    function clearLogs() {
        currentLogs = [];
        displayLogs([]);
        showToast('Logs gelöscht', 'success');
    }

    function toggleLogPause() {
        logPaused = !logPaused;
        const icon = document.getElementById('log-pause-icon');
        const label = document.getElementById('log-pause-label');
        if (logPaused) {
            label.textContent = 'Live';
            icon.setAttribute('data-lucide', 'play');
        } else {
            label.textContent = 'Pause';
            icon.setAttribute('data-lucide', 'pause');
        }
        lucide.createIcons();
        showToast(logPaused ? 'Log-Live pausiert' : 'Log-Live fortgesetzt', 'info');
    }

    function exportLogs() {
        const text = currentLogs.map(l => `[${l.time}] [${l.level}] ${l.msg}`).join('\n');
        downloadBlob(text, 'logs.txt', 'text/plain');
    }

    document.getElementById('log-filter').addEventListener('input', applyLogFilter);

    // ---------------------------------------------------------------
    // SETTINGS TAB
    // ---------------------------------------------------------------
    function renderCustomPackages() {
        const tbody = document.getElementById('custom-packages-body');
        const empty = document.getElementById('custom-packages-empty');
        const count = document.getElementById('custom-package-count');
        if (!tbody || !empty) return;

        tbody.innerHTML = '';
        count.textContent = `${customLicensePackages.length} manuell gepflegt`;

        if (customLicensePackages.length === 0) {
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        customLicensePackages.forEach(pkg => {
            const free = getFreeCount(pkg);
            const pct = Math.round(getUsagePercent(pkg));
            const safeName = escapeHtml(pkg.name);
            const safeSku = escapeHtml(pkg.sku);
            const statusHtml = pkg.blocked
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200"><i data-lucide="lock" class="w-3 h-3"></i> Blockiert</span>`
                : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200"><i data-lucide="check" class="w-3 h-3"></i> Aktiv</span>`;

            tbody.insertAdjacentHTML('beforeend', `
                <tr>
                    <td class="px-4 py-3 text-sm text-gray-700">
                        ${safeName}
                        <span class="text-xs text-gray-400 font-mono">${safeSku}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600">${pkg.used} / ${pkg.total} (${free} frei, ${pct}%)</td>
                    <td class="px-4 py-3">${statusHtml}</td>
                    <td class="px-4 py-3">
                        <button class="text-xs text-[#A6111E] hover:underline" onclick="deleteCustomPackage(${pkg.id})">Löschen</button>
                    </td>
                </tr>
            `);
        });
        lucide.createIcons();
    }

    async function handleCustomPackageSubmit(event) {
        event.preventDefault();
        const name = document.getElementById('custom-package-name').value.trim();
        const sku = normalizeSku(document.getElementById('custom-package-sku').value);
        const total = parseInt(document.getElementById('custom-package-total').value, 10);
        const used = parseInt(document.getElementById('custom-package-used').value, 10);
        const threshold = parseThreshold(document.getElementById('custom-package-threshold').value);
        const blocked = document.getElementById('custom-package-blocked').checked;

        if (!name) {
            showToast('Bitte einen Paketnamen angeben', 'error');
            return;
        }

        if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(sku)) {
            showToast('SKU darf nur Buchstaben, Zahlen, _ und - enthalten', 'error');
            return;
        }

        if (!Number.isFinite(total) || total < 1) {
            showToast('Gesamtbestand muss mindestens 1 sein', 'error');
            return;
        }

        if (!Number.isFinite(used) || used < 0 || used > total) {
            showToast('Verbraucht muss zwischen 0 und Gesamt liegen', 'error');
            return;
        }

        const skuExists = currentLicenses.some(lic => normalizeSku(lic.sku) === sku);
        if (skuExists) {
            showToast('SKU ist bereits vorhanden', 'error');
            return;
        }

        await createCustomPackage({ name, sku, total, used, threshold, blocked });
        event.target.reset();
        document.getElementById('custom-package-total').value = 1;
        document.getElementById('custom-package-used').value = 0;
        document.getElementById('custom-package-threshold').value = DEFAULT_THRESHOLD;
        renderSettings();
        renderDashboard();
        showToast('Eigenes Paket hinzugefügt', 'success');
    }

    async function deleteCustomPackage(packageId) {
        const pkg = customLicensePackages.find(item => item.id === Number(packageId));
        if (!pkg) return;
        if (!window.confirm(`Paket "${pkg.name}" wirklich löschen?`)) return;

        await removeCustomPackage(packageId);
        renderSettings();
        renderDashboard();
        showToast('Eigenes Paket gelöscht', 'success');
    }

    function renderSettings() {
        const tbody = document.getElementById('settings-thresholds-body');
        tbody.innerHTML = '';
        currentLicenses.forEach(lic => {
            const currentThreshold = thresholds[lic.id] || DEFAULT_THRESHOLD;
            const safeName = escapeHtml(lic.name);
            const safeSku = escapeHtml(lic.sku);
            const sourceHtml = lic.source === 'manual'
                ? '<span class="ml-2 text-xs text-blue-600">Manuell</span>'
                : '';
            tbody.insertAdjacentHTML('beforeend', `
                <tr>
                    <td class="px-4 py-3 text-sm text-gray-700">${safeName} <span class="text-xs text-gray-400 font-mono">${safeSku}</span>${sourceHtml}</td>
                    <td class="px-4 py-3">
                        <input type="number" id="threshold-${lic.id}" value="${currentThreshold}" min="1" max="100" class="w-20 px-2 py-1 border border-gray-300 rounded text-sm">
                    </td>
                    <td class="px-4 py-3">
                        <button class="text-xs text-[#0067B8] hover:underline" onclick="resetThreshold(${lic.id})">Zurücksetzen</button>
                    </td>
                </tr>
            `);
        });
        renderCustomPackages();
        const form = document.getElementById('custom-package-form');
        const skuInput = document.getElementById('custom-package-sku');
        if (form) form.onsubmit = handleCustomPackageSubmit;
        if (skuInput) skuInput.oninput = () => { skuInput.value = normalizeSku(skuInput.value); };
        document.getElementById('save-thresholds-btn').onclick = saveSettingsThresholds;
        updateApproverStatusUI();
        document.getElementById('toggle-approver-btn').onclick = toggleAutoApprover;
    }

    async function saveSettingsThresholds() {
        const newThresholds = {};
        currentLicenses.forEach(lic => {
            const input = document.getElementById(`threshold-${lic.id}`);
            if (input) newThresholds[lic.id] = parseThreshold(input.value);
        });
        await saveThresholds(newThresholds);
        document.getElementById('settings-save-status').classList.remove('hidden');
        setTimeout(() => document.getElementById('settings-save-status').classList.add('hidden'), 2000);
        renderDashboard();
    }

    function resetThreshold(licId) {
        document.getElementById(`threshold-${licId}`).value = DEFAULT_THRESHOLD;
    }

    function toggleAutoApprover() {
        autoApproverActive = !autoApproverActive;
        localStorage.setItem('autoApproverActive', autoApproverActive.toString());
        updateApproverStatusUI();
        // Dashboard-KPI ebenfalls aktualisieren
        document.getElementById('approver-dot').className = autoApproverActive ? 'w-3 h-3 rounded-full bg-emerald-500' : 'w-3 h-3 rounded-full bg-red-500';
        document.getElementById('approver-status-text').textContent = autoApproverActive ? 'Aktiv' : 'Inaktiv';
        showToast(autoApproverActive ? 'Auto-Approver aktiviert' : 'Auto-Approver deaktiviert', autoApproverActive ? 'success' : 'error');
    }

    // ---------------------------------------------------------------
    // TAB SWITCHING
    // ---------------------------------------------------------------
    function switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('border-[#A6111E]', 'text-[#A6111E]');
            btn.classList.add('border-transparent', 'text-gray-500');
        });
        document.getElementById(`content-${tabId}`).classList.remove('hidden');
        const activeBtn = document.getElementById(`tab-${tabId}`);
        activeBtn.classList.remove('border-transparent', 'text-gray-500');
        activeBtn.classList.add('border-[#A6111E]', 'text-[#A6111E]');

        if (tabId === 'history') renderHistory();
        else if (tabId === 'logs') renderLogs();
        else if (tabId === 'settings') renderSettings();
    }

    // ---------------------------------------------------------------
    // DOWNLOAD HELPER
    // ---------------------------------------------------------------
    function downloadBlob(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ---------------------------------------------------------------
    // AUTH SIMULATION
    // ---------------------------------------------------------------
    document.getElementById('login-form').addEventListener('submit', e => {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        btn.textContent = 'Bitte warten...';
        btn.disabled = true;
        setTimeout(() => {
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('app-view').classList.remove('hidden');
            btn.textContent = 'Weiter';
            btn.disabled = false;
            refreshDashboard();
        }, 700);
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        document.getElementById('app-view').classList.add('hidden');
        document.getElementById('login-view').classList.remove('hidden');
    });

    // ---------------------------------------------------------------
    // INIT
    // ---------------------------------------------------------------
    lucide.createIcons();
    updateApproverStatusUI();
    updateLogicAppStatusUI();
