/**
 * dataManager.js - CORRECTION FINALE
 * Combine la logique multi-services (V3) + nettoyage CSV + helpers géométrie
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
        this.tripsByTripId = {};
        this.stopTimesByTrip = {};
    }

    /**
     * Nettoie les guillemets parasites des fichiers CSV
     */
    cleanCSVValue(value) {
        if (typeof value !== 'string') return value;
        return value.replace(/^["']|["']$/g, '').trim();
    }

    cleanObject(obj) {
        const cleaned = {};
        for (const key in obj) {
            cleaned[key] = this.cleanCSVValue(obj[key]);
        }
        return cleaned;
    }

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

            // Nettoyer les guillemets
            this.routes = routes.map(r => this.cleanObject(r));
            this.trips = trips.map(t => this.cleanObject(t));
            this.stopTimes = stopTimes.map(st => this.cleanObject(st));
            this.stops = stops.map(s => this.cleanObject(s));
            this.calendar = calendar.map(c => this.cleanObject(c));
            this.calendarDates = calendarDates.map(cd => this.cleanObject(cd));
            this.geoJson = geoJson;

            console.log('🛠️  Pré-traitement des données...');

            // Indexer les routes
            this.routesById = this.routes.reduce((acc, route) => {
                acc[route.route_id] = route;
                return acc;
            }, {});

            // Indexer les arrêts
            this.stopsById = this.stops.reduce((acc, stop) => {
                acc[stop.stop_id] = stop;
                return acc;
            }, {});

            // Regrouper les stop_times par trip_id
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

            console.log('✅ Données chargées:');
            console.log(`  - ${this.routes.length} routes`);
            console.log(`  - ${this.trips.length} trips`);
            console.log(`  - ${this.stopTimes.length} stop_times`);
            console.log(`  - ${this.stops.length} stops`);
            console.log(`  - ${this.calendar.length} calendriers`);
            console.log(`  - ${this.calendarDates.length} exceptions`);

            this.isLoaded = true;

        } catch (error) {
            console.error('❌ Erreur fatale:', error);
            this.showError('Erreur de chargement', 'Vérifiez les fichiers GTFS dans /public/data/gtfs/');
            this.isLoaded = false;
        }
        return this.isLoaded;
    }

    async loadGTFSFile(filename) {
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

    async loadGeoJSON() {
        const response = await fetch('/data/map.geojson');
        if (!response.ok) {
            console.warn(`⚠️  map.geojson non trouvé`);
            return null;
        }
        return await response.json();
    }

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

        console.log(`📍 ${this.masterStops.length} arrêts maîtres`);
    }

    preprocessStopTimesByStop() {
        this.stopTimes.forEach(st => {
            if (!this.stopTimesByStop[st.stop_id]) {
                this.stopTimesByStop[st.stop_id] = [];
            }
            this.stopTimesByStop[st.stop_id].push(st);
        });
    }

    /**
     * 🔑 FONCTION CLÉE : Récupère TOUS les services actifs (pluriel!)
     */
    getServiceIds(date) {
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const dateString = date.getFullYear() +
                           String(date.getMonth() + 1).padStart(2, '0') +
                           String(date.getDate()).padStart(2, '0');

        console.log(`📅 Analyse du ${dateString} (${dayOfWeek})`);

        const activeServiceIds = new Set();

        // Étape 1: Suppressions (exception_type = 2)
        const removedServiceIds = new Set();
        this.calendarDates.forEach(d => {
            if (d.date === dateString && d.exception_type === '2') {
                removedServiceIds.add(d.service_id);
                console.log(`  ❌ Supprimé: ${d.service_id}`);
            }
        });

        // Étape 2: Services réguliers (calendar.txt)
        this.calendar.forEach(s => {
            if (s[dayOfWeek] === '1' &&
                s.start_date <= dateString &&
                s.end_date >= dateString &&
                !removedServiceIds.has(s.service_id)) {
                activeServiceIds.add(s.service_id);
                console.log(`  ✅ Service actif: ${s.service_id}`);
            }
        });

        // Étape 3: Ajouts spéciaux (exception_type = 1)
        this.calendarDates.forEach(d => {
            if (d.date === dateString && d.exception_type === '1') {
                activeServiceIds.add(d.service_id);
                console.log(`  ➕ Ajouté: ${d.service_id}`);
            }
        });

        if (activeServiceIds.size === 0) {
            console.error(`❌ AUCUN SERVICE ACTIF`);
        } else {
            console.log(`✅ ${activeServiceIds.size} service(s):`, Array.from(activeServiceIds));
        }
        
        return activeServiceIds;
    }

    /**
     * Compare un service_id de trip avec les services actifs
     */
    serviceIdsMatch(tripServiceId, activeServiceId) {
        if (tripServiceId === activeServiceId) return true;
        if (tripServiceId.startsWith(activeServiceId + ':')) return true;
        return false;
    }

    /**
     * Prochains départs (gère PLUSIEURS services actifs)
     */
    getUpcomingDepartures(stopIds, currentSeconds, date, limit = 5) {
        const serviceIdSet = this.getServiceIds(date);
        
        if (serviceIdSet.size === 0) {
            console.warn('⚠️  Aucun service actif');
            return [];
        }

        let allDepartures = [];

        stopIds.forEach(stopId => {
            const stops = this.stopTimesByStop[stopId] || [];
            stops.forEach(st => {
                const trip = this.tripsByTripId[st.trip_id];
                if (!trip) return;

                // Vérifie si le trip appartient à UN des services actifs
                const isServiceActive = Array.from(serviceIdSet).some(activeServiceId => {
                    return this.serviceIdsMatch(trip.service_id, activeServiceId);
                });

                if (isServiceActive) {
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
     * Trips actifs (gère PLUSIEURS services actifs)
     */
    getActiveTrips(currentSeconds, date) {
        const serviceIdSet = this.getServiceIds(date);
        
        if (serviceIdSet.size === 0) {
            console.warn("⚠️  Aucun service actif");
            return [];
        }

        console.log(`🚌 Recherche trips actifs à ${this.formatTime(currentSeconds)}`);

        const activeTrips = [];
        let matchCount = 0;

        this.trips.forEach(trip => {
            // Vérifie si le trip appartient à UN des services actifs
            const isServiceActive = Array.from(serviceIdSet).some(activeServiceId => {
                return this.serviceIdsMatch(trip.service_id, activeServiceId);
            });

            if (isServiceActive) {
                matchCount++;
                const stopTimes = this.stopTimesByTrip[trip.trip_id];
                if (!stopTimes || stopTimes.length < 2) return;

                const firstStop = stopTimes[0];
                const lastStop = stopTimes[stopTimes.length - 1];
                
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

        console.log(`📊 Trips avec service actif: ${matchCount}`);
        console.log(`✅ Trips actifs maintenant: ${activeTrips.length}`);

        return activeTrips;
    }

    getRoute(routeId) {
        return this.routesById[routeId] || null;
    }

    getStop(stopId) {
        return this.stopsById[stopId] || null;
    }

    getStopTimes(tripId) {
        return this.stopTimesByTrip[tripId] || [];
    }
    
    /**
     * Géométrie de route (gère LineString et MultiLineString)
     */
    getRouteGeometry(routeId) {
        if (!this.geoJson || !this.geoJson.features) {
            return null;
        }
        
        const feature = this.geoJson.features.find(f => 
            f.properties && f.properties.route_id === routeId
        );
        
        if (!feature || !feature.geometry) return null;
        
        if (feature.geometry.type === 'LineString') {
            return feature.geometry.coordinates;
        }
        
        if (feature.geometry.type === 'MultiLineString' && feature.geometry.coordinates.length > 0) {
            return feature.geometry.coordinates[0];
        }
        
        return null;
    }

    timeToSeconds(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600) % 24;
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    toRad(value) {
        return value * Math.PI / 180;
    }

    /**
     * Calcule la distance Haversine entre deux points
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = this.toRad(lat1);
        const φ2 = this.toRad(lat2);
        const Δφ = this.toRad(lat2 - lat1);
        const Δλ = this.toRad(lon2 - lon1);

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Trouve le point le plus proche sur un tracé
     */
    findNearestPointOnRoute(routeCoordinates, lat, lon) {
        let minDistance = Infinity;
        let nearestIndex = null;

        routeCoordinates.forEach(([pointLon, pointLat], index) => {
            const distance = this.calculateDistance(lat, lon, pointLat, pointLon);
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = index;
            }
        });

        if (minDistance > 500) {
            return null;
        }

        return nearestIndex;
    }

    getTripDestination(stopTimes) {
        if (!stopTimes || stopTimes.length === 0) {
            return 'Destination inconnue';
        }

        const lastStop = stopTimes[stopTimes.length - 1];
        const stopInfo = this.getStop(lastStop.stop_id);
        
        return stopInfo ? stopInfo.stop_name : 'Destination inconnue';
    }

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

    findFirstActiveSecond() {
        const bounds = this.getDailyServiceBounds();
        return bounds.earliestStart;
    }

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

    formatDuration(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        let str = "";
        if (hours > 0) {
            str += `${hours} h `;
        }
        if (minutes > 0 || hours === 0) {
            str += `${minutes} min`;
        }
        return str.trim();
    }
}
