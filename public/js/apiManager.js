/**
 * apiManager.js
 * Gère tous les appels aux API externes (Google Places & Google Routes).
 * Utilise la NOUVELLE API Places (AutocompleteSuggestion) recommandée depuis mars 2025.
 *
 * MODES DE TRANSPORT:
 * - BUS uniquement (pas de train/métro/tramway)
 * - MARCHE automatiquement incluse pour rejoindre les arrêts
 * - Pour le vélo, une requête séparée sera nécessaire
 *
 * CORRECTION: Le FieldMask de fetchItinerary est élargi pour inclure 
 * tous les champs de "steps" (y compris .name) requis par main.js.
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
     * Calcule un itinéraire en transport en commun (BUS uniquement, pas de train)
     */
    async fetchItinerary(fromPlaceId, toPlaceId) {
        console.log(`🚍 API Google Routes: Calcul de ${fromPlaceId} à ${toPlaceId}`);

        const API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

        const body = {
            origin: { placeId: fromPlaceId },
            destination: { placeId: toPlaceId },
            travelMode: "TRANSIT",
            transitPreferences: {
                allowedTravelModes: ["BUS"], // Uniquement le bus
                routingPreference: "LESS_WALKING"
            },
            languageCode: "fr",
            units: "METRIC"
        };

        console.log("📤 Requête envoyée:", JSON.stringify(body, null, 2));

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    
                    // *** CORRECTION ICI ***
                    // Demande 'routes.legs' en entier pour obtenir tous les sous-champs
                    // (y compris departureStop.name) dont main.js a besoin.
                    'X-Goog-FieldMask': 'routes.duration,routes.legs'
                },
                body: JSON.stringify(body)
            });

            console.log("📥 Statut de la réponse:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Texte d'erreur brut:", errorText);
                try {
                    const errorData = JSON.parse(errorText);
                    console.error("❌ Erreur de l'API Routes:", errorData);
                    throw new Error(`API Routes a échoué: ${errorData.error?.message || response.statusText}`);
                } catch (parseError) {
                    throw new Error(`API Routes a échoué (${response.status}): ${errorText}`);
                }
            }

            const data = await response.json();
            console.log("✅ Réponse de l'API Routes:", data);
            
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
                const errorData = await response.json();
                console.error("❌ Erreur de l'API Routes (vélo):", errorData);
                throw new Error(`API Routes (vélo) a échoué: ${errorData.error?.message || response.statusText}`);
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
