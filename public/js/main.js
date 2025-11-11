/**
 * main.js
 * Point d'entrée principal de l'application
 * Gère le tableau de bord, la vue carte et l'état du trafic.
 *
 * CORRECTION: Retrait des 'import' (chargement global)
 * CORRECTION: Renommage de 'initApp' en 'googleMapsApiLoaded' pour correspondre à index.html
 */

// Modules
let dataManager;
let timeManager;
let tripScheduler;
let busPositionCalculator;
let mapRenderer;
let visibleRoutes = new Set();
let lineStatuses = {}; // Stocke l'état de chaque ligne (par route_id)

// NOUVEAU: ÉLÉMENTS DOM DU PLANIFICATEUR
let plannerFromInput, plannerToInput, plannerInvertBtn, plannerSearchBtn;
let plannerResultsView, btnBackFromResults, plannerResultsMapEl;
let resultsMap = null; // Carte Leaflet pour les résultats

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

// CORRIGÉ: Mappage des noms de fichiers PDF
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

// Mappage des noms longs (terminus) fournis par l'utilisateur
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


// ÉLÉMENTS DOM (Tableau de bord)
let dashboardContainer, dashboardHall, dashboardContentView, btnBackToHall;
let infoTraficList, infoTraficAvenir;
let infoTraficCount;
let alertBanner, alertBannerContent, alertBannerClose;
let btnAdminConsole;
let ficheHoraireContainer;

// ÉLÉMENTS DOM (Vue Carte)
let mapContainer;
let btnShowMap, btnBackToDashboard;
let searchBar, searchResultsContainer;

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

/**
 * CORRECTION: Fonction renommée pour correspondre au callback de index.html
 */
async function googleMapsApiLoaded() {
    // Sélection des éléments DOM
    dashboardContainer = document.getElementById('dashboard-container');
    dashboardHall = document.getElementById('dashboard-hall');
    dashboardContentView = document.getElementById('dashboard-content-view');
    btnBackToHall = document.getElementById('btn-back-to-hall');
    
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

    searchBar = document.getElementById('horaires-search-bar');
    searchResultsContainer = document.getElementById('horaires-search-results');

    // NOUVEAU: Sélection des éléments du planificateur
    plannerFromInput = document.getElementById('hall-planner-from');
    plannerToInput = document.getElementById('hall-planner-to');
    plannerInvertBtn = document.getElementById('planner-invert-btn');
    plannerSearchBtn = document.getElementById('planner-search-btn');
    plannerResultsView = document.getElementById('planner-results-view');
    btnBackFromResults = document.getElementById('btn-back-to-hall-from-results');
    plannerResultsMapEl = document.getElementById('planner-results-map');

    // Vérifie si les classes des modules sont chargées
    if (typeof DataManager === 'undefined' || typeof TimeManager === 'undefined' || typeof MapRenderer === 'undefined' || typeof TripScheduler === 'undefined' || typeof BusPositionCalculator === 'undefined') {
        console.error("ERREUR CRITIQUE: Les fichiers de modules JS (dataManager.js, timeManager.js, etc.) ne sont pas chargés ou sont dans le mauvais ordre. Ils doivent être chargés AVANT main.js dans index.html.");
        alert("Erreur de chargement de l'application. Vérifiez la console.");
        return;
    }

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
        setupDashboard(); 
        setupEventListeners();

        if (localStorage.getItem('gtfsInstructionsShown') !== 'true') {
            document.getElementById('instructions').classList.remove('hidden');
        }
        
        updateDataStatus('Données chargées', 'loaded');
        checkAndSetupTimeMode();
        updateData(); // Appel initial
        
        console.log("✅ Application initialisée et prête.");
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        updateDataStatus('Erreur de chargement', 'error');
    }
}

// CORRECTION: Assure que la fonction est globale pour le callback Google
window.googleMapsApiLoaded = googleMapsApiLoaded;


/**
 * Configure le tableau de bord (état du trafic, admin, fiches horaires)
 */
