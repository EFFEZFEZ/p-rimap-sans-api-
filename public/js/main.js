/**
 * main.js
 * Point d'entrée principal de l'application
 * Gère le tableau de bord, la vue carte et l'état du trafic.
 */

import { DataManager } from './dataManager.js';
import { TimeManager } from './timeManager.js';
import { TripScheduler } from './tripScheduler.js';
import { BusPositionCalculator } from './busPositionCalculator.js';
import { MapRenderer } from './mapRenderer.js';

// Modules
let dataManager;
let timeManager;
let tripScheduler;
let busPositionCalculator;
let mapRenderer;
let visibleRoutes = new Set();

// NOUVEL ÉTAT GLOBAL
let lineStatuses = {}; // Stocke l'état de chaque ligne (par route_id)

// NOUVEAUX ÉLÉMENTS DOM (Tableau de bord)
let dashboardContainer;
let infoTraficList;
let infoTraficCount;
let alertBanner, alertBannerContent, alertBannerClose;
let btnAdminConsole;

// ÉLÉMENTS DOM (Vue Carte)
let mapContainer;
let btnShowMap, btnBackToDashboard;
let searchBar, searchResultsContainer; // Maintenant pour la carte Horaires

// Catégories de lignes
const LINE_CATEGORIES = {
    'majeures': {
        name: 'Lignes majeures',
        lines: ['A', 'B', 'C', 'D'],
        color: '#2563eb'
    },
    'express': {
        name: 'Lignes express',
        lines: ['e1', 'e2', 'e4', 'e5', 'e6', 'e7'],
        color: '#dc2626'
    },
    'quartier': {
        name: 'Lignes de quartier',
        lines: ['K1A', 'K1B', 'K2', 'K3A', 'K3B', 'K4A', 'K4B', 'K5', 'K6'],
        color: '#059669'
    },
    'rabattement': {
        name: 'Lignes de rabattement',
        lines: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15'],
        color: '#7c3aed'
    },
    'navettes': {
        name: 'Navettes',
        lines: ['N', 'N1'],
        color: '#f59e0b'
    }
};

function getCategoryForRoute(routeShortName) {
    for (const [categoryId, category] of Object.entries(LINE_CATEGORIES)) {
        if (category.lines.includes(routeShortName)) {
            return categoryId;
        }
    }
    return 'autres';
}

async function initializeApp() {
    // Sélection des nouveaux éléments DOM
    dashboardContainer = document.getElementById('dashboard-container');
    mapContainer = document.getElementById('map-container');
    btnShowMap = document.getElementById('btn-show-map');
    btnBackToDashboard = document.getElementById('btn-back-to-dashboard');
    infoTraficList = document.getElementById('info-trafic-list');
    infoTraficCount = document.getElementById('info-trafic-count');
    alertBanner = document.getElementById('alert-banner');
    alertBannerContent = document.getElementById('alert-banner-content');
    alertBannerClose = document.getElementById('alert-banner-close');
    btnAdminConsole = document.getElementById('btn-admin-console');

    // Barre de recherche (maintenant dans la carte Horaires)
    searchBar = document.getElementById('horaires-search-bar');
    searchResultsContainer = document.getElementById('horaires-search-results');

    dataManager = new DataManager();
    
    try {
        await dataManager.loadAllData();
        
        timeManager = new TimeManager();
        
        mapRenderer = new MapRenderer('map', dataManager, timeManager);
        mapRenderer.initializeMap();
        
        tripScheduler = new TripScheduler(dataManager);
        busPositionCalculator = new BusPositionCalculator(dataManager);
        
        initializeRouteFilter();
        
        if (dataManager.geoJson) {
            mapRenderer.displayMultiColorRoutes(dataManager.geoJson, dataManager, visibleRoutes);
        }

        mapRenderer.displayStops();
        
        // Configure les écouteurs d'événements pour la vue carte ET le tableau de bord
        setupEventListeners();
        
        // Configure le nouveau tableau de bord
        setupDashboard();

        if (localStorage.getItem('gtfsInstructionsShown') !== 'true') {
            document.getElementById('instructions').classList.remove('hidden');
        }
        
        updateDataStatus('Données chargées', 'loaded');
        
        checkAndSetupTimeMode();
        
        updateData(); // Appel initial
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        updateDataStatus('Erreur de chargement', 'error');
    }
}

