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
let resultsMapRenderer; // NOUVEAU: Une 2e instance de carte pour les résultats
let visibleRoutes = new Set();

// NOUVEL ÉTAT GLOBAL
let lineStatuses = {}; // Stocke l'état de chaque ligne (par route_id)

// NOUVELLES ICÔNES SVG
const ICONS = {
    // VECTEUR BUS CORRIGÉ
    busSmall: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2l.64 2.54c.24.95-.54 1.96-1.54 1.96H4c-1 0-1.78-1.01-1.54-1.96L3 17h2"/><path d="M19 17V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v12h14z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
    statusTriangle: `<svg width="16" height="8" viewBox="0 0 16 8" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 0L16 8H0L8 0Z" /></svg>`,
    statusWarning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    statusError: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    alertBanner: (type) => {
        if (type === 'annulation') return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        if (type === 'retard') return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    }
};

// Mappage des noms de fichiers PDF
const PDF_FILENAME_MAP = {
    'A': 'grandperigueux_fiche_horaires_ligne_A_sept_2025.pdf',
    'B': 'grandperigueux_fiche_horaires_ligne_B_sept_2025.pdf',
    'C': 'grandperigueux_fiche_horaires_ligne_C_sept_2025.pdf',
    'D': 'grandperigueux_fiche_horaires_ligne_D_sept_2025.pdf',
    'e1': 'grandperigueux_fiche_horaires_ligne_e1_sept_2025.pdf',
    'e2': 'grandperigueux_fiche_horaires_ligne_e2_sept_2025.pdf',
    'e4': 'grandperigueux_fiche_horaires_ligne_e4_sept_2025.pdf',
    'e5': 'grandperigueux_fiche_horaires_ligne_e5_sept_2025.pdf',
    'e6': 'grandperigueux_fiche_horaires_ligne_e6_sept_2025.pdf',
    'e7': 'grandperigueux_fiche_horaires_ligne_e7_sept_2025.pdf',
    'K1A': 'grandperigueux_fiche_horaires_ligne_K1A_sept_2025.pdf',
    'K1B': 'grandperigueux_fiche_horaires_ligne_K1B_sept_2025.pdf',
    'K2': 'grandperigueux_fiche_horaires_ligne_K2_sept_2025.pdf',
    'K3A': 'grandperigueux_fiche_horaires_ligne_K3A_sept_2025.pdf',
    'K3B': 'grandperigueux_fiche_horaires_ligne_K3B_sept_2025.pdf',
    'K4A': 'grandperigueux_fiche_horaires_ligne_K4A_sept_2025.pdf',
    'K4B': 'grandperigueux_fiche_horaires_ligne_K4B_sept_2025.pdf',
    'K5': 'grandperigueux_fiche_horaires_ligne_K5_sept_2025.pdf',
    'K6': 'grandperigueux_fiche_horaires_ligne_K6_sept_2025.pdf',
    'N': 'grandperigueux_fiche_horaires_ligne_N_sept_2025.pdf',
    'N1': 'grandperigueux_fiche_horaires_ligne_N1_sept_2025.pdf',
};

// Mappage des noms longs
const ROUTE_LONG_NAME_MAP = {
    'A': 'ZAE Marsac <> Centre Hospitalier',
    'B': 'Les Tournesols <> Gare SNCF',
    'C': 'ZAE Marsac <> P+R Aquacap',
    'D': 'P+R Charrieras <> Tourny',
    'e1': 'ZAE Marsac <> P+R Aquacap',
    'e2': 'Talleyrand Périgord <> Fromarsac',
    'e4': 'Charrieras <> La Feuilleraie <> Tourny',
    'e5': 'Les Tournesols <> PEM',
    'e6': 'Créavallée <> Trésorerie municipale',
    'e7': 'Notre-Dame de Sanilhac poste <> Les Lilas hôpital',
    'K1A': 'Maison Rouge <> Tourny / La Rudeille <> Tourny',
    'K1B': 'Le Lac <> Pôle universitaire Grenadière <> Taillefer',
    'K2': 'Champcevinel bourg <> Tourny',
    'K3A': 'La Feuilleraie <> Place du 8 mai',
    'K3B': 'Pépinière <> Place du 8 mai',
    'K4A': 'Sarrazi <> Dojo départemental <> Tourny',
    'K4B': 'Coulounieix bourg <> Tourny',
    'K5': 'Halte ferroviaire Boulazac <> La Feuilleraie',
    'K6': 'Halte ferroviaire Marsac sur l’Isle',
    'N': 'Tourny <> PEM',
    'N1': 'Gare SNCF <> 8 mai <> Tourny <> Gare SNCF',
};


