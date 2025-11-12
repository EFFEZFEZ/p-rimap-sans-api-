/**
 * tripScheduler.js
 * * * CORRIGÉ (V7 - Finale): Logique "gap-less" ET "flicker-less".
 * * L'état "MOVING" est maintenu à la seconde exacte de l'arrivée pour
 * * empêcher le popup de clignoter. L'état "WAITING" commence
 * * une seconde APRÈS l'arrivée.
 */

export class TripScheduler {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Récupère tous les trips "en service" (en mouvement OU en attente à un arrêt)
     */
    getActiveTrips(currentSeconds, date) {
        if (!this.dataManager.isLoaded) {
            return [];
        }

        const activeTrips = this.dataManager.getActiveTrips(currentSeconds, date);
        const activeBuses = [];

        activeTrips.forEach(({ tripId, trip, stopTimes, route }) => {
            const state = this.findCurrentState(stopTimes, currentSeconds); 
            
            if (state) {
                activeBuses.push({
                    tripId,
                    trip,
                    route,
                    segment: state.type === 'moving' ? state : null, 
                    position: state.type === 'waiting_at_stop' ? state.position : null,
                    currentSeconds
                });
            }
        });

        return activeBuses;
    }


    /**
     * CORRIGÉ (Logique V7): "Gap-less" (anti-disparition) et "Flicker-less"
     */
    findCurrentState(stopTimes, currentSeconds) {
        if (!stopTimes || stopTimes.length === 0) {
            return null;
        }

        const firstStop = stopTimes[0];
        const firstArrivalTime = this.dataManager.timeToSeconds(firstStop.arrival_time);
        const firstDepartureTime = this.dataManager.timeToSeconds(firstStop.departure_time);

        // Cas 1: En attente au premier arrêt (terminus de départ)
        // Le bus ATTEND de [arrivée] jusqu'à [départ - 1 seconde]
        // Si l'heure est EXACTEMENT l'heure de départ, il passe en "MOVING" (Cas 2)
        if (currentSeconds >= firstArrivalTime && currentSeconds < firstDepartureTime) {
            const stopInfo = this.dataManager.getStop(firstStop.stop_id);
            if (!stopInfo) return null;
            
            return {
                type: 'waiting_at_stop',
                position: { lat: parseFloat(stopInfo.stop_lat), lon: parseFloat(stopInfo.stop_lon) },
                stopInfo: stopInfo,
                nextDepartureTime: firstDepartureTime
            };
        }
        
        // Cas 2: En mouvement ou en attente à un arrêt intermédiaire
        for (let i = 1; i < stopTimes.length; i++) {
            const currentStop = stopTimes[i];
            const prevStop = stopTimes[i - 1];

            const arrivalTime = this.dataManager.timeToSeconds(currentStop.arrival_time);
            const departureTime = this.dataManager.timeToSeconds(currentStop.departure_time);
            const prevDepartureTime = this.dataManager.timeToSeconds(prevStop.departure_time);

            // *** NOUVELLE LOGIQUE V7 ***
            // La logique est inversée pour donner la priorité à "MOVING"

            // Priorité 1: Vérifier le mouvement (du départ jusqu'à l'arrivée INCLUSE)
            // ex: Repart 10:00:00, arrive 10:02:00.
            //     Est "en mouvement" de 10:00:00 à 10:02:00 (inclus).
            //     Cela empêche le clignotement à l'arrivée.
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

            // Priorité 2: Vérifier l'attente (COMMENCE 1s APRÈS l'arrivée)
            // ex: Arrive 10:02:00, repart 10:03:00.
            //     Est "en attente" de 10:02:01 à 10:03:00.
            if (currentSeconds > arrivalTime && currentSeconds <= departureTime) {
                const stopInfo = this.dataManager.getStop(currentStop.stop_id);
                if (!stopInfo) return null;
                
                return {
                    type: 'waiting_at_stop',
                    position: { lat: parseFloat(stopInfo.stop_lat), lon: parseFloat(stopInfo.stop_lon) },
                    stopInfo: stopInfo,
                    nextDepartureTime: departureTime
                };
            }
        }
        
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