function setupDashboard() {
    dataManager.routes.forEach(route => {
        lineStatuses[route.route_id] = { status: 'normal', message: '' };
    });

    renderInfoTraficCard();
    buildFicheHoraireList();
    setupAdminConsole();
    
    initPlanner(); // ACTIVE LE PLANIFICATEUR

    // Attache les écouteurs aux 3 boutons du "Hall"
    document.querySelectorAll('.main-nav-buttons-condensed .nav-button-condensed[data-view]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); 
            const view = button.dataset.view;
            showDashboardView(view);
        });
    });

    // Bouton de navigation (CARTE)
    btnShowMap.addEventListener('click', showMapView);

    // Boutons de navigation (RETOUR)
    btnBackToDashboard.addEventListener('click', showDashboardHall); 
    btnBackToHall.addEventListener('click', showDashboardHall); 

    alertBannerClose.addEventListener('click', () => alertBanner.classList.add('hidden'));

    // Gère les onglets "en cours" / "à venir"
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
 * NOUVEAU: Initialise le planificateur "Où allons-nous ?" (Logique du panneau de temps)
 */
function initPlanner() {
    const plannerTimeBtn = document.getElementById('planner-time-btn');
    const plannerTimePanel = document.getElementById('planner-time-panel');
    const timePanelConfirmBtn = document.getElementById('time-panel-confirm-btn'); 
    const dateSelectInput = document.getElementById('date-select-input');
    const hourSelectInput = document.getElementById('hour-select-input');
    const minutesSelectInput = document.getElementById('minutes-select-input');
    const hourDropdown = document.getElementById('hour-dropdown');
    const minutesDropdown = document.getElementById('minutes-dropdown');
    
    let isPartirMaintenant = true;

    // --- Fonctions de base du Panneau ---
    
    // Initialise les valeurs du panneau
    function updatePanelTime() {
        const now = timeManager.getCurrentDate();
        dateSelectInput.value = now.toISOString().slice(0, 10);
        
        const currentHour = now.getHours();
        const currentMins = now.getMinutes();
        const roundedMins = Math.ceil(currentMins / 5) * 5;
        const finalHour = (roundedMins === 60) ? (currentHour + 1) % 24 : currentHour;
        const finalMins = roundedMins % 60;
        
        hourSelectInput.value = `${String(finalHour).padStart(2, '0')} h`;
        minutesSelectInput.value = `${String(finalMins).padStart(2, '0')} min`;
    }
    updatePanelTime();
    
    // Génère les listes déroulantes (heures et minutes par 5)
    function generateDropdowns() {
        hourDropdown.innerHTML = '';
        for (let h = 0; h < 24; h++) {
            const div = document.createElement('div');
            div.textContent = `${String(h).padStart(2, '0')} h`;
            div.dataset.value = h;
            div.addEventListener('click', () => selectDropdownValue(hourSelectInput, h, ' h', hourDropdown));
            hourDropdown.appendChild(div);
        }

        minutesDropdown.innerHTML = '';
        for (let m = 0; m < 60; m += 5) {
            const div = document.createElement('div');
            div.textContent = `${String(m).padStart(2, '0')} min`;
            div.dataset.value = m;
            div.addEventListener('click', () => selectDropdownValue(minutesSelectInput, m, ' min', minutesDropdown));
            minutesDropdown.appendChild(div);
        }
    }
    generateDropdowns();

    // Logique de sélection d'une valeur
    function selectDropdownValue(inputEl, value, suffix, dropdownEl) {
        inputEl.value = `${String(value).padStart(2, '0')}${suffix}`;
        dropdownEl.classList.add('hidden');
        
        // Change le texte du bouton de confirmation
        timePanelConfirmBtn.textContent = 'Confirmer';
        timePanelConfirmBtn.classList.remove('btn-primary');
        timePanelConfirmBtn.classList.add('btn-secondary');
    }
    
    // --- Événements du Panneau ---
    
    // Ouvre/ferme le panneau principal
    plannerTimeBtn.addEventListener('click', (e) => {
        const isHidden = plannerTimePanel.classList.toggle('hidden');
        plannerTimeBtn.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
        
        const btnRect = plannerTimeBtn.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        if (btnRect.right + 320 > viewportWidth) {
            plannerTimePanel.style.left = 'auto';
            plannerTimePanel.style.right = '0';
        } else {
             plannerTimePanel.style.left = '0';
             plannerTimePanel.style.right = 'auto';
        }
        
        hourDropdown.classList.add('hidden');
        minutesDropdown.classList.add('hidden');
    });
    
    // Ouvre/ferme les dropdowns d'heure/minute
    hourSelectInput.addEventListener('click', (e) => {
        e.stopPropagation(); 
        hourDropdown.classList.toggle('hidden');
        minutesDropdown.classList.add('hidden');
    });
    minutesSelectInput.addEventListener('click', (e) => {
        e.stopPropagation(); 
        minutesDropdown.classList.toggle('hidden');
        hourDropdown.classList.add('hidden');
    });

    // Fermeture du panneau et des dropdowns si on clique ailleurs
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.planner-time-selector-wrapper')) {
            plannerTimePanel.classList.add('hidden');
            plannerTimeBtn.setAttribute('aria-expanded', 'false');
            hourDropdown.classList.add('hidden');
            minutesDropdown.classList.add('hidden');
        }
    });

    // Confirmation du panneau
    timePanelConfirmBtn.addEventListener('click', () => {
        if (timePanelConfirmBtn.textContent.includes('Partir maintenant')) {
            isPartirMaintenant = true;
            plannerTimeBtn.innerHTML = `Partir maintenant <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
            
        } else {
            isPartirMaintenant = false;
            const date = new Date(dateSelectInput.value);
            const hour = hourSelectInput.value.replace(' h', '');
            const min = minutesSelectInput.value.replace(' min', '');
            const formattedDate = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            plannerTimeBtn.innerHTML = `${formattedDate} à ${hour}:${min} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
        }
        
        plannerTimePanel.classList.add('hidden');
        plannerTimeBtn.setAttribute('aria-expanded', 'false');
    });
    
    // Mettre à jour le bouton de confirmation si la date change
    dateSelectInput.addEventListener('input', () => {
        timePanelConfirmBtn.textContent = 'Confirmer';
        timePanelConfirmBtn.classList.remove('btn-primary');
        timePanelConfirmBtn.classList.add('btn-secondary');
    });
    
    // Gérer les onglets "Partir" / "Arriver"
    document.querySelectorAll('.time-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            if (e.target.dataset.type === 'depart') {
                timePanelConfirmBtn.textContent = 'Partir maintenant';
            } else {
                timePanelConfirmBtn.textContent = 'Arriver avant';
            }
            timePanelConfirmBtn.classList.add('btn-primary');
            timePanelConfirmBtn.classList.remove('btn-secondary');
        });
    });

    // 7. Attacher les écouteurs du planificateur principal
    plannerInvertBtn.addEventListener('click', invertPlannerInputs);
    plannerSearchBtn.addEventListener('click', executePlannerSearch);

    // Le bouton retour sur la page de résultats
    btnBackFromResults.addEventListener('click', showDashboardHall);
}