// ÉLÉMENTS DOM (VUE 1: DASHBOARD)
let dashboardContainer, dashboardHall, dashboardContentView, btnBackToHall;
let infoTraficList, infoTraficAvenir;
let infoTraficCount;
let alertBanner, alertBannerContent, alertBannerClose;
let btnAdminConsole;
let ficheHoraireContainer;
let searchBar, searchResultsContainer;
let plannerWhenBtn, plannerOptionsPopover, plannerSubmitBtn;

// ÉLÉMENTS DOM (VUE 2: CARTE)
let mapContainer, btnShowMap, btnBackToDashboardFromMap;

// ÉLÉMENTS DOM (VUE 3: RÉSULTATS)
let itineraryResultsContainer, btnBackToDashboardFromResults, resultsListContainer;


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
    // --- 1. SÉLECTIONNER LES ÉLÉMENTS DOM ---
    dashboardContainer = document.getElementById('dashboard-container');
    dashboardHall = document.getElementById('dashboard-hall');
    dashboardContentView = document.getElementById('dashboard-content-view');
    btnBackToHall = document.getElementById('btn-back-to-hall');
    
    infoTraficList = document.getElementById('info-trafic-list');
    infoTraficAvenir = document.getElementById('info-trafic-avenir');
    infoTraficCount = document.getElementById('info-trafic-count');
    alertBanner = document.getElementById('alert-banner');
    alertBannerContent = document.getElementById('alert-banner-content');
    alertBannerClose = document.getElementById('alert-banner-close');
    btnAdminConsole = document.getElementById('btn-admin-console');
    ficheHoraireContainer = document.getElementById('fiche-horaire-container');
    searchBar = document.getElementById('horaires-search-bar');
    searchResultsContainer = document.getElementById('horaires-search-results');
    plannerWhenBtn = document.getElementById('planner-when-btn');
    plannerOptionsPopover = document.getElementById('planner-options-popover');
    plannerSubmitBtn = document.getElementById('planner-submit-btn');

    mapContainer = document.getElementById('map-container');
    btnShowMap = document.getElementById('btn-show-map');
    btnBackToDashboardFromMap = document.getElementById('btn-back-to-dashboard-from-map');
    
    itineraryResultsContainer = document.getElementById('itinerary-results-container');
    btnBackToDashboardFromResults = document.getElementById('btn-back-to-dashboard-from-results');
    // *** NOUVEL ÉLÉMENT SÉLECTIONNÉ ***
    resultsListContainer = document.querySelector('#itinerary-results-container .results-list');


    // --- 2. ATTACHER LES ÉCOUTEURS STATIQUES ---
    setupStaticEventListeners();

    // --- 3. CHARGER LES DONNÉES ET INITIALISER LE RESTE ---
    dataManager = new DataManager();
    
    try {
        await dataManager.loadAllData();
        
        // --- 4. INITIALISER LES MODULES DÉPENDANTS DES DONNÉES ---
        timeManager = new TimeManager();
        
        // Initialise la carte principale (plein écran)
        mapRenderer = new MapRenderer('map', dataManager, timeManager);
        mapRenderer.initializeMap();

        // Initialise la 2e carte (celle des résultats)
        resultsMapRenderer = new MapRenderer('results-map', dataManager, timeManager);
        resultsMapRenderer.initializeMap(false); // false = n'ajoute pas les bus/arrêts par défaut

        
        tripScheduler = new TripScheduler(dataManager);
        busPositionCalculator = new BusPositionCalculator(dataManager);
        
        // --- 5. POPULER L'UI AVEC LES DONNÉES ---
        initializeRouteFilter();
        
        if (dataManager.geoJson) {
            mapRenderer.displayMultiColorRoutes(dataManager.geoJson, dataManager, visibleRoutes);
        }

        mapRenderer.displayStops();
        setupDashboardContent(); 

        // --- 6. ATTACHER LES ÉCOUTEURS DÉPENDANTS DES DONNÉES ---
        setupDataDependentEventListeners();

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
 * Configure le *contenu* du tableau de bord (nécessite les données)
 */
function setupDashboardContent() {
    dataManager.routes.forEach(route => {
        lineStatuses[route.route_id] = { status: 'normal', message: '' };
    });

    renderInfoTraficCard();
    buildFicheHoraireList();
    setupAdminConsole();
}

/**
 * Attache les écouteurs pour les éléments HTML statiques
 */
function setupStaticEventListeners() {
    // --- Écouteurs de navigation du Dashboard ---
    document.querySelectorAll('.main-nav-buttons-condensed .nav-button-condensed[data-view]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const view = button.dataset.view;
            showDashboardView(view);
        });
    });

    // Bouton "Carte Interactive" -> Vue Carte Plein Écran
    btnShowMap.addEventListener('click', showMapView); 
    
    // Bouton "Rechercher" -> Vue Résultats d'Itinéraire
    plannerSubmitBtn.addEventListener('click', (e) => {
        e.preventDefault(); 
        if (plannerOptionsPopover && !plannerOptionsPopover.classList.contains('hidden')) {
            plannerOptionsPopover.classList.add('hidden');
            plannerWhenBtn.classList.remove('popover-active');
        }
        console.log("Recherche lancée, transition vers la vue RÉSULTATS...");
        showResultsView(); 
    });

    // Boutons de retour
    btnBackToDashboardFromMap.addEventListener('click', showDashboardHall);
    btnBackToDashboardFromResults.addEventListener('click', showDashboardHall);
    btnBackToHall.addEventListener('click', showDashboardHall);

    alertBannerClose.addEventListener('click', () => alertBanner.classList.add('hidden'));
    
    // Onglets (Info Trafic)
    document.querySelectorAll('.tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabContent = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('hidden', content.dataset.content !== tabContent);
            });
        });
    });

    // --- Panneau de filtre et instructions ---
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
    const panelHandle = document.querySelector('.panel-handle');
    if (panelHandle) {
        panelHandle.addEventListener('click', () => {
            document.getElementById('route-filter-panel').classList.add('hidden');
        });
    }
    document.getElementById('select-all-routes').addEventListener('click', () => {
        if (dataManager) {
            dataManager.routes.forEach(route => {
                const checkbox = document.getElementById(`route-${route.route_id}`);
                if (checkbox) checkbox.checked = true;
            });
            handleRouteFilterChange();
        }
    });
    document.getElementById('deselect-all-routes').addEventListener('click', () => {
        if (dataManager) {
            dataManager.routes.forEach(route => {
                const checkbox = document.getElementById(`route-${route.route_id}`);
                if (checkbox) checkbox.checked = false;
            });
            handleRouteFilterChange();
        }
    });

    // --- Recherche d'horaires ---
    document.getElementById('btn-horaires-search-focus').addEventListener('click', () => {
        const horairesCard = document.getElementById('horaires');
        if (horairesCard) {
            const mainDashboard = document.getElementById('dashboard-main');
            if (mainDashboard) {
                 mainDashboard.scrollTo({ top: horairesCard.offsetTop - 80, behavior: 'smooth' });
            }
        }
        searchBar.focus();
    });
    searchBar.addEventListener('input', handleSearchInput);
    searchBar.addEventListener('focus', handleSearchInput);


    // --- Planificateur (popover "QUAND") ---
    if (plannerWhenBtn && plannerOptionsPopover) { 
        plannerWhenBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            plannerOptionsPopover.classList.toggle('hidden');
            plannerWhenBtn.classList.toggle('popover-active');
        });
        document.querySelectorAll('.popover-tab').forEach(tab => { 
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.popover-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const mainBtnText = document.querySelector('#planner-when-btn span');
                const popoverSubmitBtn = document.getElementById('popover-submit-btn');
                if (e.currentTarget.dataset.tab === 'arriver') { 
                    mainBtnText.textContent = 'Arriver à...'; 
                    popoverSubmitBtn.textContent = "Valider l'arrivée"; // Correction de l'apostrophe
                } else {
                    mainBtnText.textContent = 'Partir maintenant';
                    popoverSubmitBtn.textContent = 'Partir maintenant';
                }
            });
        });
        document.getElementById('popover-submit-btn').addEventListener('click', () => { 
             plannerOptionsPopover.classList.add('hidden');
             plannerWhenBtn.classList.remove('popover-active');
        });
        plannerOptionsPopover.addEventListener('click', (e) => e.stopPropagation()); 
    }
    
    // --- Bouton SWAP ---
    const swapBtn = document.querySelector('.btn-swap-direction'); 
    if (swapBtn) {
        swapBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const fromInput = document.getElementById('hall-planner-from');
            const toInput = document.getElementById('hall-planner-to');
            const fromVal = fromInput.value;
            fromInput.value = toInput.value;
            toInput.value = fromVal;
        });
    }

    // --- Écouteur global "Click Outside" ---
    document.addEventListener('click', (e) => {
        if (searchResultsContainer && !e.target.closest('#horaires-search-container')) {
            searchResultsContainer.classList.add('hidden');
        }
        if (plannerOptionsPopover && !e.target.closest('.form-group-when')) {
            if (!plannerOptionsPopover.classList.contains('hidden')) {
                plannerOptionsPopover.classList.add('hidden');
                if (plannerWhenBtn) {
                    plannerWhenBtn.classList.remove('popover-active');
                }
            }
        }
    });
}

