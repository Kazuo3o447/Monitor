/**
     * =================================================================================
     * GEMA M365 LIZENZ-MONITOR – MVP (mit Historiensuche & Aktivitätsgrafik)
     * =================================================================================
     */

    const DEFAULT_THRESHOLD = 80;

    function createDefaultConfig() {
        return {
            licenseAliases: {},
            customPackages: [],
            thresholds: {}
        };
    }

    // ---------------------------------------------------------------
    // GLOBALER ZUSTAND
    // ---------------------------------------------------------------
    let appConfig = createDefaultConfig();
    let customLicensePackages = [];
    let licenseAliases = {};
    let currentLicenses = [];
    let currentHistory = [];
    let thresholds = {};
    let autoRefreshInterval = null;
    let currentLicenseChart = null; // Referenz auf Chart.js-Instanz
    let lastSnapshotAt = null;
    let configLoaded = false;
    let currentRenameLicenseId = null;
    let historyFilters = {
        query: '',
        from: '',
        to: '',
        result: 'all',
        page: 1,
        pageSize: 10
    };
    let historySortKey = 'time';
    let historySortAsc = false;
    let historyControlsBound = false;
    let customPackageEditingId = null;

    // ---------------------------------------------------------------
    // BACKEND-SIMULATIONSFUNKTIONEN
    // ---------------------------------------------------------------
    function normalizeConfig(config) {
        if (!config || typeof config !== 'object') return createDefaultConfig();
        return {
            licenseAliases: (config.licenseAliases && typeof config.licenseAliases === 'object' && !Array.isArray(config.licenseAliases)) ? config.licenseAliases : {},
            customPackages: Array.isArray(config.customPackages) ? config.customPackages.map(normalizeStoredCustomPackage).filter(Boolean) : [],
            thresholds: (config.thresholds && typeof config.thresholds === 'object' && !Array.isArray(config.thresholds)) ? config.thresholds : {}
        };
    }

    function applyConfig(config) {
        appConfig = normalizeConfig(config);
        customLicensePackages = appConfig.customPackages;
        licenseAliases = appConfig.licenseAliases;
        thresholds = appConfig.thresholds;
    }

    function buildConfigPayload() {
        return {
            licenseAliases,
            customPackages: customLicensePackages,
            thresholds
        };
    }

    async function ensureConfigLoaded(force = false) {
        if (configLoaded && !force) return;
        const response = await fetch('/api/config', {
            headers: {
                Accept: 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Konfiguration konnte nicht geladen werden (${response.status})`);
        }
        applyConfig(await response.json());
        configLoaded = true;
    }

    async function persistConfig() {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(buildConfigPayload())
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => null);
            throw new Error(errorPayload?.message || `Konfiguration konnte nicht gespeichert werden (${response.status})`);
        }

        applyConfig(await response.json());
    }

    function getAliasForSku(sku) {
        const normalizedSku = normalizeSku(sku);
        return String(licenseAliases[normalizedSku] || '').trim();
    }

    function getDisplayName(license) {
        const alias = getAliasForSku(license?.sku);
        if (alias) return alias;
        return String(license?.name || license?.sku || 'Unbekannt').trim();
    }

    function mergeLicenseCatalog(graphLicenses = []) {
        const graphItems = graphLicenses.map(license => ({
            ...license,
            originalName: license.originalName || license.name || license.sku,
            name: getDisplayName(license),
            source: license.source || 'graph'
        }));
        const customItems = customLicensePackages.map(license => ({
            ...license,
            originalName: license.originalName || license.name || license.sku,
            name: getDisplayName(license),
            source: 'manual'
        }));
        return [...graphItems, ...customItems];
    }

    function formatSnapshotTimestamp(value) {
        if (!value) return 'Noch nicht geladen';
        return new Intl.DateTimeFormat('de-DE', {
            dateStyle: 'short',
            timeStyle: 'medium'
        }).format(value);
    }

    function updateSnapshotTimestamp() {
        const element = document.getElementById('snapshot-timestamp');
        if (!element) return;
        element.textContent = formatSnapshotTimestamp(lastSnapshotAt);
    }

    async function setLicenseAliasById(licenseId, aliasValue) {
        const license = currentLicenses.find(item => item.id === Number(licenseId));
        if (!license) {
            showToast('Lizenz nicht gefunden', 'error');
            return;
        }

        const sku = normalizeSku(license.sku);
        const alias = String(aliasValue || '').trim();

        if (alias) {
            licenseAliases[sku] = alias;
        } else {
            delete licenseAliases[sku];
        }

        await persistConfig();
        currentLicenses = currentLicenses.map(item => ({ ...item, name: getDisplayName(item) }));
        renderDashboard();
        renderSettings();
    }

    async function promptLicenseAlias(licenseId) {
        const license = currentLicenses.find(item => item.id === Number(licenseId));
        if (!license) {
            showToast('Lizenz nicht gefunden', 'error');
            return;
        }

        currentRenameLicenseId = license.id;
        document.getElementById('rename-license-sku').textContent = `SKU: ${license.sku}`;
        document.getElementById('rename-license-input').value = getAliasForSku(license.sku) || '';
        document.getElementById('rename-license-modal').classList.remove('hidden');
        document.getElementById('rename-license-modal').classList.add('flex');
        document.getElementById('rename-license-input').focus();
    }

    function closeRenameLicenseModal(event) {
        if (event && event.target !== document.getElementById('rename-license-modal')) return;
        currentRenameLicenseId = null;
        document.getElementById('rename-license-modal').classList.add('hidden');
        document.getElementById('rename-license-modal').classList.remove('flex');
    }

    async function saveRenameLicenseModal() {
        if (!currentRenameLicenseId) return;
        const input = document.getElementById('rename-license-input');
        try {
            await setLicenseAliasById(currentRenameLicenseId, input.value);
            closeRenameLicenseModal();
            showToast(input.value.trim() ? 'Lizenzname gespeichert' : 'Lizenzname zurückgesetzt', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function fetchLicenses() {
        showToast('Lade Lizenzen...', 'info');
        try {
            const response = await fetch('/api/licenses', {
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null);
                const errorMessage = errorPayload?.message || `Lizenzabruf fehlgeschlagen (${response.status})`;
                throw new Error(errorMessage);
            }

            const payload = await response.json();
            if (!Array.isArray(payload.licenses)) {
                throw new Error('Ungueltiges Antwortformat fuer Lizenzdaten');
            }

            lastSnapshotAt = new Date();
            return mergeLicenseCatalog(payload.licenses);
        } catch (error) {
            console.warn('Live-Lizenzabruf nicht verfuegbar.', error);
            showToast(`Live-Lizenzabruf nicht verfuegbar: ${error.message}`, 'warn');
            lastSnapshotAt = new Date();
            return mergeLicenseCatalog([]);
        }
    }

    async function fetchHistory() {
        return [];
    }

    async function saveThresholds(newThresholds) {
        thresholds = newThresholds;
        await persistConfig();
        showToast('Schwellwerte gespeichert', 'success');
    }

    function getLicenseCatalog() {
        return mergeLicenseCatalog([]);
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

    async function createCustomPackage(packageData) {
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
        await persistConfig();
        currentLicenses = getLicenseCatalog();
        return newPackage;
    }

    async function removeCustomPackage(packageId) {
        const numericId = Number(packageId);
        customLicensePackages = customLicensePackages.filter(pkg => pkg.id !== numericId);
        delete thresholds[numericId];
        delete licenseAliases[normalizeSku((currentLicenses.find(pkg => pkg.id === numericId) || {}).sku || '')];
        await persistConfig();
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

    function getLicenseUsageSummary() {
        return currentLicenses.reduce((summary, license) => {
            summary.total += license.total || 0;
            summary.used += license.used || 0;
            summary.free += getFreeCount(license);
            return summary;
        }, { total: 0, used: 0, free: 0 });
    }

    function getUsageSortedLicenses() {
        return [...currentLicenses].sort((left, right) => {
            const usageDiff = getUsagePercent(right) - getUsagePercent(left);
            if (usageDiff !== 0) return usageDiff;
            return left.name.localeCompare(right.name, 'de');
        });
    }

    function getTrendBadgeHtml(license) {
        const trend = Number(license.trend) || 0;
        if (trend === 0) {
            return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">Stabil</span>';
        }

        const isUp = trend > 0;
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isUp ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}">${isUp ? '▲' : '▼'} ${Math.abs(trend)}</span>`;
    }

    function getFilteredHistoryEntries() {
        const query = historyFilters.query.trim().toLowerCase();
        const fromValue = historyFilters.from;
        const toValue = historyFilters.to;
        const resultValue = historyFilters.result;

        return currentHistory.filter(entry => {
            const entryDate = entry.time.slice(0, 10);
            const matchesQuery = !query || [entry.user, entry.package, entry.sku, entry.reason, entry.requestId]
                .some(value => String(value).toLowerCase().includes(query));
            const matchesFrom = !fromValue || entryDate >= fromValue;
            const matchesTo = !toValue || entryDate <= toValue;
            const matchesResult = resultValue === 'all' || entry.result === resultValue;
            return matchesQuery && matchesFrom && matchesTo && matchesResult;
        });
    }

    function sortHistoryEntries(entries) {
        return [...entries].sort((left, right) => {
            let valueA = left[historySortKey] || '';
            let valueB = right[historySortKey] || '';
            if (historySortKey === 'time') {
                valueA = new Date(valueA);
                valueB = new Date(valueB);
            } else {
                valueA = String(valueA).toLowerCase();
                valueB = String(valueB).toLowerCase();
            }
            if (valueA < valueB) return historySortAsc ? -1 : 1;
            if (valueA > valueB) return historySortAsc ? 1 : -1;
            return 0;
        });
    }

    function updateHistorySortIndicators() {
        document.querySelectorAll('#content-history .sortable').forEach(th => {
            const indicator = th.querySelector('.sort-indicator');
            if (!indicator) return;
            if (th.dataset.sort !== historySortKey) {
                indicator.textContent = '';
                return;
            }
            indicator.textContent = historySortAsc ? '▲' : '▼';
        });
    }

    function resetHistoryFilters() {
        historyFilters = {
            query: '',
            from: '',
            to: '',
            result: 'all',
            page: 1,
            pageSize: historyFilters.pageSize
        };

        const searchInput = document.getElementById('history-search');
        const fromInput = document.getElementById('history-from');
        const toInput = document.getElementById('history-to');
        const resultInput = document.getElementById('history-result');
        if (searchInput) searchInput.value = '';
        if (fromInput) fromInput.value = '';
        if (toInput) toInput.value = '';
        if (resultInput) resultInput.value = 'all';
    }

    function setHistoryPage(page) {
        historyFilters.page = Math.max(1, page);
        renderHistoryView();
    }

    function buildTrendLabel(license) {
        const trend = Number(license.trend) || 0;
        if (trend === 0) return 'Stabil';
        return `${trend > 0 ? '+' : '-'}${Math.abs(trend)}`;
    }

    function beginEditCustomPackage(packageId) {
        const pkg = customLicensePackages.find(item => item.id === Number(packageId));
        if (!pkg) return;

        customPackageEditingId = pkg.id;
        document.getElementById('custom-package-edit-id').value = String(pkg.id);
        document.getElementById('custom-package-name').value = pkg.name;
        document.getElementById('custom-package-sku').value = pkg.sku;
        document.getElementById('custom-package-total').value = pkg.total;
        document.getElementById('custom-package-used').value = pkg.used;
        document.getElementById('custom-package-threshold').value = thresholds[pkg.id] || DEFAULT_THRESHOLD;
        document.getElementById('custom-package-blocked').checked = Boolean(pkg.blocked);
        document.getElementById('custom-package-submit').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Speichern';
        document.getElementById('custom-package-cancel').classList.remove('hidden');
        lucide.createIcons();
        document.getElementById('custom-package-name').focus();
    }

    function cancelCustomPackageEdit() {
        customPackageEditingId = null;
        document.getElementById('custom-package-edit-id').value = '';
        document.getElementById('custom-package-form').reset();
        document.getElementById('custom-package-total').value = 1;
        document.getElementById('custom-package-used').value = 0;
        document.getElementById('custom-package-threshold').value = DEFAULT_THRESHOLD;
        document.getElementById('custom-package-submit').innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i> Hinzufügen';
        document.getElementById('custom-package-cancel').classList.add('hidden');
        const skuInput = document.getElementById('custom-package-sku');
        if (skuInput) skuInput.value = normalizeSku(skuInput.value);
        lucide.createIcons();
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
                `⚠️ ${high.length} Lizenzpool(s) liegen über dem konfigurierten Schwellwert.`;
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

        const sortedLicenses = getUsageSortedLicenses();
        sortedLicenses.forEach(lic => {
            const threshold = thresholds[lic.id] || DEFAULT_THRESHOLD;
            const pct = getUsagePercent(lic);
            const safeName = escapeHtml(lic.name);
            const safeSku = escapeHtml(lic.sku);
            const trendHtml = getTrendBadgeHtml(lic);
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
                            <div class="mt-2 flex flex-wrap items-center gap-2">
                                ${trendHtml}
                                <span class="text-xs text-gray-500">Trend: ${escapeHtml(buildTrendLabel(lic))}</span>
                            </div>
                            <button class="mt-3 text-xs text-[#0067B8] hover:underline" onclick="event.stopPropagation(); promptLicenseAlias(${lic.id})">Name ändern</button>
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
                        </div>
                    </div>
                </div>
            `);
        });

        lucide.createIcons();
        updateKPIs();
        updateCriticalBanner();
        updateSnapshotTimestamp();
    }

    async function refreshDashboard() {
        try {
            await ensureConfigLoaded();
            currentLicenses = await fetchLicenses();
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

    // ---------------------------------------------------------------
    // LIZENZ-DETAIL MODAL (30-Tage-Aktivitätsgrafik)
    // ---------------------------------------------------------------
    function openLicenseDetail(id) {
        const lic = currentLicenses.find(l => l.id === id);
        if (!lic) return;
        const safeName = escapeHtml(lic.name);
        const safeSku = escapeHtml(lic.sku);
        const sourceLabel = lic.source === 'manual' ? 'Manuell gepflegt' : 'Microsoft 365';

        // Historie für diese SKU filtern (letzte 30 Tage sind bereits in currentHistory)
        const relevantHistory = currentHistory.filter(h => h.sku === lic.sku);
        const recentHistory = relevantHistory.slice(0, 5);

        // Modal-Inhalt aufbauen
        document.getElementById('modal-content').innerHTML = `
            <div class="border-b border-gray-200 pb-4 mb-4">
                <h3 class="text-xl font-bold mb-1">${safeName}</h3>
                <p class="text-sm text-gray-500">${safeSku} – ${sourceLabel} – Gesamtlizenzen: ${lic.total}</p>
                <button class="mt-3 text-sm text-[#0067B8] hover:underline" onclick="promptLicenseAlias(${lic.id})">Namen dieser Lizenz ändern</button>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-gray-50 p-3 rounded">
                    <p class="text-xs text-gray-500">Verbraucht</p>
                    <p class="text-2xl font-bold">${lic.used}</p>
                </div>
                <div class="bg-gray-50 p-3 rounded">
                    <p class="text-xs text-gray-500">Gesamt</p>
                    <p class="text-2xl font-bold">${lic.total}</p>
                </div>
            </div>
            <h4 class="font-semibold text-sm text-gray-700 mb-2">Buchungsaktivitäten (letzte 30 Tage)</h4>
            <div class="w-full h-64">
                <canvas id="licenseActivityChart"></canvas>
            </div>
            <div class="mt-6">
                <h4 class="font-semibold text-sm text-gray-700 mb-2">Letzte Vorgänge</h4>
                <div class="overflow-x-auto border border-gray-200 rounded-lg">
                    <table class="min-w-full divide-y divide-gray-200 text-sm">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Zeit</th>
                                <th class="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Nutzer</th>
                                <th class="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 bg-white">
                            ${recentHistory.map(entry => `
                                <tr>
                                    <td class="px-4 py-2 whitespace-nowrap text-gray-500">${escapeHtml(entry.time)}</td>
                                    <td class="px-4 py-2 whitespace-nowrap text-gray-700">${escapeHtml(entry.user)}</td>
                                    <td class="px-4 py-2 whitespace-nowrap">
                                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${entry.result === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}">
                                            ${entry.result === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('') || `<tr><td colspan="3" class="px-4 py-4 text-center text-gray-500">Keine Vorgänge vorhanden.</td></tr>`}
                        </tbody>
                    </table>
                </div>
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
    // HISTORY TAB (mit Suche, Filter, Sortierung & Export)
    // ---------------------------------------------------------------
    async function renderHistory() {
        try {
            if (!historyControlsBound) {
                setupHistoryControls();
                historyControlsBound = true;
            }
            renderHistoryView();
        } catch (error) {
            showToast('Fehler beim Laden der Historie', 'error');
        }
        lucide.createIcons();
    }

    function setupHistoryControls() {
        const searchInput = document.getElementById('history-search');
        const fromInput = document.getElementById('history-from');
        const toInput = document.getElementById('history-to');
        const resultInput = document.getElementById('history-result');
        const clearButton = document.getElementById('history-clear-filters');

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                historyFilters.query = this.value;
                historyFilters.page = 1;
                renderHistoryView();
            });
        }

        if (fromInput) {
            fromInput.addEventListener('change', function() {
                historyFilters.from = this.value;
                historyFilters.page = 1;
                renderHistoryView();
            });
        }

        if (toInput) {
            toInput.addEventListener('change', function() {
                historyFilters.to = this.value;
                historyFilters.page = 1;
                renderHistoryView();
            });
        }

        if (resultInput) {
            resultInput.addEventListener('change', function() {
                historyFilters.result = this.value;
                historyFilters.page = 1;
                renderHistoryView();
            });
        }

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                resetHistoryFilters();
                renderHistoryView();
            });
        }

        document.getElementById('export-history-csv').onclick = () => exportHistory('csv');
        document.getElementById('export-history-json').onclick = () => exportHistory('json');
        document.getElementById('export-history-txt').onclick = () => exportHistory('txt');

        document.querySelectorAll('#content-history .sortable').forEach(th => {
            th.onclick = () => {
                const key = th.dataset.sort;
                if (historySortKey === key) historySortAsc = !historySortAsc;
                else {
                    historySortKey = key;
                    historySortAsc = true;
                }
                renderHistoryView();
            };
        });
    }

    function renderHistoryView() {
        const filtered = sortHistoryEntries(getFilteredHistoryEntries());
        const totalItems = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / historyFilters.pageSize));
        historyFilters.page = Math.min(historyFilters.page, totalPages);
        const start = (historyFilters.page - 1) * historyFilters.pageSize;
        const pageData = filtered.slice(start, start + historyFilters.pageSize);

        renderHistoryTable(pageData, totalItems);
        renderHistoryPagination(totalItems);
        updateHistorySortIndicators();
    }

    function renderHistoryTable(dataArray, totalItems) {
        const container = document.getElementById('history-list-container');
        container.innerHTML = '';
        const emptyState = document.getElementById('empty-history');

        if (totalItems === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        dataArray.forEach(entry => {
            const isApproved = entry.result === 'approved';
            const displayPackage = getAliasForSku(entry.sku) || entry.package;
            container.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${entry.time}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">${escapeHtml(entry.user)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${escapeHtml(displayPackage)} <span class="text-xs text-gray-400 font-mono">(${escapeHtml(entry.sku)})</span></td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            isApproved ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'
                        }">
                            <i data-lucide="${isApproved ? 'check' : 'x'}" class="w-3 h-3"></i> ${isApproved ? 'Genehmigt' : 'Abgelehnt'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500">${escapeHtml(entry.reason)} <span class="text-gray-400">(${escapeHtml(entry.requestId)})</span></td>
                </tr>
            `);
        });

        lucide.createIcons();
    }

    function renderHistoryPagination(totalItems) {
        const container = document.getElementById('history-pagination');
        const totalPages = Math.max(1, Math.ceil(totalItems / historyFilters.pageSize));
        const startItem = totalItems === 0 ? 0 : ((historyFilters.page - 1) * historyFilters.pageSize) + 1;
        const endItem = Math.min(historyFilters.page * historyFilters.pageSize, totalItems);

        container.innerHTML = `
            <div class="text-sm text-gray-600">${totalItems === 0 ? 'Keine Einträge gefunden' : `${startItem}-${endItem} von ${totalItems} Einträgen`}</div>
            <div class="flex items-center gap-2">
                <button class="px-3 py-1 text-sm border border-gray-300 rounded bg-white disabled:opacity-50" ${historyFilters.page <= 1 ? 'disabled' : ''} id="history-page-prev">Zurück</button>
                <span class="text-sm text-gray-600">Seite ${historyFilters.page} von ${totalPages}</span>
                <button class="px-3 py-1 text-sm border border-gray-300 rounded bg-white disabled:opacity-50" ${historyFilters.page >= totalPages ? 'disabled' : ''} id="history-page-next">Weiter</button>
            </div>
        `;

        const prevButton = document.getElementById('history-page-prev');
        const nextButton = document.getElementById('history-page-next');
        if (prevButton) prevButton.onclick = () => setHistoryPage(historyFilters.page - 1);
        if (nextButton) nextButton.onclick = () => setHistoryPage(historyFilters.page + 1);
    }

    function exportHistory(format) {
        const data = sortHistoryEntries(getFilteredHistoryEntries());
        if (data.length === 0) {
            showToast('Keine Daten zum Exportieren', 'error');
            return;
        }

        const mappedData = data.map(entry => ({
            ...entry,
            package: getAliasForSku(entry.sku) || entry.package
        }));

        let content;
        let filename;
        let mimeType;

        if (format === 'csv') {
            const rows = [['Zeitpunkt', 'Nutzer', 'Paket', 'Entscheidung', 'Grund', 'Request-ID']];
            mappedData.forEach(entry => rows.push([entry.time, entry.user, entry.package, entry.result, entry.reason, entry.requestId]));
            content = rows.map(row => row.join(';')).join('\n');
            filename = 'history.csv';
            mimeType = 'text/csv';
        } else if (format === 'json') {
            content = JSON.stringify(mappedData, null, 2);
            filename = 'history.json';
            mimeType = 'application/json';
        } else if (format === 'txt') {
            content = mappedData.map(entry =>
                `[${entry.time}] ${entry.user} - ${entry.package} (${entry.sku}): ${entry.result.toUpperCase()} - ${entry.reason} (${entry.requestId})`
            ).join('\n');
            filename = 'history.txt';
            mimeType = 'text/plain';
        }

        downloadBlob(content, filename, mimeType);
    }

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
                    <td class="px-4 py-3 text-sm text-gray-600">${pkg.used} / ${pkg.total}</td>
                    <td class="px-4 py-3">${statusHtml}</td>
                    <td class="px-4 py-3">
                        <div class="flex flex-wrap items-center gap-3">
                            <button class="text-xs text-[#0067B8] hover:underline" onclick="beginEditCustomPackage(${pkg.id})">Bearbeiten</button>
                            <button class="text-xs text-[#A6111E] hover:underline" onclick="deleteCustomPackage(${pkg.id})">Löschen</button>
                        </div>
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

        const editingId = Number(document.getElementById('custom-package-edit-id').value || customPackageEditingId || 0);
        const skuExists = currentLicenses.some(lic => normalizeSku(lic.sku) === sku && lic.id !== editingId);
        if (skuExists) {
            showToast('SKU ist bereits vorhanden', 'error');
            return;
        }

        if (editingId) {
            await updateCustomPackage(editingId, { name, sku, total, used, threshold, blocked });
            showToast('Eigenes Paket aktualisiert', 'success');
        } else {
            await createCustomPackage({ name, sku, total, used, threshold, blocked });
            showToast('Eigenes Paket hinzugefügt', 'success');
        }

        event.target.reset();
        document.getElementById('custom-package-total').value = 1;
        document.getElementById('custom-package-used').value = 0;
        document.getElementById('custom-package-threshold').value = DEFAULT_THRESHOLD;
        cancelCustomPackageEdit();
        renderSettings();
        renderDashboard();
    }

    async function updateCustomPackage(packageId, packageData) {
        const numericId = Number(packageId);
        customLicensePackages = customLicensePackages.map(pkg => {
            if (pkg.id !== numericId) return pkg;
            return {
                ...pkg,
                name: packageData.name,
                sku: packageData.sku,
                total: packageData.total,
                used: packageData.used,
                blocked: packageData.blocked,
                updatedAt: new Date().toISOString()
            };
        });
        thresholds[numericId] = packageData.threshold;
        await persistConfig();
        currentLicenses = getLicenseCatalog();
    }

    async function deleteCustomPackage(packageId) {
        const pkg = customLicensePackages.find(item => item.id === Number(packageId));
        if (!pkg) return;
        if (!window.confirm(`Paket "${pkg.name}" wirklich löschen?`)) return;

        if (customPackageEditingId === pkg.id) {
            cancelCustomPackageEdit();
        }

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
            const aliasValue = escapeHtml(getAliasForSku(lic.sku));
            const sourceHtml = lic.source === 'manual'
                ? '<span class="ml-2 text-xs text-blue-600">Manuell</span>'
                : '';
            tbody.insertAdjacentHTML('beforeend', `
                <tr>
                    <td class="px-4 py-3 text-sm text-gray-700">${safeName} <span class="text-xs text-gray-400 font-mono">${safeSku}</span>${sourceHtml}</td>
                    <td class="px-4 py-3">
                        <input type="text" id="alias-${lic.id}" value="${aliasValue}" placeholder="Optionaler Anzeigename" class="w-full min-w-52 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#A6111E]">
                    </td>
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
        const cancelButton = document.getElementById('custom-package-cancel');
        if (cancelButton) cancelButton.onclick = cancelCustomPackageEdit;
        if (!customPackageEditingId) {
            document.getElementById('custom-package-submit').innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i> Hinzufügen';
            document.getElementById('custom-package-cancel').classList.add('hidden');
        }
        document.getElementById('save-thresholds-btn').onclick = saveSettingsThresholds;
    }

    async function saveSettingsThresholds() {
        const newThresholds = {};
        const newAliases = {};
        currentLicenses.forEach(lic => {
            const input = document.getElementById(`threshold-${lic.id}`);
            if (input) newThresholds[lic.id] = parseThreshold(input.value);

            const aliasInput = document.getElementById(`alias-${lic.id}`);
            if (aliasInput) {
                const alias = aliasInput.value.trim();
                if (alias) newAliases[normalizeSku(lic.sku)] = alias;
            }
        });
        licenseAliases = newAliases;
        await saveThresholds(newThresholds);
        currentLicenses = currentLicenses.map(lic => ({ ...lic, name: getDisplayName(lic) }));
        document.getElementById('settings-save-status').classList.remove('hidden');
        setTimeout(() => document.getElementById('settings-save-status').classList.add('hidden'), 2000);
        renderDashboard();
        renderSettings();
    }

    function resetThreshold(licId) {
        document.getElementById(`threshold-${licId}`).value = DEFAULT_THRESHOLD;
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
        setTimeout(async () => {
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('app-view').classList.remove('hidden');
            btn.textContent = 'Weiter';
            btn.disabled = false;
            try {
                await ensureConfigLoaded(true);
                currentHistory = await fetchHistory();
                await refreshDashboard();
            } catch (error) {
                showToast(error.message, 'error');
            }
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
    updateSnapshotTimestamp();