/**
 * NOUVEAU: Configure le tableau de bord (état du trafic, admin)
 */
function setupDashboard() {
    // Initialise l'état de toutes les lignes
    dataManager.routes.forEach(route => {
        lineStatuses[route.route_id] = { status: 'normal', message: '' };
    });

    // Affiche la carte Info Trafic
    renderInfoTraficCard();

    // Configure la console admin
    setupAdminConsole();

    // Configure les boutons de basculement de vue
    btnShowMap.addEventListener('click', showMapView);
    btnBackToDashboard.addEventListener('click', showDashboardView);
    alertBannerClose.addEventListener('click', () => alertBanner.classList.add('hidden'));
}

/**
 * NOUVEAU: Logique de la console d'administration
 */
function setupAdminConsole() {
    btnAdminConsole.addEventListener('click', () => {
        console.log("--- CONSOLE ADMIN ACTIVÉE ---");
        console.log('Utilisez setStatus("NOM_LIGNE", "STATUT", "MESSAGE")');
        console.log('Ex: setStatus("A", "perturbation", "Manifestation centre-ville")');
        console.log('Statuts valides: "normal", "perturbation", "retard", "annulation"');
        alert('Console Admin activée. Voir la console (F12) pour les instructions.');
    });

    // Expose la fonction à la fenêtre globale
    window.setStatus = (lineShortName, status, message = "") => {
        const route = dataManager.routes.find(r => r.route_short_name === lineShortName);
        if (!route) {
            console.warn(`Ligne "${lineShortName}" non trouvée.`);
            return;
        }

        if (!['normal', 'perturbation', 'retard', 'annulation'].includes(status)) {
            console.warn(`Statut "${status}" invalide. Utilisez "normal", "perturbation", "retard", "annulation".`);
            return;
        }

        console.log(`Mise à jour statut: Ligne ${lineShortName} -> ${status.toUpperCase()}`);
        lineStatuses[route.route_id] = { status, message };

        // Met à jour l'interface
        renderInfoTraficCard();
        renderAlertBanner();
        // (La carte sera mise à jour au prochain 'tick' de updateData)
    };
}

/**
 * NOUVEAU: Affiche la carte "Info Trafic"
 */
function renderInfoTraficCard() {
    infoTraficList.innerHTML = '';
    let alertCount = 0;

    dataManager.routes.forEach(route => {
        const state = lineStatuses[route.route_id] || { status: 'normal', message: '' };
        const routeColor = route.route_color ? `#${route.route_color}` : '#3388ff';
        const textColor = route.route_text_color ? `#${route.route_text_color}` : '#ffffff';

        let icon, message;
        switch (state.status) {
            case 'perturbation':
                icon = '⚠️';
                message = state.message || 'Perturbation';
                alertCount++;
                break;
            case 'retard':
                icon = '🟡'; // Utilise un émoji simple pour l'horloge
                message = state.message || 'Retard signalé';
                alertCount++;
                break;
            case 'annulation':
                icon = '🔴'; // Utilise un émoji simple pour la croix
                message = state.message || 'Service annulé';
                alertCount++;
                break;
            default:
                icon = '✅';
                message = 'Service normal';
        }

        const item = document.createElement('div');
        item.className = `trafic-item status-${state.status}`;
        item.innerHTML = `
            <div class="trafic-info">
                <span class="line-badge" style="background-color: ${routeColor}; color: ${textColor};">
                    ${route.route_short_name}
                </span>
                <div class="trafic-details">
                    <div class="trafic-details-line">${route.route_long_name}</div>
                    <div class="trafic-details-msg">${message}</div>
                </div>
            </div>
            <div class="status-icon">${icon}</div>
        `;
        infoTraficList.appendChild(item);
    });

    // Met à jour le compteur d'alertes
    infoTraficCount.textContent = alertCount;
    if (alertCount > 0) {
        infoTraficCount.classList.remove('hidden');
    } else {
        infoTraficCount.classList.add('hidden');
    }
}

/**
 * NOUVEAU: Affiche le bandeau d'alerte en haut
 */