/**
 * Attache les écouteurs qui dépendent des modules chargés (map, time)
 */
function setupDataDependentEventListeners() {
    if (timeManager) {
        timeManager.addListener(updateData);
    }
    if (mapRenderer && mapRenderer.map) {
        mapRenderer.map.on('zoomend', () => {
            if (dataManager) {
                mapRenderer.displayStops();
            }
        });
    }
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

    window.setStatus = (lineShortName, status, message = "") => {
        if (!dataManager) {
            console.warn("DataManager n'est pas encore chargé.");
            return;
        }
        const route = dataManager.routes.find(r => r.route_short_name === lineShortName);
        if (!route) {
            console.warn(`Ligne "${lineShortName}" non trouvée.`);
            return;
        }
        if (!['normal', 'perturbation', 'retard', 'annulation'].includes(status)) {
            console.warn(`Statut "${status}" invalide.`);
            return;
        }
        console.log(`Mise à jour statut: Ligne ${lineShortName} -> ${status.toUpperCase()}`);
        lineStatuses[route.route_id] = { status, message };
        renderInfoTraficCard();
        renderAlertBanner();
    };
}

/**
 * Affiche la carte "Info Trafic"
 */
function renderInfoTraficCard() {
    if (!dataManager || !infoTraficList) return;
    infoTraficList.innerHTML = '';
    let alertCount = 0;
    
    const groupedRoutes = {
        'majeures': { name: 'Lignes majeures', routes: [] },
        'express': { name: 'Lignes express', routes: [] },
        'quartier': { name: 'Lignes de quartier', routes: [] },
        'navettes': { name: 'Navettes', routes: [] }
    };
    const allowedCategories = ['majeures', 'express', 'quartier', 'navettes'];

    dataManager.routes.forEach(route => {
        const category = getCategoryForRoute(route.route_short_name);
        if (allowedCategories.includes(category)) {
            groupedRoutes[category].routes.push(route);
        }
    });

    for (const [categoryId, categoryData] of Object.entries(groupedRoutes)) {
        if (categoryData.routes.length === 0) continue;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'trafic-group';
        
        let badgesHtml = '';
        categoryData.routes.sort((a, b) => { 
             return a.route_short_name.localeCompare(b.route_short_name, undefined, {numeric: true});
        });

        categoryData.routes.forEach(route => {
            const state = lineStatuses[route.route_id] || { status: 'normal', message: '' };
            const routeColor = route.route_color ? `#${route.route_color}` : '#3388ff';
            const textColor = route.route_text_color ? `#${route.route_text_color}` : '#ffffff';
            let statusIcon = '';
            let statusColor = 'transparent'; 
            if (state.status !== 'normal') {
                alertCount++;
                if (state.status === 'annulation') statusColor = 'var(--color-red)';
                else if (state.status === 'retard') statusColor = 'var(--color-yellow)';
                else statusColor = 'var(--color-orange)';
                statusIcon = `<div class="status-indicator-triangle type-${state.status}" style="border-bottom-color: ${statusColor};"></div>`;
            }
            badgesHtml += `
                <div class="trafic-badge-item status-${state.status}">
                    <span class="line-badge" style="background-color: ${routeColor}; color: ${textColor};">
                        ${route.route_short_name}
                    </span>
                    ${statusIcon}
                </div>
            `;
        });

        groupDiv.innerHTML = `
            <h4>${categoryData.name}</h4>
            <div class="trafic-badge-list">
                ${badgesHtml}
            </div>
        `;
        infoTraficList.appendChild(groupDiv);
    }
    infoTraficCount.textContent = alertCount;
    infoTraficCount.classList.toggle('hidden', alertCount === 0);
}


