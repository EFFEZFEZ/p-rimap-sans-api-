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

// NOUVELLES ICÔNES SVG
const ICONS = {
    // NOUVELLE ICÔNE (plus propre, inspirée de l'exemple)
    busSmall: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15C5 16.0915 5.223 17.1383 5.62099 18.092C5.69766 18.261 5.7871 18.4233 5.888 18.5768C6.00244 18.7508 6.09642 18.9038 6.166 18.997C6.23072 19.0837 6.27976 19.1437 6.333 19.197C6.40201 19.266 6.49003 19.354 6.59604 19.4599C6.80806 19.672 7.0736 19.9375 7.37871 20.2426C7.98892 20.8528 8.79619 21.4646 9.67157 21.7487C10.547 22.0328 11.453 22.0328 12.3284 21.7487C13.2038 21.4646 14.0111 20.8528 14.6213 20.2426C14.9264 19.9375 15.1919 19.672 15.404 19.4599C15.51 19.354 15.598 19.266 15.667 19.197C15.7202 19.1437 15.7693 19.0837 15.834 18.997C15.9036 18.9038 15.9976 18.7508 16.112 18.5768C16.2129 18.4233 16.3023 18.261 16.379 18.092C16.777 17.1383 17 16.0915 17 15"/><path d="M5 15V8C5 6.84078 5.223 5.79396 5.62099 4.84024C5.69766 4.67119 5.7871 4.50887 5.888 4.35639C6.00244 4.18231 6.09642 4.02931 6.166 3.93605C6.23072 3.84938 6.27976 3.78931 6.333 3.73605C6.40201 3.66704 6.49003 3.57902 6.59604 3.47301C6.80806 3.26099 7.0736 2.99545 7.37871 2.69034C7.98892 2.08013 8.79619 1.46831 9.67157 1.18417C10.547 0.900024 11.453 0.900024 12.3284 1.18417C13.2038 1.46831 14.0111 2.08013 14.6213 2.69034C14.9264 2.99545 15.1919 3.26099 15.404 3.47301C15.51 3.57902 15.598 3.66704 15.667 3.73605C15.7202 3.78931 15.7693 3.84938 15.834 3.93605C15.9036 4.02931 15.9976 4.18231 16.112 4.35639C16.2129 4.50887 16.3023 4.67119 16.379 4.84024C16.777 5.79396 17 6.84078 17 8V15"/><rect width="12" height="4" x="5" y="8" rx="1"/><path d="M3 11H5"/><path d="M17 11H19"/></svg>`,
    statusWarning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    statusError: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    alertBanner: (type) => {
        if (type === 'annulation') return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        if (type === 'retard') return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    }
};

// NOUVEAUX ÉLÉMENTS DOM (Tableau de bord)
let dashboardContainer;
let infoTraficList, infoTraficAvenir;
let infoTraficCount;
let alertBanner, alertBannerContent, alertBannerClose;
let btnAdminConsole;
let ficheHoraireContainer;

// ÉLÉMENTS DOM (Vue Carte)
let mapContainer;
let btnShowMap, btnBackToDashboard;
let searchBar, searchResultsContainer; // Maintenant pour la carte Horaires

