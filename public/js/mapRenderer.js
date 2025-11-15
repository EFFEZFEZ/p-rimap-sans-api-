/**
 * mapRenderer.js - VERSION V17 (Mise à jour dynamique fluide)
 *
 * *** MISE À JOUR V17 ***
 * - Réactivation de la mise à jour en temps réel des popups
 * - Utilisation de mise à jour intelligente : modification du texte
 *   uniquement si nécessaire (pas de recréation du DOM)
 * - Animation douce lors du changement d'arrêt
 * - Pas de clignotement : le popup reste ouvert et seul son contenu change
 */

export class MapRenderer {
    /**
     * @param {string} mapElementId - L'ID de l'élément HTML de la carte
     * @param {DataManager} dataManager - L'instance de DataManager
     * @param {TimeManager} timeManager - L'instance de TimeManager
     */
    constructor(mapElementId, dataManager, timeManager) {
        this.mapElementId = mapElementId;
        this.map = null;
        this.busMarkers = {}; // Garde la trace de nos marqueurs (clé: tripId)
        this.routeLayer = null;
        this.routeLayersById = {};
        this.selectedRoute = null;
        this.centerCoordinates = [45.1833, 0.7167]; // Périgueux
        this.zoomLevel = 16;
        this.tempStopMarker = null;

        this.stopLayer = null;

        /* Garder une référence aux managers */
        this.dataManager = dataManager;
        this.timeManager = timeManager;

        /* Initialisation du groupe de clusters */
        this.clusterGroup = L.markerClusterGroup({
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 16 
        });
    }

    /**
     * Initialise la carte Leaflet
     */
    initializeMap(useClusters = true) {
        this.map = L.map(this.mapElementId).setView(this.centerCoordinates, this.zoomLevel);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        /* Initialisation des couches */
        this.stopLayer = L.layerGroup().addTo(this.map);
        
        if (useClusters) {
            this.map.addLayer(this.clusterGroup);
        }
        
        console.log(`🗺️ Carte ${this.mapElementId} initialisée`);
        this.map.on('click', () => {
            if (this.tempStopMarker) {
                this.map.removeLayer(this.tempStopMarker);
                this.tempStopMarker = null;
            }
        });
    }