/**
 * Construit l'accordéon des fiches horaires
 */
function buildFicheHoraireList() {
    if (!dataManager || !ficheHoraireContainer) return;
    ficheHoraireContainer.innerHTML = '';

    const groupedRoutes = {
        'Lignes A, B, C et D': [],
        'Lignes e': [],
        'Lignes K': [],
        'Lignes N': [],
        'Lignes R': [],
    };

    dataManager.routes.forEach(route => {
        const name = route.route_short_name;
        if (['A', 'B', 'C', 'D'].includes(name)) groupedRoutes['Lignes A, B, C et D'].push(route);
        else if (name.startsWith('e')) groupedRoutes['Lignes e'].push(route);
        else if (name.startsWith('K')) groupedRoutes['Lignes K'].push(route);
        else if (name.startsWith('N')) groupedRoutes['Lignes N'].push(route);
        else if (name.startsWith('R')) groupedRoutes['Lignes R'].push(route);
    });

    for (const [groupName, routes] of Object.entries(groupedRoutes)) {
        if (routes.length === 0) continue;
        const accordionGroup = document.createElement('div');
        accordionGroup.className = 'accordion-group';
        let linksHtml = '';
        
        if (groupName === 'Lignes R') {
            linksHtml = `
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R1_R2_R3_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R1, R2, R3 La Feuilleraie &lt;&gt; ESAT / Les Gourdoux &lt;&gt; Trélissac Les Garennes / Les Pinots &lt;&gt; P+R Aquacap</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R4_R5_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R4, R5 Route de Payenché &lt;&gt; Collège Jean Moulin / Les Mondines / Clément Laval &lt;&gt; Collège Jean Moulin</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R6_R7_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R6, R7 Maison des Compagnons &lt;&gt; Gour de l’Arche poste / Le Charpe &lt;&gt; Gour de l’Arche poste</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R8_R9_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R8, R9 Jaunour &lt;&gt; Boulazac centre commercial / Stèle de Lesparat &lt;&gt; Place du 8 mai</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R10_R11_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R10, R11 Notre Dame de Sanilhac poste &lt;&gt; Centre de la communication / Héliodore &lt;&gt; Place du 8 mai</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R12_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Ligne R12 Le Change &lt;&gt; Boulazac centre commercial</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R13_R14_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R13, R14 Coursac &lt;&gt; Razac sur l’Isle / La Chapelle Gonaguet &lt;&gt;Razac sur l’Isle</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R15_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Ligne R15 Boulazac Isle Manoire &lt;&gt; Halte ferroviaire Niversac</a>
            `;
        } else {
            routes.sort((a, b) => a.route_short_name.localeCompare(b.route_short_name, undefined, {numeric: true}));
            routes.forEach(route => {
                let pdfName = PDF_FILENAME_MAP[route.route_short_name];
                let pdfPath = pdfName ? `/data/fichehoraire/${pdfName}` : '#';
                if (!pdfName) console.warn(`PDF non mappé pour ${route.route_short_name}.`);
                const longName = ROUTE_LONG_NAME_MAP[route.route_short_name] || (route.route_long_name ? route.route_long_name.replace(/<->/g, '<=>') : '');
                const displayName = `Ligne ${route.route_short_name} ${longName}`.trim();
                linksHtml += `<a href="${pdfPath}" target="_blank" rel="noopener noreferrer">${displayName}</a>`;
            });
        }

        if (linksHtml) {
            accordionGroup.innerHTML = `
                <details>
                    <summary>${groupName}</summary>
                    <div class="accordion-content">
                        <div class="accordion-content-inner">
                            ${linksHtml}
                        </div>
                    </div>
                </details>
            `;
            ficheHoraireContainer.appendChild(accordionGroup);
        }
    }
    
    // Attache les écouteurs de l'accordéon APRÈS avoir créé les éléments
    const allDetails = document.querySelectorAll('#fiche-horaire-container details');
    allDetails.forEach(details => {
        details.addEventListener('toggle', (event) => {
            if (event.target.open) {
                allDetails.forEach(d => {
                    if (d !== event.target && d.open) {
                        d.open = false;
                    }
                });
            }
        });
    });
}


