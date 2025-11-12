/**
 * apiManager.js - VERSION CORRIGÉE avec arrêts intermédiaires
 * Gère tous les appels aux API externes (Google Places & Google Routes).
 * Utilise la NOUVELLE API Places (AutocompleteSuggestion) recommandée depuis mars 2025.
 *
 * CORRECTIONS APPLIQUÉES:
 * 1. FieldMask corrigé selon la documentation officielle Google
 * 2. Utilisation de 'routes.legs.steps.transitDetails' (validé par la doc)
 * 3. Ajout de tous les champs nécessaires pour l'affichage
 * 4. Ajout des arrêts intermédiaires (intermediateStops)
 * 5. Gestion d'erreurs améliorée
 * 6. Ajout de routes.legs.startTime et routes.legs.endTime
 * 7. Suppression du paramètre invalide 'routeCount'
 */

export class ApiManager {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.placesService = null;
        this.sessionToken = null;

        // Zone du Grand Périgueux / Dordogne
        // Rectangle couvrant le Grand Périgueux et environs
        this.perigueuxBounds = {
            south: 45.10,  // Sud du Grand Périgueux
            west: 0.60,    // Ouest
            north: 45.30,  // Nord
            east: 0.85     // Est
        };
        
        this.perigueuxCenter = { lat: 45.184029, lng: 0.7211149 };
    }

    /**
     * Initialise le chargeur de l'API Google Maps.
     */
    loadGoogleMapsAPI() {
        if (window.google && window.google.maps && window.google.maps.places) {
            console.log("✅ API Google Maps déjà chargée.");
            this.initServices();
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            
            // Charge la version beta ET la nouvelle bibliothèque "places-new"
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places,places-new&loading=async&v=beta`;
            
            script.async = true;
            script.defer = true;
            
            script.onload = () => {
                console.log("✅ API Google Maps (v=beta, places-new) chargée avec succès.");
                setTimeout(() => {
                    if (window.google && window.google.maps && window.google.maps.places) {
                        this.initServices();
                        resolve();
                    } else {
                        console.error("❌ google.maps.places n'est pas disponible après le chargement");
                        reject(new Error("Bibliothèque places non disponible"));
                    }
                }, 100);
            };
            
            script.onerror = () => {
                console.error("❌ Erreur lors du chargement du script Google Maps.");
                reject(new Error("Impossible de charger Google Maps API."));
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * Initialise les services une fois l'API chargée.
     */
    initServices() {
        if (!window.google || !window.google.maps || !window.google.maps.places) {
            console.error("❌ La bibliothèque Google Maps 'places' n'est pas disponible.");
            return;
        }
        
        try {
            if (google.maps.places.AutocompleteSuggestion) {
                this.placesService = google.maps.places.AutocompleteSuggestion;
                console.log("✅ Nouveau service AutocompleteSuggestion initialisé.");
            } else {
                console.warn("⚠️ AutocompleteSuggestion non disponible, utilisation de l'ancienne API");
                this.placesService = new google.maps.places.AutocompleteService();
            }
            
            this.sessionToken = new google.maps.places.AutocompleteSessionToken();
            
        } catch (error) {
            console.error("❌ Erreur lors de l'initialisation des services:", error);
        }
    }

    /**
     * Récupère les suggestions d'autocomplétion avec la NOUVELLE API
     */
    async getPlaceAutocomplete(inputString) {
        if (!this.placesService) {
            console.warn("⚠️ Service d'autocomplétion non initialisé. Tentative de chargement...");
            await this.loadGoogleMapsAPI();
            if (!this.placesService) {
                console.error("❌ Impossible d'initialiser le service d'autocomplétion");
                return [];
            }
        }

        try {
            // Si c'est la nouvelle API AutocompleteSuggestion
            if (this.placesService === google.maps.places.AutocompleteSuggestion) {
                const request = {
                    input: inputString,
                    locationRestriction: {
                        south: this.perigueuxBounds.south,
                        west: this.perigueuxBounds.west,
                        north: this.perigueuxBounds.north,
                        east: this.perigueuxBounds.east
                    },
                    region: "fr",
                    sessionToken: this.sessionToken,
                };

                console.log("🔍 Recherche autocomplétion:", inputString);
                const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
                console.log(`✅ ${suggestions.length} suggestions trouvées`);
                
                const results = suggestions.map(s => ({
                    description: s.placePrediction.text.text,
                    placeId: s.placePrediction.placeId,
                }));
                
                return results;
            } else {
                // Fallback : ancienne API
                return new Promise((resolve, reject) => {
                    const request = {
                        input: inputString,
                        sessionToken: this.sessionToken,
                        componentRestrictions: { country: 'fr' },
                        bounds: new google.maps.LatLngBounds(
                            new google.maps.LatLng(this.perigueuxBounds.south, this.perigueuxBounds.west),
                            new google.maps.LatLng(this.perigueuxBounds.north, this.perigueuxBounds.east)
                        ),
                        strictBounds: true,
                    };

                    this.placesService.getPlacePredictions(request, (predictions, status) => {
                        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                            console.warn("⚠️ Échec de l'autocomplétion Places:", status);
                            resolve([]);
                        } else {
                            console.log(`✅ ${predictions.length} suggestions trouvées (ancienne API)`);
                            const results = predictions.map(p => ({
                                description: p.description,
                                placeId: p.place_id,
                            }));
                            resolve(results);
                        }
                    });
                });
            }
        } catch (error) {
            console.error("❌ Erreur lors de l'autocomplétion:", error);
            return [];
        }
    }

    /**
     * Calcule un itinéraire en transport en commun (BUS uniquement)
     * 
     * FieldMask basé sur la documentation officielle:
     * https://developers.google.com/maps/documentation/routes/transit-route
     * 
     * Exemple de FieldMask validé par Google pour TRANSIT:
     * 'X-Goog-FieldMask: routes.legs.steps.transitDetails'
     */
    async fetchItinerary(fromPlaceId, toPlaceId, searchTime = null) {
        console.log(`🚍 API Google Routes: Calcul de ${fromPlaceId} à ${toPlaceId}`);

        const API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

        const body = {
            origin: { placeId: fromPlaceId },
            destination: { placeId: toPlaceId },
            travelMode: "TRANSIT",
            // *** DEMANDE DE TRAJETS ALTERNATIFS ***
            // L'API Google Routes v2 renvoie automatiquement entre 1 et 3 trajets
            // quand computeAlternativeRoutes est activé
            computeAlternativeRoutes: true,
            // ***********************************************
            transitPreferences: {
                allowedTravelModes: ["BUS"], // Uniquement le bus
                routingPreference: "LESS_WALKING"
            },
            languageCode: "fr",
            units: "METRIC"
        };

        // Ajout du temps de départ/arrivée si spécifié
        if (searchTime) {
            const dateTime = this._buildDateTime(searchTime);
            if (searchTime.type === 'arriver') {
                body.arrivalTime = dateTime;
            } else {
                body.departureTime = dateTime;
            }
        }

        console.log("📤 Requête envoyée:", JSON.stringify(body, null, 2));

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    
                    // ✅ FIELDMASK FINAL - Inclut startTime et endTime pour les heures globales
                    'X-Goog-FieldMask': 'routes.duration,routes.legs.startTime,routes.legs.endTime,routes.legs.steps.travelMode,routes.legs.steps.distanceMeters,routes.legs.steps.localizedValues,routes.legs.steps.navigationInstruction,routes.legs.steps.transitDetails'
                },
                body: JSON.stringify(body)
            });

            console.log("📥 Statut de la réponse:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Texte d'erreur brut:", errorText);
                
                let errorMessage = `Erreur ${response.status}`;
                
                try {
                    const errorData = JSON.parse(errorText);
                    console.error("❌ Erreur de l'API Routes:", errorData);
                    
                    if (errorData.error?.message) {
                        errorMessage = errorData.error.message;
                    }
                    
                    // Erreur spécifique: pas de trajet en bus trouvé
                    if (response.status === 404 || errorMessage.includes("NOT_FOUND")) {
                        throw new Error("Aucun trajet en bus disponible pour cet itinéraire.");
                    }
                    
                    // Erreur de FieldMask
                    if (errorData.error?.details?.[0]?.fieldViolations) {
                        const violations = errorData.error.details[0].fieldViolations;
                        console.error("❌ Violations de champs:", violations);
                        throw new Error(`Erreur de configuration API: ${violations[0]?.description || 'FieldMask invalide'}`);
                    }
                    
                } catch (parseError) {
                    // Si le JSON ne peut pas être parsé, utiliser le texte brut
                    if (parseError instanceof SyntaxError) {
                        throw new Error(`${errorMessage}: ${errorText.substring(0, 200)}`);
                    }
                    throw parseError;
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log("✅ Réponse de l'API Routes:", data);
            console.log(`✅ Nombre de trajets trouvés: ${data.routes?.length || 0}`);
            
            // Log des arrêts intermédiaires pour vérification
            if (data.routes) {
                data.routes.forEach((route, routeIndex) => {
                    route.legs?.forEach((leg, legIndex) => {
                        leg.steps?.forEach((step, stepIndex) => {
                            if (step.transitDetails?.stopDetails?.intermediateStops) {
                                const count = step.transitDetails.stopDetails.intermediateStops.length;
                                console.log(`✅ Trajet ${routeIndex + 1}, Étape ${legIndex}-${stepIndex}: ${count} arrêts intermédiaires`);
                            }
                        });
                    });
                });
            }
            
            // Vérifier si des routes ont été trouvées
            if (!data.routes || data.routes.length === 0) {
                throw new Error("Aucun itinéraire en bus trouvé pour ces lieux.");
            }
            
            // Régénérer le token de session après une requête réussie
            if (window.google && window.google.maps && window.google.maps.places) {
                this.sessionToken = new google.maps.places.AutocompleteSessionToken();
            }

            return data;

        } catch (error) {
            console.error("❌ Erreur lors de l'appel à fetchItinerary:", error);
            throw error;
        }
    }

    /**
     * Construit un objet DateTime ISO 8601 pour l'API Google Routes
     * @private
     */
    _buildDateTime(searchTime) {
        const { date, hour, minute } = searchTime;
        
        // Si date est vide ou "today", utiliser la date actuelle
        let dateObj;
        if (!date || date === 'today' || date === "Aujourd'hui") {
            dateObj = new Date();
        } else {
            dateObj = new Date(date);
        }
        
        // Vérifier que la date est valide
        if (isNaN(dateObj.getTime())) {
            console.warn("⚠️ Date invalide, utilisation de la date actuelle");
            dateObj = new Date();
        }
        
        // Définir l'heure et les minutes
        const hourInt = parseInt(hour) || 0;
        const minuteInt = parseInt(minute) || 0;
        dateObj.setHours(hourInt, minuteInt, 0, 0);
        
        console.log("🕒 DateTime construit:", dateObj.toISOString());
        return dateObj.toISOString();
    }

    /**
     * Calcule un itinéraire à vélo
     */
    async fetchBicycleRoute(fromPlaceId, toPlaceId) {
        console.log(`🚴 API Google Routes (VÉLO): Calcul de ${fromPlaceId} à ${toPlaceId}`);

        const API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

        const body = {
            origin: { placeId: fromPlaceId },
            destination: { placeId: toPlaceId },
            travelMode: "BICYCLE",
            languageCode: "fr",
            units: "METRIC"
        };

        console.log("📤 Requête vélo envoyée:", JSON.stringify(body, null, 2));

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Erreur de l'API Routes (vélo):", errorText);
                
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(`API Routes (vélo) a échoué: ${errorData.error?.message || response.statusText}`);
                } catch (parseError) {
                    if (parseError instanceof SyntaxError) {
                        throw new Error(`API Routes (vélo) a échoué (${response.status}): ${errorText}`);
                    }
                    throw parseError;
                }
            }

            const data = await response.json();
            console.log("✅ Réponse de l'API Routes (vélo):", data);
            return data;

        } catch (error) {
            console.error("❌ Erreur lors de l'appel à fetchBicycleRoute:", error);
            throw error;
        }
    }
}