function renderAlertBanner() {
    let alerts = [];
    for (const route_id in lineStatuses) {
        const state = lineStatuses[route_id];
        if (state.status !== 'normal') {
            const route = dataManager.getRoute(route_id);
            alerts.push({
                name: route.route_short_name,
                status: state.status,
                message: state.message
            });
        }
    }

    if (alerts.length === 0) {
        alertBanner.classList.add('hidden');
        return;
    }

    // Définit la couleur du bandeau (priorité : annulation > perturbation > retard)
    if (alerts.some(a => a.status === 'annulation')) {
        alertBanner.className = 'type-annulation';
    } else if (alerts.some(a => a.status === 'perturbation')) {
        alertBanner.className = 'type-perturbation';
    } else {
        alertBanner.className = 'type-retard';
    }

    // Construit le message
    let alertText = alerts.map(a => 
        `<strong>Ligne ${a.name}</strong> (${a.status})`
    ).join(', ');
    alertBannerContent.innerHTML = `<strong>Infos Trafic:</strong> ${alertText}`;
    alertBanner.classList.remove('hidden');
}


/**
 * NOUVEAU: Fonctions de basculement de vue
 */
function showMapView() {
    dashboardContainer.classList.add('hidden');
    mapContainer.classList.remove('hidden');
    // Force la carte à se redessiner
    mapRenderer.map.invalidateSize();
}
function showDashboardView() {
    mapContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
}


// --- Fonctions de l'application existante (adaptées) ---

function checkAndSetupTimeMode() {
    timeManager.setMode('real');
    timeManager.play();
    console.log('⏰ Mode TEMPS RÉEL activé.');
}

function initializeRouteFilter() {
    const routeCheckboxesContainer = document.getElementById('route-checkboxes');
    routeCheckboxesContainer.innerHTML = '';
    
    visibleRoutes.clear();
    
    const routesByCategory = {};
    Object.keys(LINE_CATEGORIES).forEach(cat => {
        routesByCategory[cat] = [];
    });
    routesByCategory['autres'] = [];
    
    dataManager.routes.forEach(route => {
        visibleRoutes.add(route.route_id);
        const category = getCategoryForRoute(route.route_short_name);
        routesByCategory[category].push(route);
    });

    Object.values(routesByCategory).forEach(routes => {
        routes.sort((a, b) => {
            const nameA = a.route_short_name;
            const nameB = b.route_short_name;

            const isRLineA = nameA.startsWith('R') && !isNaN(parseInt(nameA.substring(1)));
            const isRLineB = nameB.startsWith('R') && !isNaN(parseInt(nameB.substring(1)));

            if (isRLineA && isRLineB) {
                return parseInt(nameA.substring(1)) - parseInt(nameB.substring(1));
            }
            return nameA.localeCompare(nameB);
        });
    });
    
    Object.entries(LINE_CATEGORIES).forEach(([categoryId, categoryInfo]) => {
        const routes = routesByCategory[categoryId];
        if (routes.length === 0) return;
        
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${categoryInfo.color}">
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                <strong>${categoryInfo.name}</strong>
                <span class="category-count">(${routes.length})</span>
            </div>
            <div class="category-actions">
                <button class="btn-category-action" data-category="${categoryId}" data-action="select">Tous</button>
                <button class="btn-category-action" data-category="${categoryId}" data-action="deselect">Aucun</button>
            </div>
        `;
        routeCheckboxesContainer.appendChild(categoryHeader);
        
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'category-routes';
        categoryContainer.id = `category-${categoryId}`;
        
        routes.forEach(route => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'route-checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `route-${route.route_id}`;
            checkbox.checked = true;
            checkbox.dataset.category = categoryId;
            checkbox.addEventListener('change', () => handleRouteFilterChange());
            
            const routeColor = route.route_color ? `#${route.route_color}` : '#3388ff';
            const textColor = route.route_text_color ? `#${route.route_text_color}` : '#ffffff';
            
            const badge = document.createElement('div');
            badge.className = 'route-badge';
            badge.style.backgroundColor = routeColor;
            badge.style.color = textColor;
            badge.textContent = route.route_short_name || route.route_id;
            
            const label = document.createElement('span');
            label.className = 'route-name';
            label.textContent = route.route_long_name || route.route_short_name || route.route_id;
            
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(badge);
            itemDiv.appendChild(label);
            categoryContainer.appendChild(itemDiv);

            itemDiv.addEventListener('mouseenter', () => {
                mapRenderer.highlightRoute(route.route_id, true);
            });
            itemDiv.addEventListener('mouseleave', () => {
                mapRenderer.highlightRoute(route.route_id, false);
            });
            itemDiv.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                mapRenderer.zoomToRoute(route.route_id);
            });
        });
        
        routeCheckboxesContainer.appendChild(categoryContainer);
    });
    
    if (routesByCategory['autres'].length > 0) {
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#64748b">
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                <strong>Autres lignes</strong>
                <span class="category-count">(${routesByCategory['autres'].length})</span>
            </div>
            <div class="category-actions">
                <button class="btn-category-action" data-category="autres" data-action="select">Tous</button>
                <button class="btn-category-action" data-category="autres" data-action="deselect">Aucun</button>
            </div>
        `;
        routeCheckboxesContainer.appendChild(categoryHeader);
        
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'category-routes';
        categoryContainer.id = 'category-autres';
        
        routesByCategory['autres'].forEach(route => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'route-checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `route-${route.route_id}`;
            checkbox.checked = true;
            checkbox.dataset.category = 'autres';
            checkbox.addEventListener('change', () => handleRouteFilterChange());
            
            const routeColor = route.route_color ? `#${route.route_color}` : '#3388ff';
            const textColor = route.route_text_color ? `#${route.route_text_color}` : '#ffffff';
            
            const badge = document.createElement('div');
            badge.className = 'route-badge';
            badge.style.backgroundColor = routeColor;
            badge.style.color = textColor;
            badge.textContent = route.route_short_name || route.route_id;
            
            const label = document.createElement('span');
            label.className = 'route-name';
            label.textContent = route.route_long_name || route.route_short_name || route.route_id;
            
            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(badge);
            itemDiv.appendChild(label);
            categoryContainer.appendChild(itemDiv);

            itemDiv.addEventListener('mouseenter', () => {
                mapRenderer.highlightRoute(route.route_id, true);
            });
            itemDiv.addEventListener('mouseleave', () => {
                mapRenderer.highlightRoute(route.route_id, false);
            });
            itemDiv.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                mapRenderer.zoomToRoute(route.route_id);
            });
        });
        
        routeCheckboxesContainer.appendChild(categoryContainer);
    }

    document.querySelectorAll('.btn-category-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            const action = e.target.dataset.action;
            handleCategoryAction(category, action);
        });
    });
}