/**
 * Affiche le bandeau d'alerte en haut
 */
function renderAlertBanner() {
    let alerts = [];
    let firstAlertStatus = 'normal';
    
    if (Object.keys(lineStatuses).length === 0) {
        alertBanner.classList.add('hidden');
        return;
    }
    
    for (const route_id in lineStatuses) {
        const state = lineStatuses[route_id];
        if (state.status !== 'normal') {
            const route = dataManager.getRoute(route_id);
            if (route) { // Vérifie que la route existe
                alerts.push({
                    name: route.route_short_name,
                    status: state.status,
                    message: state.message
                });
            }
        }
    }

    if (alerts.length === 0) {
        alertBanner.classList.add('hidden');
        return;
    }

    if (alerts.some(a => a.status === 'annulation')) firstAlertStatus = 'annulation';
    else if (alerts.some(a => a.status === 'perturbation')) firstAlertStatus = 'perturbation';
    else firstAlertStatus = 'retard';
    
    alertBanner.className = `type-${firstAlertStatus}`;
    let alertIcon = ICONS.alertBanner(firstAlertStatus);
    let alertText = alerts.map(a => `<strong>Ligne ${a.name}</strong>`).join(', ');
    alertBannerContent.innerHTML = `${alertIcon} <strong>Infos Trafic:</strong> ${alertText}`;
    alertBanner.classList.remove('hidden');
}


