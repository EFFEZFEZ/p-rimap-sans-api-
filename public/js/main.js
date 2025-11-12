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
import { ApiManager } from './apiManager.js';

// *** ACTION REQUISE ***
// Remplacez cette chaîne par votre clé d'API Google Cloud
const GOOGLE_API_KEY = "AIzaSyBYDN_8hSHSx_irp_fxLw--XyxuLiixaW4";

// Modules
let dataManager;
let timeManager;
let tripScheduler;
let busPositionCalculator;
let mapRenderer;
let resultsMapRenderer; 
let visibleRoutes = new Set();
let apiManager; 

// NOUVEL ÉTAT GLOBAL
let lineStatuses = {}; 

// ICÔNES SVG
const ICONS = {
    busSmall: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2l.64 2.54c.24.95-.54 1.96-1.54 1.96H4c-1 0-1.78-1.01-1.54-1.96L3 17h2"/><path d="M19 17V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v12h14z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
    statusTriangle: `<svg width="16" height="8" viewBox="0 0 16 8" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 0L16 8H0L8 0Z" /></svg>`,
    statusWarning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    statusError: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    alertBanner: (type) => {
        if (type === 'annulation') return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        if (type === 'retard') return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
        return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    },
    WALK: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.7 0-1.3.4-1.7 1L8 8.3C7.2 9.5 5.8 10 4 10v2c1.1 0 2.1-.4 2.8-1.1l1-1.6 1.4 6.3L8 17v6h2l1-9.6L13.5 15v-3.4l-3.7-3.7z"/></svg>`,
    BUS: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2l.64 2.54c.24.95-.54 1.96-1.54 1.96H4c-1 0-1.78-1.01-1.54-1.96L3 17h2"/><path d="M19 17V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v12h14z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`
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

// ÉLÉMENTS DOM (VUE 2: CARTE)
let mapContainer, btnShowMap, btnBackToDashboardFromMap;

// ÉLÉMENTS DOM (VUE 3: RÉSULTATS)
let itineraryResultsContainer, btnBackToDashboardFromResults, resultsListContainer;
// PLANIFICATEUR (RÉSULTATS)
let resultsFromInput, resultsToInput, resultsFromSuggestions, resultsToSuggestions;
let resultsSwapBtn, resultsWhenBtn, resultsPopover, resultsDate, resultsHour, resultsMinute;
let resultsPopoverSubmitBtn, resultsPlannerSubmitBtn;

// --- ÉLÉMENTS DOM (PLANIFICATEUR DU HALL) ---
let hallPlannerSubmitBtn, hallFromInput, hallToInput, hallFromSuggestions, hallToSuggestions;
let hallWhenBtn, hallPopover, hallDate, hallHour, hallMinute, hallPopoverSubmitBtn, hallSwapBtn;

// État global pour les place_id (partagé par les deux formulaires)
let fromPlaceId = null;
let toPlaceId = null;


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

    mapContainer = document.getElementById('map-container');
    btnShowMap = document.getElementById('btn-show-map');
    btnBackToDashboardFromMap = document.getElementById('btn-back-to-dashboard-from-map');
    
    // VUE 3: RÉSULTATS (Général)
    itineraryResultsContainer = document.getElementById('itinerary-results-container');
    btnBackToDashboardFromResults = document.getElementById('btn-back-to-dashboard-from-results');
    resultsListContainer = document.querySelector('#itinerary-results-container .results-list');
    
    // VUE 3: PLANIFICATEUR (RÉSULTATS)
    resultsFromInput = document.getElementById('results-planner-from');
    resultsToInput = document.getElementById('results-planner-to');
    resultsFromSuggestions = document.getElementById('results-from-suggestions');
    resultsToSuggestions = document.getElementById('results-to-suggestions');
    resultsSwapBtn = document.getElementById('results-btn-swap-direction');
    resultsWhenBtn = document.getElementById('results-planner-when-btn');
    resultsPopover = document.getElementById('results-planner-options-popover');
    resultsDate = document.getElementById('results-popover-date');
    resultsHour = document.getElementById('results-popover-hour');
    resultsMinute = document.getElementById('results-popover-minute');
    resultsPopoverSubmitBtn = document.getElementById('results-popover-submit-btn');
    resultsPlannerSubmitBtn = document.getElementById('results-planner-submit-btn');

    // VUE 1: PLANIFICATEUR (HALL)
    hallPlannerSubmitBtn = document.getElementById('planner-submit-btn');
    hallFromInput = document.getElementById('hall-planner-from');
    hallToInput = document.getElementById('hall-planner-to');
    hallFromSuggestions = document.getElementById('from-suggestions');
    hallToSuggestions = document.getElementById('to-suggestions');
    hallSwapBtn = document.getElementById('hall-btn-swap-direction');
    hallWhenBtn = document.getElementById('planner-when-btn');
    hallPopover = document.getElementById('planner-options-popover');
    hallDate = document.getElementById('popover-date');
    hallHour = document.getElementById('popover-hour');
    hallMinute = document.getElementById('popover-minute');
    hallPopoverSubmitBtn = document.getElementById('popover-submit-btn');


    // --- 2. INITIALISER LES MANAGERS ---
    apiManager = new ApiManager(GOOGLE_API_KEY);
    dataManager = new DataManager();

    // --- 3. ATTACHER LES ÉCOUTEURS STATIQUES (y compris l'API Google) ---
    setupStaticEventListeners();

    // --- 4. CHARGER LES DONNÉES GTFS (pour la carte temps réel) ---
    try {
        await dataManager.loadAllData();
        
        timeManager = new TimeManager();
        
        mapRenderer = new MapRenderer('map', dataManager, timeManager);
        mapRenderer.initializeMap();

        resultsMapRenderer = new MapRenderer('results-map', dataManager, timeManager);
        resultsMapRenderer.initializeMap(false); 
        
        tripScheduler = new TripScheduler(dataManager);
        busPositionCalculator = new BusPositionCalculator(dataManager);
        
        initializeRouteFilter();
        
        if (dataManager.geoJson) {
            mapRenderer.displayMultiColorRoutes(dataManager.geoJson, dataManager, visibleRoutes);
        }

        mapRenderer.displayStops();
        setupDashboardContent(); 

        setupDataDependentEventListeners();

        if (localStorage.getItem('gtfsInstructionsShown') !== 'true') {
            document.getElementById('instructions').classList.remove('hidden');
        }
        
        updateDataStatus('Données chargées', 'loaded');
        checkAndSetupTimeMode();
        updateData(); 
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation GTFS:', error);
        updateDataStatus('Erreur de chargement GTFS', 'error');
    }
}

function setupDashboardContent() {
    dataManager.routes.forEach(route => {
        lineStatuses[route.route_id] = { status: 'normal', message: '' };
    });

    renderInfoTraficCard();
    buildFicheHoraireList();
    setupAdminConsole();
}

/**
 * Remplit les listes <select> pour l'heure et les minutes
 * ET initialise le champ date pour LES DEUX formulaires
 */
function populateTimeSelects() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = Math.round(now.getMinutes() / 5) * 5; 

    let selectedHour = currentHour;
    let selectedMinute = currentMinute;
    if (currentMinute === 60) {
        selectedMinute = 0;
        selectedHour = (currentHour + 1) % 24; 
    }
    
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    // Fonction interne pour remplir un <select>
    const populate = (dateEl, hourEl, minEl) => {
        if (!dateEl || !hourEl || !minEl) return;
        
        // Date
        dateEl.innerHTML = '';
        const todayOption = document.createElement('option');
        todayOption.value = today;
        todayOption.textContent = "Aujourd'hui";
        todayOption.selected = true;
        dateEl.appendChild(todayOption);
        
        const tomorrowOption = document.createElement('option');
        tomorrowOption.value = tomorrowDate;
        tomorrowOption.textContent = "Demain";
        dateEl.appendChild(tomorrowOption);

        // Heures
        hourEl.innerHTML = '';
        for (let h = 0; h < 24; h++) {
            const option = document.createElement('option');
            option.value = h;
            option.textContent = `${h} h`;
            if (h === selectedHour) option.selected = true;
            hourEl.appendChild(option);
        }

        // Minutes
        minEl.innerHTML = '';
        for (let m = 0; m < 60; m += 5) {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = String(m).padStart(2, '0');
            if (m === selectedMinute) option.selected = true;
            minEl.appendChild(option);
        }
    };

    // Remplir le formulaire du Hall
    populate(hallDate, hallHour, hallMinute);
    // Remplir le formulaire des Résultats
    populate(resultsDate, resultsHour, resultsMinute);
}


function setupStaticEventListeners() {
    try {
        apiManager.loadGoogleMapsAPI();
    } catch (error) {
        console.error("Impossible de charger l'API Google:", error);
    }

    // Remplit les sélecteurs de temps pour les DEUX formulaires
    populateTimeSelects();

    // --- Navigation principale ---
    document.querySelectorAll('.main-nav-buttons-condensed .nav-button-condensed[data-view]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const view = button.dataset.view;
            showDashboardView(view);
        });
    });

    btnShowMap.addEventListener('click', showMapView); 
    
    // --- Boutons de retour ---
    btnBackToDashboardFromMap.addEventListener('click', showDashboardHall);
    btnBackToDashboardFromResults.addEventListener('click', showDashboardHall); // Bouton "Retour" dans le panneau d'édition
    btnBackToHall.addEventListener('click', showDashboardHall);
    

    alertBannerClose.addEventListener('click', () => alertBanner.classList.add('hidden'));
    
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

    // --- Filtres et Instructions (pour la carte temps réel) ---
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

    // --- Recherche d'horaires (Système GTFS local) ---
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


    // --- ÉCOUTEURS DU PLANIFICATEUR (HALL) ---
    setupPlannerListeners('hall', {
        submitBtn: hallPlannerSubmitBtn,
        fromInput: hallFromInput,
        toInput: hallToInput,
        fromSuggestions: hallFromSuggestions,
        toSuggestions: hallToSuggestions,
        swapBtn: hallSwapBtn,
        whenBtn: hallWhenBtn,
        popover: hallPopover,
        dateSelect: hallDate,
        hourSelect: hallHour,
        minuteSelect: hallMinute,
        popoverSubmitBtn: hallPopoverSubmitBtn
    });

    // --- ÉCOUTEURS DU PLANIFICATEUR (RÉSULTATS) ---
    setupPlannerListeners('results', {
        submitBtn: resultsPlannerSubmitBtn,
        fromInput: resultsFromInput,
        toInput: resultsToInput,
        fromSuggestions: resultsFromSuggestions,
        toSuggestions: resultsToSuggestions,
        swapBtn: resultsSwapBtn,
        whenBtn: resultsWhenBtn,
        popover: resultsPopover,
        dateSelect: resultsDate,
        hourSelect: resultsHour,
        minuteSelect: resultsMinute,
        popoverSubmitBtn: resultsPopoverSubmitBtn
    });


    // Clic global "Click Outside"
    document.addEventListener('click', (e) => {
        if (searchResultsContainer && !e.target.closest('#horaires-search-container')) {
            searchResultsContainer.classList.add('hidden');
        }
        
        // Fermer les popovers des deux formulaires
        if (hallPopover && !e.target.closest('#hall-planner-from') && !e.target.closest('#hall-planner-to') && !e.target.closest('.form-group-when')) {
            if (!hallPopover.classList.contains('hidden')) {
                hallPopover.classList.add('hidden');
                hallWhenBtn.classList.remove('popover-active');
            }
        }
        if (resultsPopover && !e.target.closest('#results-planner-from') && !e.target.closest('#results-planner-to') && !e.target.closest('.form-group-when')) {
            if (!resultsPopover.classList.contains('hidden')) {
                resultsPopover.classList.add('hidden');
                resultsWhenBtn.classList.remove('popover-active');
            }
        }

        // Fermer les suggestions des deux formulaires
        if (!e.target.closest('.form-group')) {
            if (hallFromSuggestions) hallFromSuggestions.style.display = 'none';
            if (hallToSuggestions) hallToSuggestions.style.display = 'none';
            if (resultsFromSuggestions) resultsFromSuggestions.style.display = 'none';
            if (resultsToSuggestions) resultsToSuggestions.style.display = 'none';
        }
    });
}

/**
 * NOUVELLE FONCTION REFACTORISÉE
 * Attache tous les écouteurs nécessaires à un ensemble d'éléments de formulaire.
 * @param {string} source - 'hall' ou 'results'
 * @param {object} elements - Un objet contenant les éléments DOM pour ce formulaire
 */
function setupPlannerListeners(source, elements) {
    const { submitBtn, fromInput, toInput, fromSuggestions, toSuggestions, swapBtn, whenBtn, popover, dateSelect, hourSelect, minuteSelect, popoverSubmitBtn } = elements;

    // Bouton "Rechercher"
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        if (popover && !popover.classList.contains('hidden')) {
            popover.classList.add('hidden');
            whenBtn.classList.remove('popover-active');
        }
        
        // Exécuter la recherche
        await executeItinerarySearch(source, elements);
    });

    // Autocomplétion "Départ"
    fromInput.addEventListener('input', (e) => {
        handleAutocomplete(e.target.value, fromSuggestions, (placeId) => {
            fromPlaceId = placeId; 
        });
    });

    // Autocomplétion "Arrivée"
    toInput.addEventListener('input', (e) => {
        handleAutocomplete(e.target.value, toSuggestions, (placeId) => {
            toPlaceId = placeId; 
        });
    });

    // Popover "QUAND"
    if (whenBtn && popover) { 
        whenBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            popover.classList.toggle('hidden');
            whenBtn.classList.toggle('popover-active');
        });

        // Onglets "Partir" / "Arriver"
        popover.querySelectorAll('.popover-tab').forEach(tab => { 
            tab.addEventListener('click', (e) => {
                popover.querySelectorAll('.popover-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                const tabType = e.currentTarget.dataset.tab;
                popoverSubmitBtn.textContent = (tabType === 'arriver') ? "Valider l'arrivée" : 'Partir maintenant';
            });
        });
        
        // Bouton de validation du Popover
        popoverSubmitBtn.addEventListener('click', () => { 
             const dateText = dateSelect.options[dateSelect.selectedIndex].text;
             const hourText = String(hourSelect.value).padStart(2, '0');
             const minuteText = String(minuteSelect.value).padStart(2, '0');
             const tab = popover.querySelector('.popover-tab.active').dataset.tab;
             const mainBtnSpan = whenBtn.querySelector('span');
             
             let prefix = (tab === 'arriver') ? "Arrivée" : "Départ";
             if (dateText === "Aujourd'hui") {
                 mainBtnSpan.textContent = `${prefix} à ${hourText}h${minuteText}`;
             } else {
                 mainBtnSpan.textContent = `${prefix} ${dateText.toLowerCase()} à ${hourText}h${minuteText}`;
             }

             popover.classList.add('hidden');
             whenBtn.classList.remove('popover-active');
        });
        
        popover.addEventListener('click', (e) => e.stopPropagation()); 
    }
    
    // Bouton SWAP
    if (swapBtn) {
        swapBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const fromVal = fromInput.value;
            fromInput.value = toInput.value;
            toInput.value = fromVal;
            // L'état fromPlaceId/toPlaceId est partagé, donc on l'inverse aussi
            const tempId = fromPlaceId;
            fromPlaceId = toPlaceId;
            toPlaceId = tempId;
        });
    }
}

/**
 * NOUVELLE FONCTION REFACTORISÉE
 * Exécute la recherche d'itinéraire en lisant les valeurs du formulaire source.
 * @param {string} source - 'hall' ou 'results'
 * @param {object} sourceElements - Éléments DOM du formulaire qui a lancé la recherche
 */
async function executeItinerarySearch(source, sourceElements) {
    const { fromInput, toInput, dateSelect, hourSelect, minuteSelect, popover } = sourceElements;

    if (!fromPlaceId || !toPlaceId) {
        alert("Veuillez sélectionner un point de départ et d'arrivée depuis les suggestions.");
        return;
    }

    // Récupérer les infos de temps
    const searchTime = {
        type: popover.querySelector('.popover-tab.active').dataset.tab, 
        date: dateSelect.value,
        hour: hourSelect.value,
        minute: minuteSelect.value
    };
    
    // Synchroniser l'autre formulaire
    prefillOtherPlanner(source, sourceElements);

    console.log(`Recherche Google API (source: ${source}):`, { from: fromPlaceId, to: toPlaceId, time: searchTime });
    
    // Afficher la vue des résultats (si on vient du Hall)
    if (source === 'hall') {
        showResultsView(); 
    } else {
        // Si on est déjà dans les résultats, afficher juste le spinner
        resultsListContainer.innerHTML = '<p class="results-message">Mise à jour de l\'itinéraire...</p>';
    }

    try {
        const results = await apiManager.fetchItinerary(fromPlaceId, toPlaceId, searchTime); 
        const itineraries = processGoogleRoutesResponse(results);
        renderItineraryResults(itineraries);
        
    } catch (error) {
        console.error("Échec de la recherche d'itinéraire:", error);
        if (resultsListContainer) {
            resultsListContainer.innerHTML = `<p class="results-message error">Impossible de calculer l'itinéraire. L'API n'a pas trouvé de trajet en bus.</p>`;
        }
    }
}


