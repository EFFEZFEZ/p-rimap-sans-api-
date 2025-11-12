/**
 * dataManager.js
 * * Gère le chargement et le parsing des données GTFS et GeoJSON
 *
 * CORRECTION FINALE (CHEMINS Vercel/Vite/Replit) :
 * - Le serveur (Vercel) mappe le dossier 'public' à la racine '/'.
 * - Les chemins doivent être ABSOLUS (commencer par '/') mais NE PAS 
 * inclure 'public'.
 * - On demande '/data/...' et le serveur cherche dans '/public/data/...'.
 */

export class DataManager {
    constructor() {
        this.routes = [];
        this.trips = [];
        this.stopTimes = [];
        this.stops = [];
        this.geoJson = null;
        this.isLoaded = false;
        
        this.calendar = [];
        this.calendarDates = [];

        this.masterStops = []; 
        this.groupedStopMap = {}; 

        this.stopTimesByStop = {}; 
        this.tripsByTripId = {}; // Stocke les trips par ID
        this.stopTimesByTrip = {}; // Stocke les stop_times par trip_id
    }

    /**
     * Charge tous les fichiers GTFS et GeoJSON
     */
    async loadAllData() {
        try {
            console.log('📦 Chargement des données GTFS et GeoJSON...');
            
            const [routes, trips, stopTimes, stops, calendar, calendarDates, geoJson] = await Promise.all([
                this.loadGTFSFile('routes.txt'),
                this.loadGTFSFile('trips.txt'),
                this.loadGTFSFile('stop_times.txt'),
                this.loadGTFSFile('stops.txt'),
                this.loadGTFSFile('calendar.txt'), 
                this.loadGTFSFile('calendar_dates.txt'), 
                this.loadGeoJSON()
            ]);

            this.routes = routes;
            this.trips = trips;
            this.stopTimes = stopTimes;
            this.stops = stops;
            this.calendar = calendar;
            this.calendarDates = calendarDates;
            this.geoJson = geoJson;

            // *** DEBUG LOG ***
            console.log(`[Debug] Données brutes chargées:`);
            console.log(`[Debug] ${this.routes.length} routes`);
            console.log(`[Debug] ${this.trips.length} trips`);
            console.log(`[Debug] ${this.stopTimes.length} stop_times`);
            console.log(`[Debug] ${this.stops.length} stops`);
            console.log(`[Debug] ${this.calendar.length} calendar entries`);
            console.log(`[Debug] ${this.calendarDates.length} calendar_dates`);
            // *** FIN DEBUG LOG ***

            console.log('🛠️  Pré-traitement des données...');

            // Indexer les routes pour un accès rapide
            this.routesById = this.routes.reduce((acc, route) => {
                acc[route.route_id] = route;
                return acc;
            }, {});

            // Indexer les arrêts pour un accès rapide
            this.stopsById = this.stops.reduce((acc, stop) => {
                acc[stop.stop_id] = stop;
                return acc;
            }, {});

            // Regrouper les stop_times par trip_id (TRÈS IMPORTANT)
            this.stopTimes.forEach(st => {
                if (!this.stopTimesByTrip[st.trip_id]) {
                    this.stopTimesByTrip[st.trip_id] = [];
                }
                this.stopTimesByTrip[st.trip_id].push(st);
            });
            // Trier les stop_times par sequence
            for (const tripId in this.stopTimesByTrip) {
                this.stopTimesByTrip[tripId].sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
            }

            // Indexer les trips
            this.trips.forEach(trip => {
                this.tripsByTripId[trip.trip_id] = trip;
            });
            
            this.groupNearbyStops();
            this.preprocessStopTimesByStop();

            console.log('✅ Données chargées et traitées.');
            this.isLoaded = true;

        } catch (error) {
            console.error('Erreur fatale lors du chargement des données:', error);
            this.showError('Erreur de chargement des données', 'Vérifiez que les fichiers GTFS sont présents dans /public/data/gtfs/ et que map.geojson est dans /public/data/.');
            this.isLoaded = false;
        }
        return this.isLoaded;
    }