/**
 * Logique de changement de VUE
 */
function showMapView() {
    dashboardContainer.classList.add('hidden');
    itineraryResultsContainer.classList.add('hidden');
    mapContainer.classList.remove('hidden');
    document.body.classList.add('view-is-locked'); 
    if (mapRenderer && mapRenderer.map) {
        mapRenderer.map.invalidateSize();
    }
}

function showDashboardHall() {
    dashboardContainer.classList.remove('hidden');
    itineraryResultsContainer.classList.add('hidden');
    mapContainer.classList.add('hidden');
    document.body.classList.remove('view-is-locked'); 
    
    if (dataManager) { 
        renderAlertBanner(); 
    }
    dashboardContentView.classList.remove('view-is-active');
    dashboardHall.classList.add('view-is-active');
    document.querySelectorAll('#dashboard-content-view .card').forEach(card => {
        card.classList.remove('view-active');
    });
}

// *** FONCTION MODIFIÉE ***
function showResultsView() {
    dashboardContainer.classList.add('hidden');
    itineraryResultsContainer.classList.remove('hidden');
    mapContainer.classList.add('hidden');
    document.body.classList.add('view-is-locked');

    // Invalide la taille de la carte des résultats
    if (resultsMapRenderer && resultsMapRenderer.map) {
        resultsMapRenderer.map.invalidateSize();
    }

    // Vide la liste des résultats et affiche un message de chargement
    if (resultsListContainer) {
        resultsListContainer.innerHTML = '<p class="results-message">Recherche d\'itinéraire en cours...</p>';
    }

    // C'est ici qu'on lancera l'appel à l'API
    // fetchItinerary(); 
}
// *** FIN DE LA MODIFICATION ***