/**
 * Attache les écouteurs qui dépendent des modules GTFS chargés
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

// --- NOUVELLES FONCTIONS POUR L'AUTOCOMPLÉTION ET LES RÉSULTATS ---

/**
 * NOUVELLE FONCTION
 * Pré-remplit l' *autre* formulaire avec les valeurs du formulaire source.
 * @param {string} sourceFormName - 'hall' ou 'results'
 * @param {object} sourceElements - Les éléments DOM du formulaire *source*
 */
function prefillOtherPlanner(sourceFormName, sourceElements) {
    let targetElements;
    
    if (sourceFormName === 'hall') {
        targetElements = {
            fromInput: resultsFromInput, toInput: resultsToInput,
            dateSelect: resultsDate, hourSelect: resultsHour, minuteSelect: resultsMinute,
            whenBtn: resultsWhenBtn, popover: resultsPopover, popoverSubmitBtn: resultsPopoverSubmitBtn
        };
    } else {
        targetElements = {
            fromInput: hallFromInput, toInput: hallToInput,
            dateSelect: hallDate, hourSelect: hallHour, minuteSelect: hallMinute,
            whenBtn: hallWhenBtn, popover: hallPopover, popoverSubmitBtn: hallPopoverSubmitBtn
        };
    }

    // Copier les valeurs de texte
    targetElements.fromInput.value = sourceElements.fromInput.value;
    targetElements.toInput.value = sourceElements.toInput.value;
    
    // Copier les sélections
    targetElements.dateSelect.value = sourceElements.dateSelect.value;
    targetElements.hourSelect.value = sourceElements.hourSelect.value;
    targetElements.minuteSelect.value = sourceElements.minuteSelect.value;
    
    // Copier l'état du tab "Partir/Arriver"
    const sourceActiveTab = sourceElements.popover.querySelector('.popover-tab.active').dataset.tab;
    targetElements.popover.querySelectorAll('.popover-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === sourceActiveTab);
    });
    
    // Mettre à jour le texte du bouton "Quand"
    targetElements.whenBtn.querySelector('span').textContent = sourceElements.whenBtn.querySelector('span').textContent;

    // Mettre à jour le texte du bouton de soumission du popover
    targetElements.popoverSubmitBtn.textContent = (sourceActiveTab === 'arriver') ? "Valider l'arrivée" : 'Partir maintenant';
}


