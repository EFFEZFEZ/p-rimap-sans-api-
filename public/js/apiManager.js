/**
 * apiManager.js
 * Gère tous les appels aux API externes (Google Places & Google Routes).
 * Ce module nécessitera l'activation des API "Places API" et "Routes API"
 * dans votre console Google Cloud, ainsi qu'une clé d'API.
 */

export class ApiManager {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.autocompleteService = null;
        this.sessionToken = null;

        // Limite l'autosuggestion à la Dordogne
        this.dordogneBounds = {
            south: 44.5,
            west: 0.0,
            north: 45.7,
            east: 1.5,
        };
    }

    /**
     * Initialise le chargeur de l'API Google Maps.
     * @param {string} apiKey Votre clé d'API Google
     */
    loadGoogleMapsAPI() {
        if (window.google && window.google.maps && window.google.maps.places) {
            console.log("API Google Maps déjà chargée.");
            this.initServices();
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            
            // CORRECTION : Utilisation de loading=async au lieu de callback
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&loading=async`;
            
            script.async = true;
            script.defer = true;
            
            script.onload = () => {
                console.log("API Google Maps chargée avec succès.");
                // Attendre que google.maps.places soit disponible
                if (window.google && window.google.maps && window.google.maps.places) {
                    this.initServices();
                    resolve();
                } else {
                    console.error("google.maps.places n'est pas disponible après le chargement");
                    reject(new Error("Bibliothèque places non disponible"));
                }
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
            // CORRECTION PRINCIPALE : Utiliser AutocompleteService (sans "Place" au début)
            this.autocompleteService = new google.maps.places.AutocompleteService();
            
            // Crée un jeton de session pour l'autocomplétion
            this.sessionToken = new google.maps.places.AutocompleteSessionToken();
            
            console.log("Service d'autocomplétion Google initialisé avec succès.");
        } catch (error) {
            console.error("Erreur lors de l'initialisation des services:", error);
        }
    }

    /**
     * Récupère les suggestions d'autocomplétion (API Google Places)
     * @param {string} inputString - Le texte tapé par l'utilisateur
     * @returns {Promise<Array>} Une liste de suggestions
     */
    async getPlaceAutocomplete(inputString) {
        if (!this.autocompleteService) {
            console.warn("Service d'autocomplétion non initialisé. Tentative de chargement...");
            await this.loadGoogleMapsAPI();
            if (!this.autocompleteService) {
                console.error("Impossible d'initialiser le service d'autocomplétion");
                return [];
            }
        }

        return new Promise((resolve, reject) => {
            const request = {
                input: inputString,
                sessionToken: this.sessionToken,
                componentRestrictions: { country: 'fr' },
                // Biais vers la zone de la Dordogne
                locationBias: {
                    south: this.dordogneBounds.south,
                    west: this.dordogneBounds.west,
                    north: this.dordogneBounds.north,
                    east: this.dordogneBounds.east,
                },
            };

            this.autocompleteService.getPlacePredictions(request, (predictions, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                    console.warn("Échec de l'autocomplétion Places:", status);
                    resolve([]);
                } else {
                    // Formate les résultats
                    const results = predictions.map(p => ({
                        description: p.description,
                        placeId: p.place_id,
                    }));
                    resolve(results);
                }
            });
        });
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

        // Définit le corps de la requête
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