/**
 * NOUVEAU: Inverse les champs Départ et Arrivée
 */
function invertPlannerInputs() {
    plannerFromInput = plannerFromInput || document.getElementById('hall-planner-from');
    plannerToInput = plannerToInput || document.getElementById('hall-planner-to');
    const fromVal = plannerFromInput.value;
    plannerFromInput.value = plannerToInput.value;
    plannerToInput.value = fromVal;
}

/**
 * NOUVEAU: Logique de recherche (transition de vue)
 */
function executePlannerSearch() {
    plannerFromInput = plannerFromInput || document.getElementById('hall-planner-from');
    plannerToInput = plannerToInput || document.getElementById('hall-planner-to');
    
    const from = plannerFromInput.value;
    const to = plannerToInput.value;
    
    if (!from || !to) {
        alert("Veuillez remplir un point de départ et d'arrivée.");
        return;
    }
    
    console.log(`Recherche d'itinéraire: De ${from} à ${to}`);
    
    const resultsList = document.getElementById('planner-results-list');
    resultsList.innerHTML = `<p class="card-note">Recherche de De <strong>${from}</strong> à <strong>${to}</strong>...</p><p class="card-note">Intégration de l'API Google en cours...</p>`;

    // --- Basculement de la Vue ---
    dashboardHall = dashboardHall || document.getElementById('dashboard-hall');
    dashboardContentView = dashboardContentView || document.getElementById('dashboard-content-view');
    plannerResultsView = plannerResultsView || document.getElementById('planner-results-view');

    dashboardHall.classList.remove('view-is-active');
    dashboardContentView.classList.remove('view-is-active');
    plannerResultsView.classList.remove('hidden');

    if (!resultsMap) {
        initResultsMap();
    } else {
        resultsMap.invalidateSize(); 
    }
}