async function handleAutocomplete(query, container, onSelect) {
    if (query.length < 3) {
        container.innerHTML = '';
        container.style.display = 'none';
        onSelect(null); 
        return;
    }

    try {
        const suggestions = await apiManager.getPlaceAutocomplete(query);
        renderSuggestions(suggestions, container, onSelect);
    } catch (error) {
        console.warn("Erreur d'autocomplétion:", error);
        container.style.display = 'none';
    }
}

function renderSuggestions(suggestions, container, onSelect) {
    container.innerHTML = '';
    if (suggestions.length === 0) {
        container.style.display = 'none';
        return;
    }

    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        const mainText = suggestion.description.split(',')[0];
        const secondaryText = suggestion.description.substring(mainText.length);
        item.innerHTML = `<strong>${mainText}</strong>${secondaryText}`;
        
        item.addEventListener('click', () => {
            const inputElement = container.previousElementSibling; 
            inputElement.value = suggestion.description; 
            onSelect(suggestion.placeId); 
            container.innerHTML = ''; 
            container.style.display = 'none';
        });
        container.appendChild(item);
    });

    container.style.display = 'block';
}

// *** FONCTION ENTIÈREMENT REMPLACÉE PAR VOTRE CORRECTIF ***
function processGoogleRoutesResponse(data) {
    if (!data || !data.routes || data.routes.length === 0) {
        console.warn("Réponse de l'API Routes vide ou invalide.");
        return [];
    }
    return data.routes.map(route => {
        const leg = route.legs[0];                 
        
        const departureTime = leg.localizedValues?.departureTime?.time?.text || "--:--";
        const arrivalTime = leg.localizedValues?.arrivalTime?.time?.text || "--:--";
                
        const itinerary = {
            departureTime: departureTime,
            arrivalTime: arrivalTime,
            duration: formatGoogleDuration(route.duration),
            polyline: route.polyline?.encodedPolyline || null, // *** AJOUT DE LA POLYLINE ***
            summarySegments: [], 
            steps: []
        };
        let currentWalkStep = null;
        for (const step of leg.steps) {
            const duration = formatGoogleDuration(step.duration);
            const rawDuration = parseGoogleDuration(step.duration);
            const distanceMeters = step.distanceMeters || 0;
            const distanceText = step.localizedValues?.distance?.text || '';
            const instruction = step.navigationInstruction?.instructions || step.localizedValues?.staticDuration?.text || "Marcher";
            if (step.travelMode === 'WALK') {
                if (!currentWalkStep) {
                    currentWalkStep = {
                        type: 'WALK',
                        icon: ICONS.WALK,
                        instruction: "Marche",
                        subSteps: [],
                        totalDuration: 0,
                        totalDistanceMeters: 0
                    };
                }
                currentWalkStep.subSteps.push({ instruction, distance: distanceText });
                currentWalkStep.totalDuration += rawDuration;
                currentWalkStep.totalDistanceMeters += distanceMeters;
            } else if (step.travelMode === 'TRANSIT' && step.transitDetails) {
                if (currentWalkStep) {
                    currentWalkStep.duration = formatGoogleDuration(currentWalkStep.totalDuration + 's');
                                        
                    if (currentWalkStep.totalDistanceMeters > 1000) {
                        currentWalkStep.distance = `${(currentWalkStep.totalDistanceMeters / 1000).toFixed(1)} km`;
                    } else {
                        currentWalkStep.distance = `${currentWalkStep.totalDistanceMeters} m`;
                    }
                                        
                    itinerary.steps.push(currentWalkStep);
                    currentWalkStep = null;
                }
                const transit = step.transitDetails;
                const line = transit.transitLine;
                if (line) {
                    const shortName = line.nameShort || 'BUS';
                    const color = line.color || '#3388ff';
                    const textColor = line.textColor || '#ffffff';
                    const stopDetails = transit.stopDetails || {};
                    const departureStop = stopDetails.departureStop || {};
                    const arrivalStop = stopDetails.arrivalStop || {};
                                        
                    const intermediateStops = (stopDetails.intermediateStops || []).map(stop => stop.name || 'Arrêt inconnu');
                    // *** CORRECTION : Utiliser localizedValues pour les heures des arrêts ***
                    const depTime = transit.localizedValues?.departureTime?.time?.text ||
                                    formatGoogleTime(stopDetails.departureTime);
                    const arrTime = transit.localizedValues?.arrivalTime?.time?.text ||
                                    formatGoogleTime(stopDetails.arrivalTime);
                    itinerary.steps.push({
                        type: 'BUS',
                        icon: ICONS.BUS,
                        routeShortName: shortName,
                        routeColor: color,
                        routeTextColor: textColor,
                        instruction: `Prendre le <b>${shortName}</b> direction <b>${transit.headsign || 'destination'}</b>`,
                        departureStop: departureStop.name || 'Arrêt de départ',
                        departureTime: depTime,
                        arrivalStop: arrivalStop.name || 'Arrêt d\'arrivée',
                        arrivalTime: arrTime,
                        numStops: transit.stopCount || 0,
                        intermediateStops: intermediateStops,
                        duration: duration
                    });
                }
            }
        }
        if (currentWalkStep) {
            currentWalkStep.duration = formatGoogleDuration(currentWalkStep.totalDuration + 's');
            if (currentWalkStep.totalDistanceMeters > 1000) {
                currentWalkStep.distance = `${(currentWalkStep.totalDistanceMeters / 1000).toFixed(1)} km`;
            } else {
                currentWalkStep.distance = `${currentWalkStep.totalDistanceMeters} m`;
            }
            itinerary.steps.push(currentWalkStep);
        }
                
        itinerary.summarySegments = itinerary.steps.map(step => {
            if (step.type === 'WALK') {
                return { type: 'WALK', duration: step.duration };
            } else {
                return {
                    type: 'BUS',
                    name: step.routeShortName,
                    color: step.routeColor,
                    textColor: step.routeTextColor,
                    duration: step.duration
                };
            }
        });
                
        itinerary.summarySegments = itinerary.summarySegments.filter((segment, index, self) => 
            segment.type !== 'WALK' || (index === 0) || (index > 0 && self[index - 1].type !== 'WALK')
        );
        return itinerary;
    });
}