// Catégories de lignes
const LINE_CATEGORIES = {
    'majeures': { name: 'Lignes majeures', lines: ['A', 'B', 'C', 'D'], color: '#2563eb' },
    'express': { name: 'Lignes express', lines: ['e1', 'e2', 'e4', 'e5', 'e6', 'e7'], color: '#dc2626' },
    'quartier': { name: 'Lignes de quartier', lines: ['K1A', 'K1B', 'K2', 'K3A', 'K3B', 'K4A', 'K4B', 'K5', 'K6'], color: '#059669' },
    'rabattement': { name: 'Lignes de rabattement', lines: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15'], color: '#7c3aed' },
    'navettes': { name: 'Navettes', lines: ['N', 'N1'], color: '#f59e0b' }
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
    infoTraficAvenir = document.getElementById('info-trafic-avenir');
    infoTraficCount = document.getElementById('info-trafic-count');
    alertBanner = document.getElementById('alert-banner');
    alertBannerContent = document.getElementById('alert-banner-content');
    alertBannerClose = document.getElementById('alert-banner-close');
    btnAdminConsole = document.getElementById('btn-admin-console');
    ficheHoraireContainer = document.getElementById('fiche-horaire-container');

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
 * Configure le tableau de bord (état du trafic, admin, fiches horaires)
 */
function setupDashboard() {
    // Initialise l'état de toutes les lignes
    dataManager.routes.forEach(route => {
        lineStatuses[route.route_id] = { status: 'normal', message: '' };
    });

    // Affiche la carte Info Trafic
    renderInfoTraficCard();

    // NOUVEAU: Construit la liste des fiches horaires
    buildFicheHoraireList();

    // Configure la console admin
    setupAdminConsole();

    // Configure les boutons de basculement de vue
    btnShowMap.addEventListener('click', showMapView);
    btnBackToDashboard.addEventListener('click', showDashboardView);
    alertBannerClose.addEventListener('click', () => alertBanner.classList.add('hidden'));

    // NOUVEAU: Gère les onglets "en cours" / "à venir"
    document.querySelectorAll('.tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Gère l'état actif du bouton
            document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Gère l'affichage du contenu
            const tabContent = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                if (content.dataset.content === tabContent) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
        });
    });
}

/**
 * Logique de la console d'administration
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
    };
}

/**
 * Affiche la carte "Info Trafic" (Design en grille)
 */