/**
 * NOUVEAU: Initialise la carte Leaflet sur la page de résultats
 */
function initResultsMap() {
    try {
        const centerCoordinates = [45.1833, 0.7167]; // Périgueux
        const zoomLevel = 13;

        resultsMap = L.map('planner-results-map').setView(centerCoordinates, zoomLevel);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(resultsMap);
        
        resultsMap.invalidateSize();
    } catch (e) {
        console.error("Erreur d'initialisation de la carte des résultats:", e);
        if (plannerResultsMapEl) {
            plannerResultsMapEl.innerHTML = "Erreur: Impossible de charger la carte.";
        }
    }
}

/**
 * Affiche la carte "Info Trafic"
 */
function renderInfoTraficCard() {
    infoTraficList = infoTraficList || document.getElementById('info-trafic-list');
    infoTraficCount = infoTraficCount || document.getElementById('info-trafic-count');
    
    infoTraficList.innerHTML = '';
    let alertCount = 0;
    
    const groupedRoutes = {
        'majeures': { name: 'Lignes majeures', routes: [] }, 'express': { name: 'Lignes express', routes: [] }, 'quartier': { name: 'Lignes de quartier', routes: [] }, 'navettes': { name: 'Navettes', routes: [] }
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

        groupDiv.innerHTML = `<h4>${categoryData.name}</h4><div class="trafic-badge-list">${badgesHtml}</div>`;
        infoTraficList.appendChild(groupDiv);
    }

    infoTraficCount.textContent = alertCount;
    infoTraficCount.classList.toggle('hidden', alertCount === 0);
}


/**
 * Construit l'accordéon des fiches horaires
 */
function buildFicheHoraireList() {
    ficheHoraireContainer = ficheHoraireContainer || document.getElementById('fiche-horaire-container');
    ficheHoraireContainer.innerHTML = '';
    const groupedRoutes = {
        'Lignes A, B, C et D': [], 'Lignes e': [], 'Lignes K': [], 'Lignes N': [], 'Lignes R': [],
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
                let pdfPath = pdfName ? `/data/fichehoraire/${pdfName}` : `/data/fichehoraire/grandperigueux_fiche_horaires_ligne_${route.route_short_name.toLowerCase()}_sept_2025.pdf`;
                const longName = ROUTE_LONG_NAME_MAP[route.route_short_name] || (route.route_long_name ? route.route_long_name.replace(/<->/g, '<=>') : '');
                const displayName = `Ligne ${route.route_short_name} ${longName}`.trim();
                linksHtml += `<a href="${pdfPath}" target="_blank" rel="noopener noreferrer">${displayName}</a>`;
            });
        }

        if (linksHtml) {
            accordionGroup.innerHTML = `
                <details>
                    <summary>${groupName}</summary>
                    <div class="accordion-content"><div class="accordion-content-inner">${linksHtml}</div></div>
                </details>
            `;
            ficheHoraireContainer.appendChild(accordionGroup);
        }
    }
}