function handleCategoryAction(category, action) {
    const checkboxes = document.querySelectorAll(`input[data-category="${category}"]`);
    checkboxes.forEach(checkbox => {
        checkbox.checked = (action === 'select');
    });
    handleRouteFilterChange();
}

function handleRouteFilterChange() {
    visibleRoutes.clear();
    
    dataManager.routes.forEach(route => {
        const checkbox = document.getElementById(`route-${route.route_id}`);
        if (checkbox && checkbox.checked) {
            visibleRoutes.add(route.route_id);
        }
    });
    
    if (dataManager.geoJson) {
        mapRenderer.displayMultiColorRoutes(dataManager.geoJson, dataManager, visibleRoutes);
    }
    
    updateData(); // Appelle updateData sans timeInfo
}

function setupEventListeners() {
    
    // Écouteurs pour la VUE CARTE
    document.getElementById('close-instructions').addEventListener('click', () => {
        document.getElementById('instructions').classList.add('hidden');
        localStorage.setItem('gtfsInstructionsShown', 'true');
    });
    document.getElementById('btn-toggle-filter').addEventListener('click', () => {
        document.getElementById('route-filter-panel').classList.toggle('hidden');
    });
    document.getElementById('close-filter').addEventListener('click', () => {
        document.getElementById('route-filter-panel').classList.add('hidden');
    });
    document.getElementById('select-all-routes').addEventListener('click', () => {
        dataManager.routes.forEach(route => {
            const checkbox = document.getElementById(`route-${route.route_id}`);
            if (checkbox) checkbox.checked = true;
        });
        handleRouteFilterChange();
    });
    document.getElementById('deselect-all-routes').addEventListener('click', () => {
        dataManager.routes.forEach(route => {
            const checkbox = document.getElementById(`route-${route.route_id}`);
            if (checkbox) checkbox.checked = false;
        });
        handleRouteFilterChange();
    });
    
    timeManager.addListener(updateData);

    // Écouteurs pour la VUE TABLEAU DE BORD (recherche horaires)
    searchBar.addEventListener('input', handleSearchInput);
    searchBar.addEventListener('focus', handleSearchInput); 
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#horaires-search-container')) {
            searchResultsContainer.classList.add('hidden');
        }
    });

    // Écouteurs pour la CARTE
    if (mapRenderer && mapRenderer.map) {
        mapRenderer.map.on('zoomend', () => {
            if (dataManager) {
                mapRenderer.displayStops();
            }
        });
    }
}