function showDashboardView(viewName) {
    dashboardHall.classList.remove('view-is-active');
    dashboardContentView.classList.add('view-is-active');

    const mainDashboard = document.getElementById('dashboard-main');
    if (mainDashboard) {
        mainDashboard.scrollTo({ top: 0, behavior: 'auto' });
    }

    document.querySelectorAll('#dashboard-content-view .card').forEach(card => {
        card.classList.remove('view-active');
    });

    const activeCard = document.getElementById(viewName);
    if (activeCard) {
        setTimeout(() => {
            activeCard.classList.add('view-active');
        }, 50);
    }
}


// --- Fonctions de l'application (logique métier) ---

function checkAndSetupTimeMode() {
    timeManager.setMode('real');
    timeManager.play();
    console.log('⏰ Mode TEMPS RÉEL activé.');
}

function initializeRouteFilter() {
    const routeCheckboxesContainer = document.getElementById('route-checkboxes');
    if (!routeCheckboxesContainer || !dataManager) return;

    routeCheckboxesContainer.innerHTML = '';
    visibleRoutes.clear();
    const routesByCategory = {};
    Object.keys(LINE_CATEGORIES).forEach(cat => { routesByCategory[cat] = []; });
    routesByCategory['autres'] = [];
    
    dataManager.routes.forEach(route => {
        visibleRoutes.add(route.route_id);
        const category = getCategoryForRoute(route.route_short_name);
        routesByCategory[category].push(route);
    });
    Object.values(routesByCategory).forEach(routes => {
        routes.sort((a, b) => a.route_short_name.localeCompare(b.route_short_name, undefined, {numeric: true}));
    });

    Object.entries(LINE_CATEGORIES).forEach(([categoryId, categoryInfo]) => {
        const routes = routesByCategory[categoryId];
        if (routes.length === 0) return;
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${categoryInfo.color}"><circle cx="12" cy="12" r="10"/></svg>
                <strong>${categoryInfo.name}</strong>
                <span class="category-count">(${routes.length})</span>
            </div>
            <div class="category-actions">
                <button class="btn-category-action" data-category="${categoryId}" data-action="select">Tous</button>
                <button class="btn-category-action" data-category="${categoryId}" data-action="deselect">Aucun</button>
            </div>`;
        routeCheckboxesContainer.appendChild(categoryHeader);
        
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'category-routes';
        categoryContainer.id = `category-${categoryId}`;
        routes.forEach(route => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'route-checkbox-item';
            const routeColor = route.route_color ? `#${route.route_color}` : '3388ff';
            const textColor = route.route_text_color ? `#${route.route_text_color}` : 'ffffff';
            itemDiv.innerHTML = `
                <input type="checkbox" id="route-${route.route_id}" data-category="${categoryId}" checked>
                <div class="route-badge" style="background-color: #${routeColor}; color: #${textColor};">
                    ${route.route_short_name || route.route_id}
                </div>
                <span class="route-name">${route.route_long_name || route.route_short_name || route.route_id}</span>
            `;
            
            itemDiv.querySelector('input[type="checkbox"]').addEventListener('change', handleRouteFilterChange);
            itemDiv.addEventListener('mouseenter', () => mapRenderer.highlightRoute(route.route_id, true));
            itemDiv.addEventListener('mouseleave', () => mapRenderer.highlightRoute(route.route_id, false));
            itemDiv.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                mapRenderer.zoomToRoute(route.route_id);
            });
            categoryContainer.appendChild(itemDiv);
        });
        routeCheckboxesContainer.appendChild(categoryContainer);
    });

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
    checkboxes.forEach(checkbox => { checkbox.checked = (action === 'select'); });
    handleRouteFilterChange();
}