/**
 * Affiche les itinéraires formatés dans la liste des résultats
 */
function renderItineraryResults(itineraries) {
    if (!resultsListContainer) return;
    
    resultsListContainer.innerHTML = ''; 

    if (itineraries.length === 0) {
        resultsListContainer.innerHTML = '<p class="results-message">Aucun itinéraire en transport en commun trouvé.</p>';
        return;
    }

    itineraries.forEach((itinerary, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'route-option-wrapper';
        
        if (index === 0) {
            wrapper.innerHTML += `<p class="route-option-title">Suggéré</p>`;
        }

        const card = document.createElement('div');
        card.className = 'route-option';

        const summarySegmentsHtml = itinerary.summarySegments.map(segment => {
            if (segment.type === 'WALK') {
                return `
                    <div class="summary-segment segment-walk">
                        <div class="segment-icon">${ICONS.WALK}</div>
                        <span class="segment-duration">${segment.duration}</span>
                    </div>
                `;
            } else { // BUS
                return `
                    <div class="summary-segment segment-bus">
                        <div class="route-line-badge" style="background-color: ${segment.color}; color: ${segment.textColor};">${segment.name}</div>
                        <span class="segment-duration">${segment.duration}</span>
                    </div>
                `;
            }
        }).join('<span class="route-summary-separator">></span>');

        card.innerHTML = `
            <div class="route-option-left">
                ${summarySegmentsHtml}
            </div>
            <div class="route-option-right">
                <span class="route-time">${itinerary.departureTime} &gt; ${itinerary.arrivalTime}</span>
                <span class="route-duration">${itinerary.duration}</span>
            </div>
        `;
        
        const details = document.createElement('div');
        details.className = 'route-details hidden'; 

        details.innerHTML = itinerary.steps.map(step => {
            if (step.type === 'WALK') {
                const hasSubSteps = step.subSteps && step.subSteps.length > 0;
                return `
                    <div class="step-detail walk">
                        <div class="step-icon">
                            ${ICONS.WALK}
                        </div>
                        <div class="step-info">
                            <span class="step-instruction">Marche <span class="step-duration-inline">(${step.duration})</span></span>
                            
                            ${hasSubSteps ? `
                            <details class="intermediate-stops">
                                <summary>
                                    <span>Environ ${step.duration}, ${step.distance}</span>
                                    <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                </summary>
                                <ul class="intermediate-stops-list walk-steps">
                                    ${step.subSteps.map(subStep => `<li>${subStep.instruction} ${subStep.distance ? `(${subStep.distance})` : ''}</li>`).join('')}
                                </ul>
                            </details>
                            ` : `<span class="step-sub-instruction">${step.instruction}</span>`}
                        </div>
                    </div>
                `;
            } else { // BUS
                const hasIntermediateStops = step.intermediateStops && step.intermediateStops.length > 0;
                // Calcule le nombre d'arrêts intermédiaires
                const intermediateStopCount = hasIntermediateStops ? step.intermediateStops.length : (step.numStops > 1 ? step.numStops - 1 : 0);
                
                let stopCountLabel = 'Direct';
                if (intermediateStopCount > 1) {
                    stopCountLabel = `${intermediateStopCount} arrêts`;
                } else if (intermediateStopCount === 1) {
                    stopCountLabel = `1 arrêt`;
                }

                return `
                    <div class="step-detail bus">
                        <div class="step-icon">
                            <div class="route-line-badge" style="background-color: ${step.routeColor}; color: ${step.routeTextColor};">${step.routeShortName}</div>
                        </div>
                        <div class="step-info">
                            <span class="step-instruction">${step.instruction} <span class="step-duration-inline">(${step.duration})</span></span>
                            
                            <div class="step-stop-point">
                                <span class="step-time">Montée à <strong>${step.departureStop}</strong></span>
                                <span class="step-time-detail">(${step.departureTime})</span>
                            </div>
                            
                            ${(intermediateStopCount > 0) ? `
                            <details class="intermediate-stops">
                                <summary>
                                    <span>${stopCountLabel}</span>
                                    <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                </summary>
                                ${hasIntermediateStops ? `
                                <ul class="intermediate-stops-list">
                                    ${step.intermediateStops.map(stopName => `<li>${stopName}</li>`).join('')}
                                </ul>
                                ` : `<ul class="intermediate-stops-list"><li>(La liste détaillée des arrêts n'est pas disponible)</li></ul>`}
                            </details>
                            ` : ''}
                            
                            <div class="step-stop-point">
                                <span class="step-time">Descente à <strong>${step.arrivalStop}</strong></span>
                                <span class="step-time-detail">(${step.arrivalTime})</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');


        card.addEventListener('click', () => {
            details.classList.toggle('hidden');
            card.classList.toggle('is-active');
        });

        wrapper.appendChild(card);
        wrapper.appendChild(details);
        resultsListContainer.appendChild(wrapper);
    });
}

/**
 * Helper pour formater le temps ISO de Google en HH:MM
 */
function formatGoogleTime(isoTime) {
    if (!isoTime) return "--:--";
    try {
        const date = new Date(isoTime);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        return "--:--";
    }
}

/**
 * Helper pour formater la durée de Google (ex: "1800s") en "30 min"
 */
function formatGoogleDuration(durationString) {
    if (!durationString) return "";
    try {
        const seconds = parseInt(durationString.slice(0, -1));
        const minutes = Math.round(seconds / 60);
        if (minutes < 1) return "< 1 min";
        if (minutes > 60) {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return m === 0 ? `${h}h` : `${h}h${m}`;
        }
        return `${minutes} min`;
    } catch (e) {
        return "";
    }
}

/**
 * NOUVEAU HELPER
 * Helper pour parser la durée de Google (ex: "1800s") en nombre (1800)
 */
function parseGoogleDuration(durationString) {
    if (!durationString) return 0;
    try {
        return parseInt(durationString.slice(0, -1)) || 0;
    } catch (e) {
        return 0;
    }
}


// --- Fonctions de l'application (logique métier GTFS) ---

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
            if (route) { 
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

function showResultsView() {
    dashboardContainer.classList.add('hidden');
    itineraryResultsContainer.classList.remove('hidden');
    mapContainer.classList.add('hidden');
    document.body.classList.add('view-is-locked'); // Verrouille le scroll

    // Doit invalider la taille DES DEUX cartes
    if (mapRenderer && mapRenderer.map) {
        mapRenderer.map.invalidateSize();
    }
    if (resultsMapRenderer && resultsMapRenderer.map) {
        resultsMapRenderer.map.invalidateSize();
    }

    if (resultsListContainer) {
        resultsListContainer.innerHTML = '<p class="results-message">Recherche d\'itinéraire en cours...</p>';
    }
}

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


// --- Fonctions de l'application (logique métier GTFS) ---

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
 * Fonction de mise à jour principale (pour la carte temps réel)
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