/**
 * Affiche le bandeau d'alerte en haut
 */
function renderAlertBanner() {
    let alerts = [];
    let firstAlertStatus = 'normal';
    
    for (const route_id in lineStatuses) {
        const state = lineStatuses[route_id];
        if (state.status !== 'normal') {
            const route = dataManager.getRoute(route_id);
            alerts.push({ name: route.route_short_name, status: state.status, message: state.message });
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
    
    document.getElementById('alert-banner-content').innerHTML = `${alertIcon} <strong>Infos Trafic:</strong> ${alertText}`;
    alertBanner.classList.remove('hidden');
}


/**
 * Fonctions de basculement de vue
 */
function showMapView() {
    dashboardContainer.classList.add('hidden');
    document.getElementById('main-header').classList.add('hidden');
    document.getElementById('alert-banner').classList.add('hidden');
    mapContainer.classList.remove('hidden');
    document.body.classList.add('map-is-active'); 
    mapRenderer.map.invalidateSize();
}

function showDashboardHall() {
    mapContainer.classList.add('hidden');
    if (plannerResultsView) { 
        plannerResultsView.classList.add('hidden');
    }
    document.body.classList.remove('map-is-active'); 
    document.getElementById('main-header').classList.remove('hidden');
    dashboardContainer.classList.remove('hidden');
    // renderAlertBanner(); 
    dashboardContentView.classList.remove('view-is-active');
    dashboardHall.classList.add('view-is-active');
    document.querySelectorAll('#dashboard-content-view .card').forEach(card => {
        card.classList.remove('view-active');
    });
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
        setTimeout(() => { activeCard.classList.add('view-active'); }, 50); 
    }
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
            itemDiv.innerHTML = `
                <input type="checkbox" id="route-${route.route_id}" data-category="${categoryId}" checked>
                <div class="route-badge" style="background-color: ${route.route_color ? `#${route.route_color}` : '#3388ff'}; color: ${route.route_text_color ? `#${route.route_text_color}` : '#ffffff'};">
                    ${route.route_short_name || route.route_id}
                </div>
                <span class="route-name">${route.route_long_name || route.route_short_name || route.route_id}</span>
            `;
            categoryContainer.appendChild(itemDiv);
            
            itemDiv.querySelector('input').addEventListener('change', () => handleRouteFilterChange());
            itemDiv.addEventListener('mouseenter', () => mapRenderer.highlightRoute(route.route_id, true));
            itemDiv.addEventListener('mouseleave', () => mapRenderer.highlightRoute(route.route_id, false));
            itemDiv.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                mapRenderer.zoomToRoute(route.route_id);
            });
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

/**
 * Attache tous les écouteurs d'événements
 */
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
    document.querySelector('.panel-handle').addEventListener('click', () => {
        document.getElementById('route-filter-panel').classList.add('hidden');
    });

    document.getElementById('select-all-routes').addEventListener('click', () => {
        document.querySelectorAll('#route-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = true);
        handleRouteFilterChange();
    });
    document.getElementById('deselect-all-routes').addEventListener('click', () => {
        document.querySelectorAll('#route-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
        handleRouteFilterChange();
    });
    
    timeManager.addListener(updateData);

    // Bouton raccourci recherche
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

    // Écouteurs pour la VUE TABLEAU DE BORD (recherche horaires)
    searchBar = searchBar || document.getElementById('horaires-search-bar');
    searchResultsContainer = searchResultsContainer || document.getElementById('horaires-search-results');

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

    // Logique pour l'accordéon exclusif
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
 * Logique de recherche (corrigée)
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
 * Affiche les résultats (corrigée)
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
 * Clic sur résultat (corrigée)
 */
function onSearchResultClick(stop) {
    showMapView(); 
    mapRenderer.zoomToStop(stop);
    mapRenderer.onStopClick(stop); 
    searchBar.value = stop.stop_name;
    searchResultsContainer.classList.add('hidden');
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