function handleRouteFilterChange() {
    if (!dataManager) return;
    visibleRoutes.clear();
    dataManager.routes.forEach(route => {
        const checkbox = document.getElementById(`route-${route.route_id}`);
        if (checkbox && checkbox.checked) { visibleRoutes.add(route.route_id); }
    });
    if (dataManager.geoJson) {
        mapRenderer.displayMultiColorRoutes(dataManager.geoJson, dataManager, visibleRoutes);
    }
    updateData();
}

function handleSearchInput(e) {
    const query = e.target.value.toLowerCase();
    if (query.length < 2) {
        searchResultsContainer.classList.add('hidden');
        searchResultsContainer.innerHTML = '';
        return;
    }
    if (!dataManager) return;
    const matches = dataManager.masterStops
        .filter(stop => stop.stop_name.toLowerCase().includes(query))
        .slice(0, 10); 
    displaySearchResults(matches, query);
}

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

function onSearchResultClick(stop) {
    showMapView(); 
    if (mapRenderer) {
        mapRenderer.zoomToStop(stop);
        mapRenderer.onStopClick(stop);
    }
    searchBar.value = stop.stop_name;
    searchResultsContainer.classList.add('hidden');
}

/**
 * Fonction de mise à jour principale
 */
function updateData(timeInfo) {
    if (!timeManager || !tripScheduler || !busPositionCalculator || !mapRenderer) {
        return;
    }

    const currentSeconds = timeInfo ? timeInfo.seconds : timeManager.getCurrentSeconds();
    const currentDate = timeInfo ? timeInfo.date : new Date(); 
    
    updateClock(currentSeconds);
    
    const activeBuses = tripScheduler.getActiveTrips(currentSeconds, currentDate);
    const allBusesWithPositions = busPositionCalculator.calculateAllPositions(activeBuses);

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
    updateBusCount(visibleBuses.length, visibleBuses.length);
}

function updateClock(seconds) {
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) currentTimeEl.textContent = timeString;
    
    const now = new Date();
    const dateString = now.toLocaleDateString('fr-FR', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
    });
    const dateIndicatorEl = document.getElementById('date-indicator');
    if (dateIndicatorEl) dateIndicatorEl.textContent = dateString;
}

function updateBusCount(visible, total) {
    const busCountElement = document.getElementById('bus-count');
    if (busCountElement) {
        busCountElement.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            ${visible} bus
        `;
    }
}

function updateDataStatus(message, status = '') {
    const statusElement = document.getElementById('data-status');
    if (statusElement) {
        statusElement.className = status;
        statusElement.textContent = message;
    }
}

// Initialise l'application
initializeApp().then(() => {
    // Le Hall est déjà visible par défaut
});
