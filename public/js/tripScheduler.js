/**
 * tripScheduler.js
 * * * CORRIGÉ (V8 - Suppression des bus à l'arrêt)
 * * Ne retourne que les bus en mouvement (état "moving").
 * * Les bus à l'arrêt (terminus ou intermédiaire) ne sont plus gérés
 * * et ne sont pas retournés, ce qui les fait disparaître de la carte
 * * pour éliminer le clignotement des popups.
 */

export class TripScheduler {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Récupère tous les trips "en service" (en mouvement UNIQUEMENT)
     */
    getActiveTrips(currentSeconds, date) {
        if (!this.dataManager.isLoaded) {
            return [];
        }

        const activeTrips = this.dataManager.getActiveTrips(currentSeconds, date);
        const activeBuses = [];

        activeTrips.forEach(({ tripId, trip, stopTimes, route }) => {
            // findCurrentState ne retourne plus que 'moving' ou 'null'
            const state = this.findCurrentState(stopTimes, currentSeconds); 
            
            if (state) { // N'est vrai que si state.type === 'moving'
                activeBuses.push({
                    tripId,
                    trip,
                    route,
                    segment: state, // 'state' EST le segment 'moving'
                    position: null, // La position stationnaire n'existe plus
                    currentSeconds
                });
            }
        });

        return activeBuses;
    }


    /**
     * CORRIGÉ (Logique V8): Ne retourne QUE l'état "moving".
     * Si le bus n'est pas en mouvement, retourne null.
     */
    findCurrentState(stopTimes, currentSeconds) {
        if (!stopTimes || stopTimes.length < 2) {
            // A besoin d'au moins 2 arrêts (départ/arrivée) pour un segment de mouvement
            return null;
        }

        // Cas 1 (Attente au premier arrêt) a été supprimé.
        // Le bus n'apparaîtra pas avant son heure de départ du premier arrêt.

        // Cas 2: En mouvement
        for (let i = 1; i < stopTimes.length; i++) {
            const currentStop = stopTimes[i];
            const prevStop = stopTimes[i - 1];

            const arrivalTime = this.dataManager.timeToSeconds(currentStop.arrival_time);
            const prevDepartureTime = this.dataManager.timeToSeconds(prevStop.departure_time);

            // Vérifier le mouvement (du départ jusqu'à l'arrivée INCLUSE)
            // ex: Repart 10:00:00, arrive 10:02:00.
            //     Est "en mouvement" de 10:00:00 à 10:02:00 (inclus).
            //
            // À 10:02:01 (s'il attend) ou 10:00:01 (avant le départ), 
            // cette condition est fausse et la fonction retourne null.
            
            if (currentSeconds >= prevDepartureTime && currentSeconds <= arrivalTime) {
                const prevStopInfo = this.dataManager.getStop(prevStop.stop_id);
                const currentStopInfo = this.dataManager.getStop(currentStop.stop_id);
                if (!prevStopInfo || !currentStopInfo) return null;

                return {
                    type: 'moving',
                    fromStopInfo: prevStopInfo,
                    toStopInfo: currentStopInfo,
                    departureTime: prevDepartureTime,
                    arrivalTime: arrivalTime,
                    progress: this.calculateProgress(prevDepartureTime, arrivalTime, currentSeconds)
                };
            }

            // Cas d'attente à l'arrêt (Priorité 2) a été supprimé.
        }
        
        // Si aucune condition de "mouvement" n'est remplie, le bus est à l'arrêt
        return null; 
    }

    /**
     * Calcule la progression entre deux arrêts (0 à 1)
     */
    calculateProgress(departureTime, arrivalTime, currentTime) {
        const totalDuration = arrivalTime - departureTime;
        if (totalDuration <= 0) return 0; // Évite la division par zéro

        const elapsed = currentTime - departureTime;
        return Math.max(0, Math.min(1, elapsed / totalDuration));
    }

    /**
     * Estime le temps d'arrivée au prochain arrêt
     */
    getNextStopETA(segment, currentSeconds) {
        if (!segment) return null;

        const remainingSeconds = segment.arrivalTime - currentSeconds;
        const minutes = Math.max(0, Math.floor(remainingSeconds / 60));
        const seconds = Math.max(0, Math.floor(remainingSeconds % 60));

        return {
            seconds: remainingSeconds,
            formatted: `${minutes}m ${seconds}s`
        };
    }

    /**
     * Récupère la destination finale d'un trip
     */
    getTripDestination(stopTimes) {
        if (!stopTimes || stopTimes.length === 0) {
            return 'Destination inconnue';
        }

        const lastStop = stopTimes[stopTimes.length - 1];
        const stopInfo = this.dataManager.getStop(lastStop.stop_id);
        
        return stopInfo ? stopInfo.stop_name : lastStop.stop_id;
    }
}
