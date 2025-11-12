/**
 * apiManager.js
 * * Gère tous les appels aux API externes (Google Places & Google Routes).
 * Ce module nécessitera l'activation des API "Places API" et "Routes API"
 * dans votre console Google Cloud, ainsi qu'une clé d'API.
 *
 * CORRECTION : Revient au constructeur correct "AutocompleteService"
 */

export class ApiManager {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.autocompleteService = null;
        this.sessionToken = null; // Jeton pour les sessions d'autocomplétion

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
     * C'est nécessaire pour utiliser les services Places.
     * @param {string} apiKey Votre clé d'API Google
     */
    loadGoogleMapsAPI() {
        if (window.google) {
            console.log("API Google Maps déjà chargée.");
            this.initServices();
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // Nous chargeons la bibliothèque "places"
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&callback=onGoogleMapsApiLoaded`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
            
            // Le script ci-dessus appellera cette fonction globale
            window.onGoogleMapsApiLoaded = () => {
                console.log("API Google Maps chargée avec succès.");
                this.initServices();
                resolve();
            };
            script.onerror = () => {
                console.error("Erreur lors du chargement du script Google Maps.");
                reject(new Error("Impossible de charger Google Maps API."));
            };
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
        
        // *** CORRECTION ICI ***
        // Utilise le service "AutocompleteService" (sans "Place")
        this.autocompleteService = new window.google.maps.places.AutocompleteService();
        
        // Crée un jeton de session pour l'autocomplétion (meilleure facturation)
        this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();
        
        console.log("Service d'autocomplétion Google initialisé.");
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
            if (!this.autocompleteService) return [];
        }

        return new Promise((resolve, reject) => {
            this.autocompleteService.getPlacePredictions({
                input: inputString,
                sessionToken: this.sessionToken, // *** Ajout du jeton de session ***
                componentRestrictions: { country: 'fr' },
                // Biais vers la zone de la Dordogne
                bounds: this.dordogneBounds, 
                strictBounds: false, // Ne pas limiter *strictement* à la Dordogne, juste préférer
            }, (predictions, status) => {
                if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
                    console.warn("Échec de l'autocomplétion Places:", status);
                    resolve([]); // Renvoyer une liste vide en cas d'échec
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
            travelMode: "TRANSIT", // Mode transport en commun
            
            // --- Vos spécifications ---
            transitPreferences: {
                allowedTravelModes: ["BUS", "WALK"], // Autorise BUS et MARCHE
                // 'TRAIN' est exclu par défaut car non listé
            },
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    // Champ important pour ne renvoyer que les champs nécessaires
                    'X-Goog-FieldMask': 'routes.legs,routes.duration,routes.distanceMeters,routes.polyline,routes.steps' 
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Erreur de l'API Routes:", errorData);
                throw new Error(`API Routes a échoué: ${errorData.error.message}`);
            }

            const data = await response.json();
            
            console.log("Réponse de l'API Routes:", data);
            
            // Réinitialise le jeton de session après une recherche réussie
            this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();

            return data; 

        } catch (error) {
            console.error("Erreur lors de l'appel à fetchItinerary:", error);
            throw error; // Propage l'erreur pour que l'UI puisse la gérer
        }
    }
}