function handleSearchInput(e) {
    const query = e.target.value.toLowerCase();
    const searchResultsContainer = document.getElementById('search-results');

    if (query.length < 2) {
        searchResultsContainer.classList.add('hidden');
        searchResultsContainer.innerHTML = '';
        return;
    }

    const matches = dataManager.masterStops // Recherche sur les arrêts maîtres
        .filter(stop => stop.stop_name.toLowerCase().includes(query))
        .slice(0, 10); 

    displaySearchResults(matches, query);
}

function displaySearchResults(stops, query) {
    const searchResultsContainer = document.getElementById('search-results');
    searchResultsContainer.innerHTML = '';

    if (stops.length === 0) {
        searchResultsContainer.innerHTML = `<div class="search-result-item">Aucun arrêt trouvé.</div>`;
        searchResultsContainer.classList.remove('hidden');
        return;
    }

    stops.forEach(stop => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const regex = new RegExp(`(${query})`, 'gi');
        item.innerHTML = stop.stop_name.replace(regex, '<strong>$1</strong>');
        
        item.addEventListener('click', () => onSearchResultClick(stop));
        searchResultsContainer.appendChild(item);
    });

    searchResultsContainer.classList.remove('hidden');
}

function onSearchResultClick(stop) {
    // Au clic sur un résultat, bascule vers la carte et zoome
    showMapView(); 
    mapRenderer.zoomToStop(stop);
    document.getElementById('horaires-search-bar').value = stop.stop_name;
    document.getElementById('horaires-search-results').classList.add('hidden');
}

/**
 * Fonction de mise à jour principale, appelée à chaque tick
 * @param {object} [timeInfo] - Objet de timeManager contenant { seconds, date, ... }. Peut être undefined.
 */
function updateData(timeInfo) {
    const currentSeconds = timeInfo ? timeInfo.seconds : timeManager.getCurrentSeconds();
    const currentDate = timeInfo ? timeInfo.date : new Date(); 
    
    updateClock(currentSeconds);
    
    /* MODIFICATION: Ne récupère QUE les bus en service (en mouvement ou arrêt intermédiaire) */
    const activeBuses = tripScheduler.getActiveTrips(currentSeconds, currentDate);
    
    /* La logique getWaitingBuses (terminus) est supprimée */

    const allBusesWithPositions = busPositionCalculator.calculateAllPositions(activeBuses);

    // MODIFICATION: Ajoute l'état du trafic à chaque bus
    allBusesWithPositions.forEach(bus => {
        if (bus && bus.route) {
            const routeId = bus.route.route_id;
            bus.currentStatus = (lineStatuses[routeId] && lineStatuses[routeId].status) 
                                ? lineStatuses[routeId].status 
                                : 'normal';
        }
    });
    
    const visibleBuses = allBusesWithPositions
        .filter(bus => bus !== null)
        .filter(bus => bus.route && visibleRoutes.has(bus.route.route_id)); 
    
    mapRenderer.updateBusMarkers(visibleBuses, tripScheduler, currentSeconds);
    
    const visibleBusCount = visibleBuses.length;
    updateBusCount(visibleBusCount, visibleBusCount); // Le total est maintenant juste les bus actifs
}

function updateClock(seconds) {
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('current-time').textContent = timeString;
    
    const now = new Date();
    const dateString = now.toLocaleDateString('fr-FR', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
    });
    document.getElementById('date-indicator').textContent = dateString;
}

function updateBusCount(visible, total) {
    const busCountElement = document.getElementById('bus-count');
    // Simplifié car visible et total sont identiques
    busCountElement.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10"/>
        </svg>
        ${visible} bus
    `;
}

function updateDataStatus(message, status = '') {
    const statusElement = document.getElementById('data-status');
    statusElement.className = status;
    statusElement.textContent = message;
}

initializeApp();
