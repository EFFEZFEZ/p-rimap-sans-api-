/**
 * apiManager.js
 * Gère tous les appels aux API externes (Google Places & Google Routes).
 * Utilise la NOUVELLE API Places (AutocompleteSuggestion) recommandée depuis mars 2025.
 */

export class ApiManager {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.placesService = null;
        this.sessionToken = null;

        // Centre sur Périgueux avec un rayon de 10km
        // Coordonnées du centre de Périgueux : 45.184029, 0.7211149
        this.locationBias = {
            center: {
                latitude: 45.184029,
                longitude: 0.7211149
            },
            radius: 10000 // 10 km en mètres
        };
    }

    /**
     * Initialise le chargeur de l'API Google Maps.
     */
    loadGoogleMapsAPI() {
        if (window.google && window.google.maps && window.google.maps.places) {
            console.log("API Google Maps déjà chargée.");
            this.initServices();
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            
            // Utilisation de la nouvelle API Places (v=beta)
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&loading=async&v=beta`;
            
            script.async = true;
            script.defer = true;
            
            script.onload = () => {
                console.log("API Google Maps (v=beta) chargée avec succès.");
                // Petit délai pour s'assurer que tout est chargé
                setTimeout(() => {
                    if (window.google && window.google.maps && window.google.maps.places) {
                        this.initServices();
                        resolve();
                    } else {
                        console.error("google.maps.places n'est pas disponible après le chargement");
                        reject(new Error("Bibliothèque places non disponible"));
                    }
                }, 100);
            };
            
            script.onerror = () => {
                console.error("Erreur lors du chargement du script Google Maps.");
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
            console.error("La bibliothèque Google Maps 'places' n'est pas disponible.");
            return;
        }
        
        try {
            // Utilisation de la NOUVELLE API AutocompleteSuggestion (recommandée depuis mars 2025)
            if (google.maps.places.AutocompleteSuggestion) {
                this.placesService = google.maps.places.AutocompleteSuggestion;
                console.log("✅ Nouveau service AutocompleteSuggestion initialisé.");
            } else {
                // Fallback vers l'ancienne API si la nouvelle n'est pas disponible
                console.warn("⚠️ AutocompleteSuggestion non disponible, utilisation de l'ancienne API");
                this.placesService = new google.maps.places.AutocompleteService();
            }
            
            // Crée un jeton de session pour l'autocomplétion
            this.sessionToken = new google.maps.places.AutocompleteSessionToken();
            
        } catch (error) {
            console.error("Erreur lors de l'initialisation des services:", error);
        }
    }

    /**
     * Récupère les suggestions d'autocomplétion avec la NOUVELLE API
     * @param {string} inputString - Le texte tapé par l'utilisateur
     * @returns {Promise<Array>} Une liste de suggestions
     */
    async getPlaceAutocomplete(inputString) {
        if (!this.placesService) {
            console.warn("Service d'autocomplétion non initialisé. Tentative de chargement...");
            await this.loadGoogleMapsAPI();
            if (!this.placesService) {
                console.error("Impossible d'initialiser le service d'autocomplétion");
                return [];
            }
        }

        try {
            // Si c'est la nouvelle API AutocompleteSuggestion
            if (this.placesService === google.maps.places.AutocompleteSuggestion) {
                const request = {
                    input: inputString,
                    locationBias: {
                        circle: this.locationBias
                    },
                    includedPrimaryTypes: ["locality", "sublocality", "postal_code", "route", "street_address"],
                    region: "fr",
                    sessionToken: this.sessionToken,
                };

                // Utilisation de la méthode fetchAutocompleteSuggestions
                const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
                
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
                        locationBias: {
                            circle: this.locationBias
                        },
                    };

                    this.placesService.getPlacePredictions(request, (predictions, status) => {
                        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                            console.warn("Échec de l'autocomplétion Places:", status);
                            resolve([]);
                        } else {
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
            console.error("Erreur lors de l'autocomplétion:", error);
            return [];
        }
    }

    /**
     * Calcule un itinéraire (API Google Routes)
     * @param {string} fromPlaceId - L'ID de lieu Google du départ
     * @param {string} toPlaceId - L'ID de lieu Google de l'arrivée
     * @returns {Promise<Object>} Un objet d'itinéraire
     */
    async fetchItinerary(fromPlaceId, toPlaceId) {
        console.log(`API Google Routes: Calcul de ${fromPlaceId} à ${toPlaceId}`);

        const API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

        const body = {
            origin: { placeId: fromPlaceId },
            destination: { placeId: toPlaceId },
            travelMode: "TRANSIT",
            
            transitPreferences: {
                allowedTravelModes: ["BUS", "WALK"],
            },
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': 'routes.legs,routes.duration,routes.distanceMeters,routes.polyline,routes.steps'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Erreur de l'API Routes:", errorData);
                throw new Error(`API Routes a échoué: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            
            console.log("Réponse de l'API Routes:", data);
            
            // Réinitialise le jeton de session après une recherche réussie
            if (window.google && window.google.maps && window.google.maps.places) {
                this.sessionToken = new google.maps.places.AutocompleteSessionToken();
            }

            return data;

        } catch (error) {
            console.error("Erreur lors de l'appel à fetchItinerary:", error);
            throw error;
        }
    }
}
