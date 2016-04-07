/**
 *  __  __                  _____             _
 * |  \/  | __ _ _ __ ___  | ____|_ __   __ _(_)_ __   ___
 * | |\/| |/ _` | '__/ __| |  _| | '_ \ / _` | | '_ \ / _ \
 * | |  | | (_| | |  \__ \ | |___| | | | (_| | | | | |  __/
 * |_|  |_|\__,_|_|  |___/ |_____|_| |_|\__, |_|_| |_|\___|
 *                                      |___/
 *
 * Ben Turner, Junto Games. Copyright 2015
 */
/// <reference path="../parse/parse.d.ts" />

var UtilFunctions = require('./UtilFunctions.js');

/**
 * This function submits a turn from a user
 */
Parse.Cloud.define("submitTurn", function(request, response) {
    Parse.Cloud.useMasterKey();
    var params = request.params;
    var mapStateId = params.mapStateId;
    var mapState = Parse.Object.extend("MapState");
    var query = new Parse.Query(mapState);
    var playerActions = JSON.parse(params.actionQueue);

    query.get(mapStateId, {
        success: function(mapState) {
            var mapName = mapState.get("mapName");
            var mapFriendlyName = mapState.get("mapFriendlyName");
            UtilFunctions.getMapTemplate(mapName, function(mapTemplate) {
                
                var requestUserId = request.user.id;
                
                var players = mapState.get("players");
                for (var index = 0; index < players.length; index++) {
                    var player = players[index];
                    if(player.objectId == requestUserId) {
                        player.userShips = params.userShips;
                    }
                }
                
                var immutablePlayers = mapState.get("immutablePlayers");
                for (var index = 0; index < immutablePlayers.length; index++) {
                    var immutablePlayerShip = immutablePlayers[index];
                    if(immutablePlayerShip.objectId == requestUserId) {
                        immutablePlayerShip.userShips = params.userShips;
                    }
                }
                
                var friendData = request.user.get("friendData");
                var errorMessages = "";
                var awardCard = false;
               
                var seed = mapState.get("actionId");
                var territoryArmyMap = mapState.get("territoryArmyMap");
                var territoryToOwnerMap = mapState.get("territoryToOwnerMap");
                var playersTurn = mapState.get("playersTurn");
                var immutablePlayersTurn = 0;
                for (var immutablePlayerIndex = 0; immutablePlayerIndex < immutablePlayers.length; immutablePlayerIndex++) {
                    if(immutablePlayers[immutablePlayerIndex].objectId == players[playersTurn].objectId) {
                        immutablePlayersTurn = immutablePlayerIndex;
                        break;
                    }
                }
                var userIds = mapState.get("userIds");
                var round = mapState.get("round");
                var usedPowerCards = mapState.get("usedPowerCards");
                var ignoredPlayers = mapState.get("ignoredPlayers");
                // var reinforcementCards = mapState.get("reinforcementCards");

                var territoryNeighbors = mapTemplate.get("territoryNeighbors");
                var orbitConnections = mapTemplate.get("orbitConnections");
                var continentTerritories = mapTemplate.get("continentTerritories");
                var continentBonusMap = mapTemplate.get("continentBonus");
                var playerDefeatRequest = false;
                var nextPlayerDefeated = false;


                for (var continentKey in continentTerritories) {
                    if (continentTerritories.hasOwnProperty(continentKey)) {
                        var continent = continentTerritories[continentKey];
                        for (var i = 0; i < continent.length; i++) {
                            var territory = continent[i];
                            if (orbitConnections != null) {
                                for (var orbitKey in orbitConnections) {
                                    if (orbitConnections.hasOwnProperty(orbitKey)) {
                                        var orbitStep = round % orbitConnections[orbitKey].length;
                                        if (territory == orbitKey) {
                                            var newConnection = orbitConnections[orbitKey][orbitStep];
                                            territoryNeighbors[territory].push(newConnection);
                                            territoryNeighbors[newConnection].push(territory);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                /**
                 * Adds reinforcement card for specified user
                 */
                var addReinforcementCard = function(userId, cardType) {
                    for (var index = 0; index < players.length; index++) {
                        var player = players[index];
                        if(player.objectId == userId) {
                            player.cards.push(cardType);
                        }
                    }
                }
                
                /**
                 * Adds reinforcement card for specified user
                 */
                var removeReinforcementCard = function(userId, cardType) {
                    for (var index = 0; index < players.length; index++) {
                        var player = players[index];
                        if(player.objectId == userId) {
                            for (var cardIndex = 0; cardIndex < player.cards.length; cardIndex++) {
                                var card = player.cards[cardIndex];
                                if(card == cardType) {
                                    player.cards.splice(cardIndex, 1);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                 /**
                 * Sets reinforcement cards for specified user
                 */
                var setReinforcementCards = function(userId, cards) {
                    for (var index = 0; index < players.length; index++) {
                        var player = players[index];
                        if(player.objectId == userId) {
                            player.cards = cards;
                        }
                    }
                }
                
                 /**
                 * Gets reinforcement cards for specified user
                 */
                var getReinforcementCards = function(userId) {
                    for (var index = 0; index < players.length; index++) {
                        var player = players[index];
                        if(player.objectId == userId) {
                            return player.cards;
                        }
                    }
                }

                /**
                 * Adds error message with a new line
                 */
                var addErrorMessage = function(errorMessage) {
                    errorMessages += errorMessage + "\n";
                };
                
                /**
                 * Returns the next random value based on seed value, e.g. min 1, max 7, will return value from 1-6
                 * @param min   int  Min number to return
                 * @param max   int  Max, exclusive.
                 * @returns {number}
                 */
                var nextRandom = function(min, max) {
                    seed = (seed * 9301 + 49297) % 233280;
                    var rnd = seed / 233280;

                    var resultNumber = Math.floor(min + rnd * (max - min));
                    return resultNumber;
                };

                /**
                 * Adds armies to the specified territory
                 * @param territoryName     string  Name of the territory
                 * @param numberOfArmies    int     Amount of armies to add
                 */
                var addArmiesToTerritory = function(territoryName, numberOfArmies) {
                    territoryArmyMap[territoryName] = territoryArmyMap[territoryName] + numberOfArmies;
                };

                /**
                 * Get Territory neighbors for specified territory
                 * @param territoryName string  territory name
                 * @returns Array
                 */
                var getTerritoryNeighbors = function(territoryName) {
                    return territoryNeighbors.get(territoryName);
                };

                /**
                 * Get territory owner index from territory
                 * @param territoryName string  territory name
                 * @returns int
                 */
                var getTerritoryOwner = function(territoryName) {
                    return territoryToOwnerMap[territoryName];
                };

                /**
                 * Moves armies from one territory to another
                 */
                var moveArmiesFromTerritoryToTerritory = function(sourceTerritory, destinationTerritory, amount) {
                    territoryArmyMap[destinationTerritory] += amount;
                    addArmiesToTerritory(sourceTerritory, -amount);
                }

                var numberOfTerritoriesOwnedByPlayer = function(playerIndex) {
                    var numberOfTerritoriesForPlayer = 0;
                    for (var continentKey in continentTerritories) {
                        if (continentTerritories.hasOwnProperty(continentKey)) {
                            var continent = continentTerritories[continentKey];
                            for (var i = 0; i < continent.length; i++) {
                                var territory = continent[i];
                                if (getTerritoryOwner(territory) === playerIndex) {
                                    numberOfTerritoriesForPlayer++;
                                }
                            }
                        }
                    }
                    return numberOfTerritoriesForPlayer;
                }

                var checkForDefeat = function(playerIndex) {
                    if (numberOfTerritoriesOwnedByPlayer(playerIndex) < 1) {
                       var defeatedPlayerId = userIds[playerIndex];
                       var defeatedPlayerCards = getReinforcementCards(defeatedPlayerId);
                        if (defeatedPlayerCards != null) {
                            for (var index = 0; index < defeatedPlayerCards.length; index++) {
                                var card = defeatedPlayerCards[index];
                                addReinforcementCard(requestUserId,card);
                            }
                            nextPlayerDefeated = true;
                            var userQuery = new Parse.Query("_User");
                            userQuery.get(defeatedPlayerId, {
                                success: function(user) {
                                    user.increment("losses");
                                    user.remove("currentGames", mapStateId);
                                    user.save(null, {
                                         success: function() {
                                         },
                                         error: function(error) {
                                            response.error("Error saving user losses " + error.message);
                                         },
                                         useMasterKey : true
                                    });
                                },
                                error: function(object, error) {
                                    response.error("Error getting user on defeat " + error.message);
                                },
                                useMasterKey : true
                            });
                        }
                    }

                   
                }

                /**
                 * Calculates the placeable armies for a player
                 * @returns {number}
                 */
                var calculatePlayerPlacementBonus = function() {
                    var numberOfTerritoriesForPlayer = 0;
                    var continentBonus = 0;
                    var hasAllTerritories = true;
                    for (continentKey in continentTerritories) {
                        if (continentTerritories.hasOwnProperty(continentKey)) {
                            var continent = continentTerritories[continentKey];
                            for (var i = 0; i < continent.length; i++) {
                                var territory = continent[i];
                                if (getTerritoryOwner(territory) === immutablePlayersTurn) {
                                    numberOfTerritoriesForPlayer++;
                                } else {
                                    hasAllTerritories = false;
                                }
                            }
                        }
                        if (hasAllTerritories) {
                            continentBonus += continentBonusMap[continentKey];
                        }
                        hasAllTerritories = true;
                    }
                    var bonusAmount = Math.floor(numberOfTerritoriesForPlayer / 3);
                    if (bonusAmount < 3) {
                        bonusAmount = 3;
                    }
                    return bonusAmount + continentBonus;
                };

                var territoryBattle = function(attackingTerritory, defendingTerritory, numberOfAttackingTerritories) {
                    var winner = defendingTerritory;
                    var defendingPlayer = getTerritoryOwner(defendingTerritory);
                    var attackingArmiesRemaining = numberOfAttackingTerritories;
                    if (territoryArmyMap[attackingTerritory] > 1) {
                        if (territoryArmyMap[defendingTerritory] >= 1) {
                            var attackingRolls = [];
                            var defendingRolls = [];
                            while (territoryArmyMap[defendingTerritory] > 0) {
                                var numberOfAttackingSkirmish = 0;
                                var numberOfDefendingSkirmish = 0;

                                if (attackingArmiesRemaining > 3) {
                                    numberOfAttackingSkirmish = 3;
                                } else {
                                    numberOfAttackingSkirmish = attackingArmiesRemaining;
                                }
                                if (territoryArmyMap[defendingTerritory] > 2) {
                                    numberOfDefendingSkirmish = 2;
                                } else {
                                    numberOfDefendingSkirmish = territoryArmyMap[defendingTerritory];
                                }

                                attackingRolls = new Array();
                                for (var i = 0; i < numberOfAttackingSkirmish; i++) {
                                    attackingRolls.push(nextRandom(1, 7));
                                }
                                attackingRolls.sort(function(a, b) {
                                    return b - a
                                });

                                defendingRolls = [];
                                for (var i = 0; i < numberOfDefendingSkirmish; i++) {
                                    defendingRolls.push(nextRandom(1, 7));
                                }
                                defendingRolls.sort(function(a, b) {
                                    return b - a
                                });
                                for (var j = 0; j < Math.min(attackingRolls.length, defendingRolls.length); j++) {
                                    var attackRoll = attackingRolls[j];
                                    var defendRoll = defendingRolls[j];
                                    if (attackRoll > defendRoll) {
                                        addArmiesToTerritory(defendingTerritory, -1);
                                    } else {
                                        addArmiesToTerritory(attackingTerritory, -1);
                                        attackingArmiesRemaining--;
                                    }
                                }
                                if (territoryArmyMap[attackingTerritory] <= 1) {
                                    winner = defendingTerritory;
                                    break;
                                }
                                if (territoryArmyMap[defendingTerritory] < 1) {
                                    winner = attackingTerritory;
                                    territoryToOwnerMap[defendingTerritory] = getTerritoryOwner(attackingTerritory);
                                    territoryArmyMap[defendingTerritory] = 0;
                                    moveArmiesFromTerritoryToTerritory(attackingTerritory, defendingTerritory, attackingArmiesRemaining);
                                    break;
                                }
                                if (attackingArmiesRemaining < 1) {
                                    break;
                                }
                            }
                        } else {
                            winner = attackingTerritory;
                            territoryToOwnerMap[defendingTerritory] = getTerritoryOwner(attackingTerritory);
                        }
                    }
                    if (winner == attackingTerritory) {
                        awardCard = true;
                    }
                    checkForDefeat(defendingPlayer);
                    return winner;
                }

                /**
                 * Validates action sent by player to ensure that it is clean
                 * @param action    PlayerAction
                 * Player action = {
                 *      actionType = "placement","attack","reinforce"
                 *      quantity = number of armies moved by action
                 *      originTerritory = the source territory of the action, empty on placement
                 *      destination = the destination territory of the armies
                 *      }
                 */
                var isValidAction = function(action) {
                    var result = false;
                    if (UtilFunctions.isNumber(action.quantity) && action.quantity >= 0) {
                        if (territoryArmyMap[action.originTerritory] || action.actionType == "placement") {
                            if (territoryArmyMap[action.destination]) {
                                if (getTerritoryOwner(action.originTerritory) == immutablePlayersTurn || action.actionType == "placement") {
                                    if (action.quantity < territoryArmyMap[action.originTerritory] || action.actionType == "placement") {
                                        result = true;
                                    } else {
                                        addErrorMessage("Error: action with more armies than player owns: " + action.originTerritory + ": " + territoryArmyMap[action.originTerritory] + ", playerAction quantity: " + action.quantity);
                                    }
                                } else {
                                    addErrorMessage("Error: Invalid turn ");
                                    // addErrorMessage("Error: trying to act from non owned territory: " + action.originTerritory + ", owned by: " + getTerritoryOwner(action.originTerritory) + ", current player = " + playersTurn);
                                }
                            } else {
                                addErrorMessage("Error: invalid destination territory");
                            }
                        } else {
                            addErrorMessage("Error: invalid source territory");
                        }
                    } else {
                        addErrorMessage("Error: trying to place illegitimate armies");
                    }
                    return result;
                };

                var placeableArmies = calculatePlayerPlacementBonus();

                for (var n = 0; n < playerActions.length; n++) {
                    if (playerActions[n].actionType == "undo_card") {
                        playerActions.splice(0, n+1);
                        break;
                    }
                }
                for (var i = 0; i < playerActions.length; i++) {
                    var playerAction = playerActions[i];

                    switch (playerAction.actionType) {
                        case "placement":
                            if (isValidAction(playerAction)) {
                                if (placeableArmies > 0) {
                                    if (getTerritoryOwner(playerAction.destination) == immutablePlayersTurn) {
                                        addArmiesToTerritory(playerAction.destination, playerAction.quantity);
                                        placeableArmies -= playerAction.quantity;
                                    } else {
                                        addErrorMessage("Error: trying to place armies on non owned territory:  getTerritory = " + getTerritoryOwner(playerAction.destination) + ", playerindex = " + immutablePlayersTurn);
                                    }
                                } else {
                                    addErrorMessage("Error: trying to place more than placeable armies");
                                }
                            } else {
                                addErrorMessage("Error: Invalid action: " + JSON.stringify(playerAction));
                            }
                            break;
                        case "attack":
                            if (isValidAction(playerAction)) {
                                if (getTerritoryOwner(playerAction.destination) != immutablePlayersTurn) {
                                    var neighbors = territoryNeighbors[playerAction.destination];
                                    if (UtilFunctions.arrayContainsValue(neighbors, playerAction.originTerritory)) {
                                        var winner = territoryBattle(playerAction.originTerritory, playerAction.destination, playerAction.quantity);
                                    } else {
                                        addErrorMessage("Error: non connected territories");
                                    }
                                } else {
                                    addErrorMessage("Error: unable to attack own territory")
                                }
                            } else {
                                addErrorMessage("Error: Invalid action: " + JSON.stringify(playerAction));
                            }
                            break;
                        case "reinforce":
                            if (isValidAction(playerAction)) {
                                moveArmiesFromTerritoryToTerritory(playerAction.originTerritory, playerAction.destination, playerAction.quantity);
                            } else {
                                addErrorMessage("Error: Invalid action: " + JSON.stringify(playerAction));
                            }
                            break;
                        case "tradeCards":
                            var tradeValue = 0;
                            var numberOfInfantry = 0;
                            var numberOfCavalry = 0;
                            var numberOfArtillery = 0;
                            for (var card in playerAction.cards) {
                                if (card == 0) {
                                    numberOfInfantry++;
                                } else if (card == 1) {
                                    numberOfCavalry++;
                                } else if (card == 2) {
                                    numberOfArtillery++;
                                }
                                if (numberOfInfantry > 0 && numberOfCavalry > 0 && numberOfArtillery > 0) {
                                    tradeValue = 10;
                                } else if (numberOfInfantry > 2) {
                                    tradeValue = 8;
                                } else if (numberOfCavalry > 2) {
                                    tradeValue = 6;
                                } else if (numberOfArtillery > 2) {
                                    tradeValue = 4;
                                }
                            }
                            var hasCardSet = true;
                            for (var k = 0; k < playerAction.cards.length; k++) {
                                if (UtilFunctions.arrayContainsValue(getReinforcementCards(requestUserId), playerAction.cards[k])) {
                                    removeReinforcementCard(requestUserId, playerAction.cards[k]);
                                    // for (var j = 0; j < reinforcementCards[requestUserId].length; j++) {
                                    //     if (reinforcementCards[requestUserId][j] == playerAction.cards[k]) {
                                    //         reinforcementCards[requestUserId].splice(j, 1);
                                    //         break;
                                    //     }
                                    // }
                                } else {
                                    hasCardSet = false;
                                    addErrorMessage("Error: Insuficient cards for set. " + requestUserId + " tried to trade in " + playerAction.cards[k] + " and cards = " + JSON.stringify(reinforcementCards) + " user = " + requestUserId + " i " + i);
                                }
                            }
                            if (hasCardSet) {
                                placeableArmies += tradeValue;
                            }
                            break;

                        case "undo_card":
                            break;
                        case "nuke_card":
                            territoryArmyMap[playerAction.destination] = 1;
                            territoryToOwnerMap[playerAction.destination] = -1;
                            var usedCard = {
                                player: playersTurn,
                                cardType: "nuke_card"
                            }
                            usedPowerCards.push(usedCard);
                            break;
                        case "reinforce_card":
                            moveArmiesFromTerritoryToTerritory(playerAction.originTerritory, playerAction.destination, playerAction.quantity);
                            var usedReinforceCard = {
                                player: playersTurn,
                                cardType: "reinforce_card"
                            }
                            usedPowerCards.push(usedReinforceCard);
                            break;

                        case "playerDefeat":
                            if (players.length > 1) {
                                UtilFunctions.removePlayerFromMapstate(playersTurn, mapState, "losses");
                                playersTurn = mapState.get("playersTurn");
                                playerDefeatRequest = true;
                                if (playersTurn >= players.length) {
                                    playersTurn = 0;
                                    round++;
                                }
                            }
                            if (players.length <= 1) {
                                mapState.set("currentGameMode", "postGame");
                                UtilFunctions.removePlayerFromMapstate(playersTurn, mapState, "wins");
                                playersTurn = mapState.get("playersTurn");
                                playerDefeatRequest = true;
                                if (playersTurn >= players.length) {
                                    playersTurn = 0;
                                    round++;
                                }
                            }
                            break;
                        case "message":
                            break;
                        case "ignorePlayer":
                            if(ignoredPlayers) {
                                for (var player in ignoredPlayers) {
                                    if (ignoredPlayers.hasOwnProperty(player) && player == requestUserId) {
                                        ignoredPlayers[player].push(playerAction.originTerritory);
                                        break;
                                    }
                                }
                            } else {
                                ignoredPlayers = {};
                                var playerList = [];
                                playerList.push(playerAction.originTerritory);
                                ignoredPlayers[requestUserId] = playerList;
                                mapState.set("ignoredPlayers", ignoredPlayers);
                            }
                            break;
                        case "unIgnorePlayer":
                            if(ignoredPlayers) {
                                for (var player in ignoredPlayers) {
                                    if (ignoredPlayers.hasOwnProperty(player) && player == requestUserId && ignoredPlayers[player].length > 0) {
                                        var indexToRemove = -1;
                                        for (var index = 0; index < ignoredPlayers[player].length; index++) {
                                            var ignoredPlayer = ignoredPlayers[player][index];
                                            if(ignoredPlayer == playerAction.originTerritory) {
                                                indexToRemove = index;
                                            }
                                        }
                                        if(indexToRemove >=0) {
                                            ignoredPlayers[player].splice(indexToRemove,1);
                                            break;
                                        }
                                    }
                                }
                            }
                            break;
                        default:
                            addErrorMessage("Error: Invalid actionType: " + playerAction.actionType);

                    }
                }

                if (awardCard) {
                    addReinforcementCard(requestUserId, nextRandom(0,3));
                }
                // mapState.set("reinforcementCards", reinforcementCards);
                // mapState.set("territoryArmyMap", territoryArmyMap);
                // mapState.set("territoryToOwnerMap", territoryToOwnerMap);
                mapState.set("actionId", Math.floor(Math.random() * 100000000));
                if(players[playersTurn] && !playerDefeatRequest) {
                    players[playersTurn].wins = request.user.get("wins");
                    players[playersTurn].losses = request.user.get("losses");
                    players[playersTurn].forfeits = request.user.get("forfeits");
                    players[playersTurn].name = request.user.getUsername();
                    mapState.set("players", players);
                }
                for (var immutablePlayerIndex = 0; immutablePlayerIndex < immutablePlayers.length; immutablePlayerIndex++) {
                    var immutablePlayer = immutablePlayers[immutablePlayerIndex];
                    if(immutablePlayer.objectId == requestUserId) {
                        immutablePlayer.name = request.user.getUsername();
                        mapState.set("immutablePlayers", immutablePlayers);
                    }
                }
                var currentActions = {};
                currentActions[playersTurn] = playerActions;
                var previousActions = mapState.get("previousActions");
                if (previousActions == null) {
                    previousActions = [];
                }
                if (!playerDefeatRequest) {
                    previousActions.push(currentActions);
                    playersTurn++;
                    if (playersTurn >= players.length) {
                        playersTurn = 0;
                        round++;
                    }
                }
                for (var i = 0; i < previousActions.length; i++) {
                    if (previousActions[i][playersTurn] != null) {
                        previousActions.splice(i, 1);
                    }
                }

                // mapState.set("usedPowerCards", usedPowerCards);
                var currentDate = new Date();
                var expireDuration = mapState.get("expireDuration");
                mapState.set("expireTime", currentDate.getTime() + expireDuration);
                mapState.set("playersTurn", playersTurn);
                mapState.set("previousActions", previousActions);
                mapState.set("round", round);
                mapState.dirty = function() {
                    return false;
                };
                //allPlayersReinforcementCards[requestUserId] = reinforcementCards;
                if (errorMessages != "") {
                    // var errorObject = Parse.Object.extend("ParseObject");
                    //errorObject["errorMessages"] = errorMessages;
                    response.error(errorMessages);
                } else {
                    mapState.save(null, {
                            
                        success: function(mapStateResult) {
                            immutablePlayers = mapStateResult.get("immutablePlayers");
                            if(!playerDefeatRequest || players.length > 1) {
                                var installationQuery = new Parse.Query(Parse.Installation);
                                var pushMessage = "Your Turn!";
                                var playerName = immutablePlayers[0].name;
                                var userNameValues = (mapStateResult.get("userNameValues"));
                                if(playersTurn == 0) {
                                    playerName = immutablePlayers[1].name;
                                } else {
                                    if(userNameValues != null && userNameValues[playersTurn]) {
                                        if(mapStateResult.get("creatorFacebookName")) {
                                            playerName = UtilFunctions.myCiphering.decrypt(mapStateResult.get("creatorFacebookName"));
                                        }
                                    }
                                }
                                playerName = UtilFunctions.titleCase(playerName);    
                                if(immutablePlayers.length == 2) {
                                    pushMessage = "Your turn against " + playerName + " on " + mapFriendlyName +".";
                                } else if(immutablePlayers.length == 3){
                                    
                                    pushMessage = "Your turn against " + playerName + " and 1 other player on "+ mapFriendlyName +".";
                                } else {
                                    pushMessage = "Your turn against " + playerName + " and " + (immutablePlayers.count -2) + " other players on "+ mapFriendlyName +".";
                                }
                                
                                if(round == 0 ) {
                                    if(!mapStateResult.get("createdByRandom")) {
                                        if(immutablePlayers.length == 2) {
                                            pushMessage = playerName + " has invited you to a game on " + mapFriendlyName +".";
                                        } else if(immutablePlayers.length == 3){
                                            pushMessage = playerName + " has invited you to a game on " + mapFriendlyName +" against 1 other player.";
                                        } else {
                                            pushMessage = playerName + " has invited you to a game on " + mapFriendlyName +" against " + (immutablePlayers.count -2) + " other players.";
                                        }
                                    }
                                }
                                var successFunction = function() {
                                    response.success(mapStateResult);
                                };
                                var failureFunction = function(error) {
                                    response.error(error.message);
                                };
                                UtilFunctions.sendPush(mapState.get("playersTurn"), pushMessage, mapState, successFunction, failureFunction);
                                // installationQuery.equalTo(("userId"), userIds[playersTurn]);
                                // Parse.Push.send({
                                //     where: installationQuery,
                                //     data: {
                                //         alert: "Your Turn!",
                                //         map: mapStateResult.id,
                                //         sound: "default"
                                //     }
                                // }, {
                                //     success: function() {
                                //         // Push was successful
                                //         response.success(mapStateResult);
                                //     },
                                //     error: function(error) {
                                //         // Handle error
                                //     }
                                // });
                            } else {
                               response.success(); 
                            }
                             
                            // mapState.destroy({
                            //     success: function(myObject) {
                            //         response.success()
                            //     },
                            //     error: function(error) {
                            //         response.error("Error deleting map state " + error);
                            //     }
                            // });
                        },
                        error: function(mapStateResult, error) {
                            response.error("failed to save mapState " + error.message);
                        }, 
                        useMasterKey : true
                    });
                }
            });
        },
        error: function(object, error) {
            response.error("Game expired");
        },
        useMasterKey : true
    });

});