    /**
     * Charge un fichier GTFS (CSV)
     */
    async loadGTFSFile(filename) {
        // *** CORRECTION ICI ***
        // Le chemin est ABSOLU (commence par '/') mais SANS 'public'
        const response = await fetch(`/data/gtfs/${filename}`);
        if (!response.ok) {
            throw new Error(`Impossible de charger ${filename}: ${response.statusText}`);
        }
        const csv = await response.text();
        return new Promise((resolve) => {
            Papa.parse(csv, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    resolve(results.data);
                }
            });
        });
    }

    /**
     * Charge le fichier GeoJSON
     */
    async loadGeoJSON() {
        // *** CORRECTION ICI ***
        // Le chemin est ABSOLU (commence par '/') mais SANS 'public'
        const response = await fetch('/data/map.geojson');
        if (!response.ok) {
            console.warn(`map.geojson non trouvé ou invalide: ${response.statusText}. Les tracés de route ne seront pas disponibles.`);
            return null; // N'est pas une erreur fatale
        }
        return await response.json();
    }

    // ... (Le reste du fichier reste inchangé) ...

    /**
     * Affiche une erreur non-bloquante
     */
    showError(title, message) {
        const errorElement = document.getElementById('instructions');
        if (errorElement) {
            errorElement.classList.remove('hidden');
            errorElement.querySelector('h3').textContent = title;
            const ol = errorElement.querySelector('ol');
            ol.innerHTML = `<li>${message}</li>`;
            
            const defaultItems = errorElement.querySelectorAll('ol li:not(:first-child)');
            defaultItems.forEach(item => item.style.display = 'none');
        }
    }

    /**
     * Regroupe les arrêts basés sur parent_station (logique V4)
     */
    groupNearbyStops() {
        this.masterStops = [];
        this.groupedStopMap = {};
        const childStops = new Set();

        this.stops.forEach(stop => {
            if (stop.parent_station && stop.parent_station.trim() !== '') {
                childStops.add(stop.stop_id);
            }
        });

        this.stops.forEach(stop => {
            if (stop.location_type === '1') {
                this.masterStops.push(stop);
                if (!this.groupedStopMap[stop.stop_id]) {
                    this.groupedStopMap[stop.stop_id] = [];
                }
                this.groupedStopMap[stop.stop_id].push(stop.stop_id); 
            }
            else if (stop.parent_station && stop.parent_station.trim() !== '') {
                const parentId = stop.parent_station;
                if (!this.groupedStopMap[parentId]) {
                    this.groupedStopMap[parentId] = [];
                }
                this.groupedStopMap[parentId].push(stop.stop_id);
            }
            else if (stop.location_type !== '1' && !childStops.has(stop.stop_id) && (!stop.parent_station || stop.parent_station.trim() === '')) {
                this.masterStops.push(stop);
                this.groupedStopMap[stop.stop_id] = [stop.stop_id];
            }
        });

        // *** DEBUG LOG ***
        console.log(`[Debug] ${this.masterStops.length} arrêts maîtres (groupés) trouvés.`);
    }

    /**
     * Prétraite les stop_times par stop_id pour des recherches rapides
     */
    preprocessStopTimesByStop() {
        this.stopTimes.forEach(st => {
            if (!this.stopTimesByStop[st.stop_id]) {
                this.stopTimesByStop[st.stop_id] = [];
            }
            this.stopTimesByStop[st.stop_id].push(st);
        });
    }

    /**
     * Récupère les prochains départs pour une liste d'arrêts (V4)
     */
    getUpcomingDepartures(stopIds, currentSeconds, date, limit = 5) {
        const serviceId = this.getServiceId(date);
        if (!serviceId) return [];

        let allDepartures = [];

        stopIds.forEach(stopId => {
            const stops = this.stopTimesByStop[stopId] || [];
            stops.forEach(st => {
                const trip = this.tripsByTripId[st.trip_id];
                if (trip && trip.service_id === serviceId) {
                    const departureSeconds = this.timeToSeconds(st.departure_time);
                    if (departureSeconds >= currentSeconds) {
                        allDepartures.push({
                            tripId: st.trip_id,
                            stopId: stopId,
                            time: st.departure_time,
                            departureSeconds: departureSeconds
                        });
                    }
                }
            });
        });

        allDepartures.sort((a, b) => a.departureSeconds - b.departureSeconds);
        allDepartures = allDepartures.slice(0, limit);

        return allDepartures.map(dep => {
            const trip = this.tripsByTripId[dep.tripId];
            const route = this.routesById[trip.route_id];
            const stopTimes = this.stopTimesByTrip[dep.tripId];
            const destination = this.getTripDestination(stopTimes);
            
            return {
                ...dep,
                routeShortName: route.route_short_name,
                routeColor: route.route_color,
                routeTextColor: route.route_text_color,
                destination: destination
            };
        });
    }

    /**
     * Récupère les informations d'une route par ID
     */
    getRoute(routeId) {
        return this.routesById[routeId] || null;
    }

    /**
     * Récupère les informations d'un arrêt par ID
     */
    getStop(stopId) {
        return this.stopsById[stopId] || null;
    }

    /**
     * Récupère les stop_times pour un tripId
     */
    getStopTimes(tripId) {
        return this.stopTimesByTrip[tripId] || [];
    }
    
    /**
     * Récupère la géométrie (GeoJSON) d'une route
     */
    getRouteGeometry(routeId) {
        if (!this.geoJson || !this.geoJson.features) {
            return null;
        }
        
        const feature = this.geoJson.features.find(f => 
            f.properties && f.properties.route_id === routeId
        );
        
        return feature ? feature.geometry : null;
    }

    /**
     * Convertit le temps HH:MM:SS en secondes
     */
    timeToSeconds(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    /**
     * Formate les secondes en HH:MM:SS
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600) % 24;
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Convertit les degrés en radians
     */
    toRad(value) {
        return value * Math.PI / 180;
    }

    /**
     * Récupère le service_id pour la date donnée
     */
    getServiceId(date) {
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const dateString = date.getFullYear() +
                           String(date.getMonth() + 1).padStart(2, '0') +
                           String(date.getDate()).padStart(2, '0');

        // *** DEBUG LOG ***
        console.log(`[Debug getServiceId] Recherche service pour date: ${dateString} (jour: ${dayOfWeek})`);

        const exception = this.calendarDates.find(d => d.date === dateString);
        if (exception) {
            // *** DEBUG LOG ***
            console.log(`[Debug getServiceId] Exception trouvée: type ${exception.exception_type}, service_id ${exception.service_id}`);
            return exception.exception_type === '1' ? exception.service_id : null;
        }

        const service = this.calendar.find(s => 
            s[dayOfWeek] === '1' &&
            s.start_date <= dateString &&
            s.end_date >= dateString
        );

        // *** DEBUG LOG ***
        if (service) {
            console.log(`[Debug getServiceId] Service calendrier trouvé: ${service.service_id}`);
        } else {
            console.warn(`[Debug getServiceId] Aucun service (calendar.txt) trouvé pour ${dateString}.`);
        }

        return service ? service.service_id : null;
    }

    /**
     * Récupère tous les trips actifs pour un temps et une date (V4)
     */
    getActiveTrips(currentSeconds, date) {
        
        // *** DEBUG LOG ***
        console.log(`[Debug getActiveTrips] Recherche de voyages à ${currentSeconds}s pour ${date.toISOString()}`);

        const serviceId = this.getServiceId(date);

        // *** DEBUG LOG ***
        console.log(`[Debug getActiveTrips] Service ID utilisé: ${serviceId}`);

        if (!serviceId) {
            return [];
        }

        const activeTrips = [];

        this.trips.forEach(trip => {
            if (trip.service_id === serviceId) {
                const stopTimes = this.stopTimesByTrip[trip.trip_id];
                if (!stopTimes || stopTimes.length < 2) return;

                const firstStop = stopTimes[0];
                const lastStop = stopTimes[stopTimes.length - 1];
                
                // (Utilise la correction précédente : arrival_time)
                const startTime = this.timeToSeconds(firstStop.arrival_time);
                const endTime = this.timeToSeconds(lastStop.arrival_time);

                if (currentSeconds >= startTime && currentSeconds <= endTime) {
                    activeTrips.push({
                        tripId: trip.trip_id,
                        trip: trip,
                        stopTimes: stopTimes,
                        route: this.routesById[trip.route_id]
                    });
                }
            }
        });

        // *** DEBUG LOG ***
        console.log(`[Debug getActiveTrips] ${activeTrips.length} voyages actifs trouvés.`);

        return activeTrips;
    }
    
    /**
     * Récupère la destination finale d'un trip (V4)
     */
    getTripDestination(stopTimes) {
        if (!stopTimes || stopTimes.length === 0) {
            return 'Destination inconnue';
        }

        const lastStop = stopTimes[stopTimes.length - 1];
        const stopInfo = this.getStop(lastStop.stop_id);
        
        return stopInfo ? stopInfo.stop_name : 'Destination inconnue';
    }

    /**
     * Récupère les bornes de service (début/fin) pour la journée
     */
    getDailyServiceBounds() {
        let earliestStart = Infinity;
        let latestEnd = -Infinity;

        Object.values(this.stopTimesByTrip).forEach(stopTimes => {
            if (stopTimes.length < 2) return;
            const firstStop = stopTimes[0];
            const lastStop = stopTimes[stopTimes.length - 1];

            const startTime = this.timeToSeconds(firstStop.departure_time || firstStop.arrival_time);
            const endTime = this.timeToSeconds(lastStop.arrival_time || lastStop.departure_time);

            if (startTime < earliestStart) earliestStart = startTime;
            if (endTime > latestEnd) latestEnd = endTime;
        });

        if (earliestStart === Infinity) earliestStart = 0;
        if (latestEnd === -Infinity) latestEnd = 86400;

        return { earliestStart, latestEnd };
    }

    /**
     * Trouve la première seconde où il y a au moins un bus actif
     */
    findFirstActiveSecond() {
        const bounds = this.getDailyServiceBounds();
        return bounds.earliestStart;
    }

    /**
     * Trouve la prochaine seconde active après currentSeconds
     */
    findNextActiveSecond(currentSeconds) {
        let nextActiveTime = Infinity;

        Object.values(this.stopTimesByTrip).forEach(stopTimes => {
            if (stopTimes.length < 2) return;

            const firstStop = stopTimes[0];
            const startTime = this.timeToSeconds(firstStop.departure_time || firstStop.arrival_time);

            if (startTime > currentSeconds && startTime < nextActiveTime) {
                nextActiveTime = startTime;
            }
        });

        if (nextActiveTime === Infinity) {
            return this.findFirstActiveSecond();
        }

        return nextActiveTime;
    }

    /**
     * Convertit un nombre de secondes en chaîne de caractères "X h Y min"
     */
    formatDuration(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        let str = "";
        if (hours > 0) {
            str += `${hours} h `;
        }
        if (minutes > 0 || hours === 0) { // Affiche "0 min" si 0s
            str += `${minutes} min`;
        }
        return str.trim();
    }
}
