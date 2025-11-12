/**
 * tripScheduler.js
 * * * CORRIGÉ (V12 - Logique "Mouvement Continu")
 * * Basé sur la clarification: le bus ne s'arrête jamais.
 * * L'état "MOVING" est calculé du DÉPART (Arrêt A) jusqu'au
 * * DÉPART (Arrêt B).
 * * Le temps d'attente est absorbé dans la progression,
 * * le bus ralentit en approchant de l'arrêt.
 * *
 * * Cela élimine l'état "WAITING_AT_STOP" (sauf au terminus)
 * * et résout définitivement le problème de clignotement.
 */

export class TripScheduler {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    /**
     * Récupère tous les trips "en service" (en mouvement OU en attente au terminus)
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
                    // L'état est soit 'moving' (V12), soit 'waiting' (Terminus)
                    segment: state.type === 'moving' ? state : null, 
                    position: state.type === 'waiting_at_stop' ? state.position : null,
                    currentSeconds
                });
            }
        });

        return activeBuses;
    }


    /**
     * CORRIGÉ (Logique V12): "Mouvement Continu"
     */
    findCurrentState(stopTimes, currentSeconds) {
        if (!stopTimes || stopTimes.length < 2) {
            return null;
        }

        const firstStop = stopTimes[0];
        const firstArrivalTime = this.dataManager.timeToSeconds(firstStop.arrival_time);
        const firstDepartureTime = this.dataManager.timeToSeconds(firstStop.departure_time);

        // Cas 1: En attente au premier arrêt (terminus de départ)
        // Cet état est nécessaire pour que le bus apparaisse avant
        // le début de son premier trajet.
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
        
        // Cas 2: En mouvement (Logique V12)
        for (let i = 1; i < stopTimes.length; i++) {
            const currentStop = stopTimes[i];
            const prevStop = stopTimes[i - 1];

            // *** NOUVELLE LOGIQUE V12 ***
            // Le segment de mouvement dure du DÉPART de A jusqu'au DÉPART de B.
            
            const prevDepartureTime = this.dataManager.timeToSeconds(prevStop.departure_time);
            const currentDepartureTime = this.dataManager.timeToSeconds(currentStop.departure_time);
            
            // Si l'heure est EXACTEMENT l'heure de départ, il passe au segment suivant.
            if (currentSeconds >= prevDepartureTime && currentSeconds < currentDepartureTime) {
                
                const prevStopInfo = this.dataManager.getStop(prevStop.stop_id);
                const currentStopInfo = this.dataManager.getStop(currentStop.stop_id);
                if (!prevStopInfo || !currentStopInfo) return null;

                return {
                    type: 'moving',
                    fromStopInfo: prevStopInfo,
                    toStopInfo: currentStopInfo,
                    departureTime: prevDepartureTime,      // Heure de début (Départ A)
                    arrivalTime: currentDepartureTime,      // Heure de fin (Départ B)
                    progress: this.calculateProgress(prevDepartureTime, currentDepartureTime, currentSeconds)
                };
            }
            
            // Cas V7 (Priorité 2: Attente) a été supprimé.
        }
        
        // Gérer le dernier segment (Arrivée au terminus final)
        const lastStop = stopTimes[stopTimes.length - 1];
        const prevStop = stopTimes[stopTimes.length - 2];
        const prevDepartureTime = this.dataManager.timeToSeconds(prevStop.departure_time);
        const lastArrivalTime = this.dataManager.timeToSeconds(lastStop.arrival_time);

        if (currentSeconds >= prevDepartureTime && currentSeconds <= lastArrivalTime) {
             const prevStopInfo = this.dataManager.getStop(prevStop.stop_id);
             const lastStopInfo = this.dataManager.getStop(lastStop.stop_id);
             if (!prevStopInfo || !lastStopInfo) return null;
             
             return {
                 type: 'moving',
                 fromStopInfo: prevStopInfo,
                 toStopInfo: lastStopInfo,
                 departureTime: prevDepartureTime,
                 arrivalTime: lastArrivalTime,
                 progress: this.calculateProgress(prevDepartureTime, lastArrivalTime, currentSeconds)
             };
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

        // "arrivalTime" (dans V12) est l'heure de départ de l'arrêt suivant
        // Ce calcul reste donc correct pour l'ETA
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