    offsetPoint(lat1, lon1, lat2, lon2, offsetMeters, index, total) {
        const earthRadius = 6371000;
        const lat1Rad = lat1 * Math.PI / 180;
        const lon1Rad = lon1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        const lon2Rad = lon2 * Math.PI / 180;
        const bearing = Math.atan2(
            Math.sin(lon2Rad - lon1Rad) * Math.cos(lat2Rad),
            Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad)
        );
        const perpBearing = bearing + Math.PI / 2;
        const offsetDistance = offsetMeters * (index - (total - 1) / 2);
        const angularDistance = offsetDistance / earthRadius;
        const newLat = Math.asin(
            Math.sin(lat1Rad) * Math.cos(angularDistance) +
            Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(perpBearing)
        );
        const newLon = lon1Rad + Math.atan2(
            Math.sin(perpBearing) * Math.sin(angularDistance) * Math.cos(lat1Rad),
            Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(newLat)
        );
        return [newLat * 180 / Math.PI, newLon * 180 / Math.PI];
    }
    
    offsetLineString(coordinates, offsetMeters, index, total) {
        const offsetCoords = [];
        for (let i = 0; i < coordinates.length; i++) {
            const [lon, lat] = coordinates[i];
            let lon2, lat2;
            if (i < coordinates.length - 1) {
                [lon2, lat2] = coordinates[i + 1];
            } else {
                [lon2, lat2] = coordinates[i - 1];
            }
            const [newLat, newLon] = this.offsetPoint(lat, lon, lat2, lon2, offsetMeters, index, total);
            offsetCoords.push([newLon, newLat]);
        }
        return offsetCoords;
    }
    
    displayMultiColorRoutes(geoJsonData, dataManager, visibleRoutes) {
        if (!geoJsonData) {
            console.warn('Aucune donnée GeoJSON à afficher');
            return;
        }
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }
        this.routeLayer = L.layerGroup().addTo(this.map);
        this.routeLayersById = {};
        const geometryMap = new Map();
        geoJsonData.features.forEach(feature => {
            if (feature.geometry && feature.geometry.type === 'LineString') {
                const routeId = feature.properties?.route_id;
                if (!visibleRoutes.has(routeId)) {
                    return;
                }
                const geomKey = JSON.stringify(feature.geometry.coordinates);
                if (!geometryMap.has(geomKey)) {
                    geometryMap.set(geomKey, []);
                }
                geometryMap.get(geomKey).push(feature);
            }
        });
        geometryMap.forEach((features, geomKey) => {
            const numRoutes = features.length;
            const baseWidth = 4;
            const offsetMeters = 3;
            if (numRoutes === 1) {
                const feature = features[0];
                const routeColor = feature.properties?.route_color || '#3388ff';
                const routeId = feature.properties?.route_id;
                const layer = L.geoJSON(feature, {
                    style: {
                        color: routeColor,
                        weight: baseWidth,
                        opacity: 0.85,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }
                });
                if (routeId) {
                    if (!this.routeLayersById[routeId]) this.routeLayersById[routeId] = [];
                    this.routeLayersById[routeId].push(layer);
                }
                this.addRoutePopup(layer, features, dataManager);
                layer.addTo(this.routeLayer);
            } else {
                features.forEach((feature, index) => {
                    const routeColor = feature.properties?.route_color || '#3388ff';
                    const routeId = feature.properties?.route_id;
                    const offsetCoords = this.offsetLineString(
                        feature.geometry.coordinates,
                        offsetMeters,
                        index,
                        numRoutes
                    );
                    const offsetFeature = {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: offsetCoords
                        },
                        properties: feature.properties
                    };
                    const layer = L.geoJSON(offsetFeature, {
                        style: {
                            color: routeColor,
                            weight: baseWidth,
                            opacity: 0.85,
                            lineCap: 'round',
                            lineJoin: 'round'
                        }
                    });
                    if (routeId) {
                        if (!this.routeLayersById[routeId]) this.routeLayersById[routeId] = [];
                        this.routeLayersById[routeId].push(layer);
                    }
                    layer.addTo(this.routeLayer);
                    this.addRoutePopup(layer, features, dataManager);
                });
            }
        });
    }
    
    addRoutePopup(layer, features, dataManager) {
        let content = '<b>Ligne(s) sur ce tracé:</b><br>';
        const routeNames = new Set();
        features.forEach(feature => {
            const routeId = feature.properties?.route_id;
            const route = dataManager.getRoute(routeId);
            if (route) {
                routeNames.add(route.route_short_name || routeId);
            }
        });
        content += Array.from(routeNames).join(', ');
        layer.bindPopup(content);
    }

    /**
     * MODIFIÉ (V17 - Mise à jour dynamique sans clignotement)
     */
    updateBusMarkers(busesWithPositions, tripScheduler, currentSeconds) {
        const markersToAdd = [];
        const markersToRemove = [];
        const activeBusIds = new Set();
        
        // 1. Trouver les marqueurs à supprimer
        busesWithPositions.forEach(bus => activeBusIds.add(bus.tripId));

        Object.keys(this.busMarkers).forEach(busId => {
            if (!activeBusIds.has(busId)) {
                // Ce marqueur va être supprimé
                const markerData = this.busMarkers[busId];
                markersToRemove.push(markerData.marker);
                delete this.busMarkers[busId];
            }
        });

        // 2. Mettre à jour les marqueurs existants et ajouter les nouveaux
        busesWithPositions.forEach(bus => {
            const busId = bus.tripId;
            if (!busId) return;
            
            const { lat, lon } = bus.position;
            
            if (this.busMarkers[busId]) {
                // Marqueur existant
                const markerData = this.busMarkers[busId];
                markerData.bus = bus; // Met à jour les données du bus
                markerData.marker.setLatLng([lat, lon]);
                
                // *** V17 - Mise à jour dynamique du popup s'il est ouvert ***
                if (markerData.marker.isPopupOpen()) {
                    this.updateMovingBusPopupSmoothly(markerData.marker.getPopup().getElement(), bus, tripScheduler);
                }

            } else {
                // Nouveau marqueur
                const markerData = this.createBusMarker(bus, tripScheduler, busId);
                this.busMarkers[busId] = markerData;
                if (this.clusterGroup) {
                    markersToAdd.push(markerData.marker);
                } else {
                    markerData.marker.addTo(this.map); // Ajout direct si pas de cluster
                }
            }
        });

        // Nettoyage final des couches
        if (this.clusterGroup) {
            if (markersToRemove.length > 0) {
                this.clusterGroup.removeLayers(markersToRemove);
            }
            if (markersToAdd.length > 0) {
                this.clusterGroup.addLayers(markersToAdd);
            }
        } else {
             if (markersToRemove.length > 0) {
                markersToRemove.forEach(m => this.map.removeLayer(m));
            }
        }
    }

    /**
     * V17 - Mise à jour douce du popup sans recréation
     * Compare les valeurs et ne met à jour que si nécessaire
     */
    updateMovingBusPopupSmoothly(popupElement, bus, tripScheduler) {
        if (!popupElement) return;
        
        try {
            const stopTimes = tripScheduler.dataManager.stopTimesByTrip[bus.tripId];
            const destination = tripScheduler.getTripDestination(stopTimes);
            const nextStopName = bus.segment?.toStopInfo?.stop_name || 'Inconnu';
            const nextStopETA = tripScheduler.getNextStopETA(bus.segment, bus.currentSeconds);

            const stateText = `En Ligne (vers ${destination})`;
            const nextStopText = nextStopName;
            const etaText = nextStopETA ? nextStopETA.formatted : '...';

            // Sélectionne les éléments à mettre à jour
            const stateEl = popupElement.querySelector('[data-update="state"]');
            const nextStopEl = popupElement.querySelector('[data-update="next-stop-value"]');
            const etaEl = popupElement.querySelector('[data-update="eta-value"]');

            // Met à jour uniquement si le contenu a changé (évite les repaint inutiles)
            if (stateEl && stateEl.textContent !== stateText) {
                stateEl.textContent = stateText;
            }
            if (nextStopEl && nextStopEl.textContent !== nextStopText) {
                // Animation douce lors du changement d'arrêt
                nextStopEl.style.transition = 'opacity 0.3s';
                nextStopEl.style.opacity = '0.5';
                setTimeout(() => {
                    nextStopEl.textContent = nextStopText;
                    nextStopEl.style.opacity = '1';
                }, 150);
            }
            if (etaEl && etaEl.textContent !== etaText) {
                etaEl.textContent = etaText;
            }
            
        } catch (e) {
            console.error("Erreur mise à jour popup:", e);
        }
    }

    /**
     * Crée le contenu popup avec une structure HTML unifiée
     */
    createBusPopupContent(bus, tripScheduler) {
        const route = bus.route;
        const routeShortName = route?.route_short_name || route?.route_id || '?';
        const routeColor = route?.route_color ? `#${route.route_color}` : '#3B82F6';
        const textColor = route?.route_text_color ? `#${route.route_text_color}` : '#ffffff';

        let stateText, nextStopLabelText, nextStopText, etaLabelText, etaText;

        const stopTimes = tripScheduler.dataManager.stopTimesByTrip[bus.tripId];
        const destination = tripScheduler.getTripDestination(stopTimes);

        const nextStopName = bus.segment?.toStopInfo?.stop_name || 'Inconnu';
        const nextStopETA = tripScheduler.getNextStopETA(bus.segment, bus.currentSeconds);

        stateText = `En Ligne (vers ${destination})`;
        nextStopLabelText = "Prochain arrêt :";
        nextStopText = nextStopName;
        etaLabelText = "Arrivée :";
        etaText = nextStopETA ? nextStopETA.formatted : '...';

        // Structure HTML unifiée (avec data-update)
        const detailsHtml = `
            <p><strong>Statut:</strong> <span data-update="state">${stateText}</span></p>
            <p><strong data-update="next-stop-label">${nextStopLabelText}</strong> <span data-update="next-stop-value">${nextStopText}</span></p>
            <p><strong data-update="eta-label">${etaLabelText}</strong> <span data-update="eta-value">${etaText}</span></p>
        `;

        return `
            <div class="info-popup-content"> 
                <div class="info-popup-header" style="background: ${routeColor}; color: ${textColor};">
                    Ligne ${routeShortName}
                </div>
                <div class="info-popup-body bus-details">
                    ${detailsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Création d'un marqueur avec état initial
     */
    createBusMarker(bus, tripScheduler, busId) {
        const { lat, lon } = bus.position;
        const route = bus.route;
        const routeShortName = route?.route_short_name || route?.route_id || '?';
        const routeColor = route?.route_color ? `#${route.route_color}` : '#FFC107';
        const textColor = route?.route_text_color ? `#${route.route_text_color}` : '#ffffff';

        const iconClassName = 'bus-icon-rect';
        const statusClass = bus.currentStatus ? `bus-status-${bus.currentStatus}` : 'bus-status-normal';

        const icon = L.divIcon({
            className: `${iconClassName} ${statusClass}`,
            html: `<div style="background-color: ${routeColor}; color: ${textColor};">${routeShortName}</div>`,
            iconSize: [40, 24],
            iconAnchor: [20, 12],
            popupAnchor: [0, -12]
        });

        const marker = L.marker([lat, lon], { icon });
        
        // Popup est vide au début
        marker.bindPopup("");

        // Le contenu est généré UNIQUEMENT à l'ouverture
        marker.on('popupopen', (e) => {
            const markerData = this.busMarkers[busId];
            if (!markerData || !markerData.bus) {
                e.popup.setContent("Informations non disponibles.");
                return;
            }

            const freshBus = markerData.bus;
            const freshPopupContent = this.createBusPopupContent(freshBus, tripScheduler);
            e.popup.setContent(freshPopupContent);
        });

        return {
            marker: marker,
            bus: bus
        };
    }

    /**
     * Surligne un tracé sur la carte
     */
    highlightRoute(routeId, state) {
        if (!this.routeLayersById || !this.routeLayersById[routeId]) return;
        const weight = state ? 6 : 4; 
        const opacity = state ? 1 : 0.85;
        this.routeLayersById[routeId].forEach(layer => {
            layer.setStyle({ weight: weight, opacity: opacity });
            if (state) {
                layer.bringToFront(); 
            }
        });
    }

    /**
     * Zoome sur un tracé de ligne
     */
    zoomToRoute(routeId) {
        if (!this.routeLayersById || !this.routeLayersById[routeId] || this.routeLayersById[routeId].length === 0) {
            console.warn(`Aucune couche trouvée pour zoomer sur la route ${routeId}`);
            return;
        }
        const routeGroup = L.featureGroup(this.routeLayersById[routeId]);
        const bounds = routeGroup.getBounds();
        if (bounds && bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    /**
     * Zoome sur un arrêt
     */
    zoomToStop(stop) {
        const lat = parseFloat(stop.stop_lat);
        const lon = parseFloat(stop.stop_lon);
        if (isNaN(lat) || isNaN(lon)) return;
        this.map.setView([lat, lon], 17);
        if (this.tempStopMarker) {
            this.map.removeLayer(this.tempStopMarker);
        }
        const stopIcon = L.divIcon({
            className: 'stop-search-marker',
            html: `<div></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
        this.tempStopMarker = L.marker([lat, lon], { icon: stopIcon }).addTo(this.map);
    }

    /**
     * Affiche les "master stops" sur la carte, si le zoom est suffisant
     */
    displayStops(minZoom = 13) { 
        this.stopLayer.clearLayers(); 

        const currentZoom = this.map.getZoom();
        if (currentZoom < minZoom) {
            return; 
        }

        const stopIcon = L.divIcon({
            className: 'stop-marker-icon',
            iconSize: [10, 10],
            iconAnchor: [5, 5]
        });

        const stopsToDisplay = [];
        this.dataManager.masterStops.forEach(stop => {
            const lat = parseFloat(stop.stop_lat);
            const lon = parseFloat(stop.stop_lon);
            if (isNaN(lat) || isNaN(lon)) return;

            // zIndexOffset -100 pour que les bus passent TOUJOURS au-dessus
            const marker = L.marker([lat, lon], { icon: stopIcon, zIndexOffset: -100 });
            
            /* Attache un événement au lieu d'un popup statique */
            marker.on('click', () => this.onStopClick(stop));
            
            stopsToDisplay.push(marker);
        });

        stopsToDisplay.forEach(marker => this.stopLayer.addLayer(marker));
    }

    /**
     * Appelé lorsqu'un marqueur d'arrêt est cliqué
     */
    onStopClick(masterStop) {
        const currentSeconds = this.timeManager.getCurrentSeconds();
        const currentDate = this.timeManager.getCurrentDate();

        const associatedStopIds = this.dataManager.groupedStopMap[masterStop.stop_id] || [masterStop.stop_id];

        const departures = this.dataManager.getUpcomingDepartures(associatedStopIds, currentSeconds, currentDate, 5);

        const popupContent = this.createStopPopupContent(masterStop, departures, currentSeconds);
        
        const lat = parseFloat(masterStop.stop_lat);
        const lon = parseFloat(masterStop.stop_lon);
        L.popup()
            .setLatLng([lat, lon])
            .setContent(popupContent)
            .openOn(this.map);
    }

    /**
     * Formate le contenu HTML pour le popup d'un arrêt
     */
    createStopPopupContent(masterStop, departures, currentSeconds) {
        let html = `<div class="info-popup-content">`;
        html += `<div class="info-popup-header">${masterStop.stop_name}</div>`;
        html += `<div class="info-popup-body">`; 

        if (departures.length === 0) {
            html += `<div class="departure-item empty">Aucun prochain passage trouvé.</div>`;
        } else {
            departures.forEach(dep => {
                const waitSeconds = dep.departureSeconds - currentSeconds;
                let waitTime = "";
                if (waitSeconds >= 0) {
                    const waitMinutes = Math.floor(waitSeconds / 60);
                    if (waitMinutes === 0) {
                        waitTime = `<span class="wait-time imminent">Imminent</span>`;
                    } else {
                        waitTime = `<span class="wait-time">${waitMinutes} min</span>`;
                    }
                }

                html += `
                    <div class="departure-item">
                        <div class="departure-info">
                            <span class="departure-badge" style="background-color: #${dep.routeColor}; color: #${dep.routeTextColor};">
                                ${dep.routeShortName}
                            </span>
                            <span class="departure-dest">${dep.destination}</span>
                        </div>
                        <div class="departure-time">
                            <strong>${dep.time.substring(0, 5)}</strong>
                            ${waitTime}
                        </div>
                    </div>
                `;
            });
        }

        html += `</div></div>`;
        return html;
    }
}
