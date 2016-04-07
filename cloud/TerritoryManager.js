/**
 * Calculates the placeable armies for a player
 * @returns {number}
 *
Parse.Cloud.calculatePlayerPlacementBonus = function() {
    var numberOfTerritoriesForPlayer = 0;
    var continentBonus = 0;
    var hasAllTerritories = true;
    for(continentKey in continentTerritories) {
        if(continentTerritories.hasOwnProperty(continentKey)) {
            var continent = continentTerritories[continentKey];
            for(var i = 0; i<continent.length; i++) {
                var territory = continent[i];
                if(getTerritoryOwner(territory) === playersTurn) {
                    numberOfTerritoriesForPlayer++;
                } else {
                    hasAllTerritories = false;
                }
            }
        }
        if(hasAllTerritories) {
            continentBonus+= continentBonusMap[continent];
        }
        hasAllTerritories = true;
    }
    var bonusAmount = Math.floor(numberOfTerritoriesForPlayer/3);
    if(bonusAmount < 3) {
        bonusAmount = 3;
    }

    console.error("continent bonus = " + continentBonus + ", bonus = " + bonusAmount + ", number o fterritories owned by player = " + numberOfTerritoriesForPlayer);
    return bonusAmount + continentBonus;
};*/