function renderInfoTraficCard() {
    infoTraficList.innerHTML = '';
    infoTraficList.className = 'info-trafic-grid tab-content active'; // Applique le style de grille
    let alertCount = 0;
    
    // Filtre pour les catégories demandées
    const allowedCategories = ['majeures', 'express', 'de quartier'];

    dataManager.routes.forEach(route => {
        const category = getCategoryForRoute(route.route_short_name);
        if (!allowedCategories.includes(category)) {
            return; // Saute cette ligne
        }

        const state = lineStatuses[route.route_id] || { status: 'normal', message: '' };
        const routeColor = route.route_color ? `#${route.route_color}` : '#3388ff';
        const textColor = route.route_text_color ? `#${route.route_text_color}` : '#ffffff';

        let statusIcon = '';
        if (state.status !== 'normal') {
            alertCount++;
            let iconSvg = (state.status === 'annulation') ? ICONS.statusError : ICONS.statusWarning;
            statusIcon = `<div class="status-indicator type-${state.status}">${iconSvg}</div>`;
        }

        const item = document.createElement('div');
        item.className = `trafic-item-grid status-${state.status}`;
        item.innerHTML = `
            <span class="icon-bus-small">${ICONS.busSmall}</span>
            <span class="line-badge" style="background-color: ${routeColor}; color: ${textColor};">
                ${route.route_short_name}
            </span>
            ${statusIcon}
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
 * NOUVEAU: Construit l'accordéon des fiches horaires
 */
function buildFicheHoraireList() {
    ficheHoraireContainer.innerHTML = ''; // Vide le conteneur

    // 1. Grouper les routes par catégorie (inspiré de votre exemple)
    const groupedRoutes = {
        'Lignes A, B, C et D': [],
        'Lignes e': [],
        'Lignes K': [],
        'Lignes N': [],
        'Lignes R': [],
    };

    dataManager.routes.forEach(route => {
        const name = route.route_short_name;
        if (['A', 'B', 'C', 'D'].includes(name)) {
            groupedRoutes['Lignes A, B, C et D'].push(route);
        } else if (name.startsWith('e')) {
            groupedRoutes['Lignes e'].push(route);
        } else if (name.startsWith('K')) {
            groupedRoutes['Lignes K'].push(route);
        } else if (name.startsWith('N')) {
            groupedRoutes['Lignes N'].push(route);
        } else if (name.startsWith('R')) {
            groupedRoutes['Lignes R'].push(route);
        }
    });

    // 2. Construire l'HTML
    for (const [groupName, routes] of Object.entries(groupedRoutes)) {
        if (routes.length === 0) continue;

        const accordionGroup = document.createElement('div');
        accordionGroup.className = 'accordion-group';

        let linksHtml = '';
        // Trie les lignes (ex: R1, R2, R10...)
        routes.sort((a, b) => {
            const numA = parseInt(a.route_short_name.replace(/[^0-9]/g, ''), 10);
            const numB = parseInt(b.route_short_name.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return a.route_short_name.localeCompare(b.route_short_name);
        });
        
        routes.forEach(route => {
            // Crée le lien vers le PDF dans le dossier /data/fichehoraire/
            const pdfPath = `/data/fichehoraire/${route.route_short_name}.pdf`;
            linksHtml += `<a href="${pdfPath}" target="_blank" rel="noopener noreferrer">
                ${route.route_long_name || `Ligne ${route.route_short_name}`}
            </a>`;
        });

        accordionGroup.innerHTML = `
            <details>
                <summary>${groupName}</summary>
                <div class="accordion-content">
                    ${linksHtml}
                </div>
            </details>
        `;
        ficheHoraireContainer.appendChild(accordionGroup);
    }
}


/**
 * Affiche le bandeau d'alerte en haut (avec icônes)
 */
function renderAlertBanner() {
    let alerts = [];
    let firstAlertStatus = 'normal';
    
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

    if (alerts.some(a => a.status === 'annulation')) {
        firstAlertStatus = 'annulation';
    } else if (alerts.some(a => a.status === 'perturbation')) {
        firstAlertStatus = 'perturbation';
    } else {
        firstAlertStatus = 'retard';
    }
    alertBanner.className = `type-${firstAlertStatus}`;
    
    let alertIcon = ICONS.alertBanner(firstAlertStatus);
    let alertText = alerts.map(a => 
        `<strong>Ligne ${a.name}</strong>`
    ).join(', ');
    
    alertBannerContent.innerHTML = `${alertIcon} <strong>Infos Trafic:</strong> ${alertText}`;
    alertBanner.classList.remove('hidden');
}


/**
 * Fonctions de basculement de vue
 */
function showMapView() {
    dashboardContainer.classList.add('hidden');
    mapContainer.classList.remove('hidden');
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

/**
 * RÉPARÉ: Attache tous les écouteurs d'événements
 */
function setupEventListeners() {
    
    // NOUVEAU: Scroll pour les boutons de navigation
    document.querySelectorAll('.nav-button[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

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

    // RÉPARÉ: Écouteurs pour la VUE TABLEAU DE BORD (recherche horaires)
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

/**
 * RÉPARÉ: Logique de recherche (utilise la variable globale)
 */
function handleSearchInput(e) {
    const query = e.target.value.toLowerCase();
    
    if (query.length < 2) {
        searchResultsContainer.classList.add('hidden');
        searchResultsContainer.innerHTML = '';
        return;
    }

    const matches = dataManager.masterStops
        .filter(stop => stop.stop_name.toLowerCase().includes(query))
        .slice(0, 10); 

    displaySearchResults(matches, query);
}

/**
 * RÉPARÉ: Affiche les résultats (utilise la variable globale)
 */
function displaySearchResults(stops, query) {
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

/**
 * RÉPARÉ: Clic sur résultat (utilise les variables globales)
 */
function onSearchResultClick(stop) {
    showMapView(); 
    mapRenderer.zoomToStop(stop);
    searchBar.value = stop.stop_name; // 'searchBar' est correct
    searchResultsContainer.classList.add('hidden'); // 'searchResultsContainer' est correct
}

/**
 * Fonction de mise à jour principale, appelée à chaque tick
 */
function updateData(timeInfo) {
    const currentSeconds = timeInfo ? timeInfo.seconds : timeManager.getCurrentSeconds();
    const currentDate = timeInfo ? timeInfo.date : new Date(); 
    
    updateClock(currentSeconds);
    
    const activeBuses = tripScheduler.getActiveTrips(currentSeconds, currentDate);
    
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
    updateBusCount(visibleBusCount, visibleBusCount);
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
