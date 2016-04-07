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

var UtilFunctions = require('./UtilFunctions.js');

/**
 * This function distributes armies for the number of players
 */
Parse.Cloud.define("requestNewMap", function(request, response) {
    var MapState = Parse.Object.extend("MapState");
    var mapStateResult = new MapState();
    var params = request.params;
    var mapName = params.mapName;
    var numberOfPlayers = params.numberOfPlayers;
    var territoryToOwnerMap = {};
    var territoryArmyMap = {};
    if (mapName) {
        UtilFunctions.getMapTemplate(mapName, function(result) {
            if (result) {
                var territoriesToDistribute = [];
                var continentTerritories = result.get("continentTerritories");
                for (var key in continentTerritories) {
                    var obj = continentTerritories[key];
                    for (var prop in obj) {
                        // important check that this is objects own property
                        // not from prototype prop inherited
                        if (obj.hasOwnProperty(prop)) {
                            territoriesToDistribute.push(obj[prop]);
                        }
                    }
                }
                var playerIndex = numberOfPlayers -1;
                while (territoriesToDistribute.length > 0) {
                    var index = Math.floor(Math.random() * territoriesToDistribute.length);
                    var randomTerritory = territoriesToDistribute[index];
                    territoryToOwnerMap[randomTerritory] = playerIndex;
                    territoryArmyMap[randomTerritory] = 1;
                    territoriesToDistribute.splice(index, 1);
                    playerIndex--;
                    if (playerIndex < 0) {
                        playerIndex = numberOfPlayers -1;
                    }
                }
                var players = [];
                var wins = 0;
                var losses = 0;
                var forfeits = 0;
                for (var index = 0; index < numberOfPlayers; index++) {
                    if(params.wins) {
                        wins = params.wins[index]
                    }
                    if(params.losses) {
                        losses = params.losses[index]
                    }
                    if(params.forfeits) {
                        forfeits = params.forfeits[index]
                    }
                    var player = {name:params.playerNames[index], color:params.playerColors[index], ships:params.factions[index], 
                                  cards:[], objectId:params.userIds[index], wins:wins, losses:losses, forfeits:forfeits};
                    players.push(player);
                }
                var currentDate = new Date();
                var expireDuration = 86400000; // 24 hours
                // var expireDuration = 50000; // 24 hours
                mapStateResult.set("expireDuration", expireDuration);
                mapStateResult.set("expireTime", currentDate.getTime() + expireDuration);
                mapStateResult.set("mapName", mapName);
                mapStateResult.set("mapFriendlyName", result.get("mapFriendlyName"));
                mapStateResult.set("playerNames", params.playerNames);
                mapStateResult.set("territoryToOwnerMap", territoryToOwnerMap);
                mapStateResult.set("territoryArmyMap", territoryArmyMap);
                mapStateResult.set("playersTurn", 0);
                mapStateResult.set("currentGameMode", "placement");
                mapStateResult.set("createdBy", request.user.id);
                mapStateResult.set("isOnlineGame", true);
                mapStateResult.set("round", 0);
                mapStateResult.set("orbitOffset", 0);
                var actionId = Math.floor(Math.random() * 100000000);
                mapStateResult.set("actionId", actionId);
                mapStateResult.set("usedPowerCards", []);
                mapStateResult.set("players", players);
                mapStateResult.set("immutablePlayers", players);
                mapStateResult.set("userIds", params.userIds);
                mapStateResult.set("mapRequest", params.mapRequest);
                var createdByRandom = false;
                if(params.createdByRandom) {
                    createdByRandom = true;
                }
                mapStateResult.set("createdByRandom", createdByRandom);
                if(request.user.get("facebookName")) {
                    mapStateResult.set("creatorFacebookName", UtilFunctions.myCiphering.encrypt(request.user.get("facebookName")));
                }


                var userQuery = new Parse.Query("_User");
                userQuery.containedIn("objectId", params.userIds);
                userQuery.find({
                    success: function(results) {
                        var playerNames = mapStateResult.get("playerNames");
                        for (var i = 0; i < results.length; i++) {
                            if(results[i].id == mapStateResult.get("createdBy")) {
                                results[i].userShips = params.userShips;
                            }
                            for (var index = 0; index < numberOfPlayers; index++) {
                                var playerInList = players[index];
                                if(playerInList.objectId == results[i].id) {
                                    playerInList.name = results[i].get("username");
                                    playerNames[index] = results[i].get("username");
                                    playerInList.wins = results[i].get("wins");
                                    playerInList.losses = results[i].get("losses");
                                    playerInList.forfeits = results[i].get("forfeits");
                                    playerInList.userShips = results[i].get("userShips");
                                }
                            }
                            
                            if(results[i].id == mapStateResult.get("createdBy")) {
                                var facebookFriendIndices = [];
                                for (var index = 0; index < numberOfPlayers; index++) {
                                    facebookFriendIndices.push(false);
                                }
                                var friendData = results[i].get("friendData");
                                if(friendData != null) {
                                    for (var playerIndex = 0; playerIndex < numberOfPlayers; playerIndex++) {
                                        var playerInGame = players[playerIndex];
                                        for (var index = 0; index < friendData.length; index++) {
                                            var userFriend = friendData[index];
                                            if(userFriend.objectId == playerInGame.objectId) {
                                                if(userFriend.facebookName) {
                                                    facebookFriendIndices[playerIndex] = true;
                                                }
                                            }
                                        }
                                    }
                                }
                                mapStateResult.set("userNameValues", facebookFriendIndices);
                            }
                         }
                        mapStateResult.set("players", players);
                        mapStateResult.set("immutablePlayers", players);
                        mapStateResult.set("playerNames", playerNames);
                        mapStateResult.save(null, {
                            success: function(mapSaveStateResult) {
                                var usersSaved = 0;
                                for (var i = 0; i < results.length; i++) {
                                    var currentGames = results[i].get("currentGames");
                                    if (currentGames == null) {
                                        currentGames = [];
                                    }
                                    currentGames.push(mapSaveStateResult.id);
                                    results[i].set("currentGames", currentGames);
                                    
                                    var friendData = results[i].get("friendData");
                                    if(friendData != null) {
                                        for (var friendDataIndex = 0; friendDataIndex < friendData.length; friendDataIndex++) {
                                            var userFriend = friendData[friendDataIndex];
                                            for (var friendIndex = 0; friendIndex < results.length; friendIndex++) {
                                                var immutableFriend = results[friendIndex];
                                                if(immutableFriend.id == userFriend.objectId) {
                                                    userFriend.username = immutableFriend.get("username");
                                                }
                                            }
                                        }
                                        results[i].set("friendData", friendData);
                                    }
                                    
                                    results[i].save(null, {
                                        success: function(result) {
                                            usersSaved++;
                                            if (usersSaved == results.length) {
                                                response.success(mapStateResult);
                                            }
                                        },
                                        error: function(result, error) {
                                            response.error(error.message);
                                        },
                                        useMasterKey : true
                                    });
                                }
                            },
                            error: function(mapStateResult, error) {
                                response.error("Failed to create new object, with error code: " + error.message);
                            },
                            useMasterKey : true
                        });
                    },
                    error: function(error) {
                        response.error(error.message);
                    },
                    useMasterKey : true
                });
            }
        });
    } else {
        response.error("Empty Map Name");
    }
});

/**
 * This function searches for a game that matches the specified paremeters or creates a new one
 */
Parse.Cloud.define("joinGame", function(request, response) {
    var params = request.params;
    var mapName = params.mapName;
    var challengeMode = params.challengeMode;
    var challengeLevel = params.challengeLevel;
    var numberOfPlayers = params.numberOfPlayers;
    if(mapName) {
        var query = new Parse.Query("MapRequest");
        query.equalTo("mapName", mapName);
        query.equalTo("numberOfPlayers", numberOfPlayers);
        query.equalTo("challengeMode", challengeMode);
        if(challengeMode) {
            query.equalTo("challengeLevel", challengeLevel);
        }
        query.first({
            success: function (result) {
                if (result) {
                    var currentUsers = result.get("users");
                    var userNames = result.get("userNames");
                    var wins = result.get("wins");
                    var losses = result.get("losses");
                    var forfeits = result.get("forfeits");
                    if(!UtilFunctions.arrayContainsValue(currentUsers, request.user.id)) {
                        result.addUnique("users", request.user.id);
                        currentUsers = result.get("users");
                        result.add("userNames", request.user.get("username"));
                        userNames = result.get("userNames");
                        result.add("wins", request.user.get("wins"));
                        wins = result.get("wins");
                        result.add("losses", request.user.get("losses"));
                        losses = result.get("losses");
                        result.add("forfeits", request.user.get("forfeits"));
                        forfeits = result.get("forfeits");
                        if(currentUsers.length < numberOfPlayers) {
                            request.user.add("mapRequests",result.id);
                            request.user.save(null, {
                                success: function() {
                                    result.save(null, {
                                        success: function(mapSaveStateResult) {
                                            response.success(mapSaveStateResult);
                                        },
                                        error: function(error) {
                                            response.error('Failed to save Map Request to user on create new: ' + error.message + " Code: " + error.code);
                                        }
                                    });
                                }, 
                                error: function(error) {
                                    response.error('Failed to save Map Request to user: ' + error.message);
                                },
                                useMasterKey : true
                            });
                        } else {
                            var requestObjectId = result.id;
                            result.destroy({
                                success: function(myObject) {
                                    // Create the new game based off of players info
                                    var parameters = {};
                                    parameters.numberOfPlayers = numberOfPlayers;
                                    parameters.userIds = currentUsers;
                                    parameters.playerNames = userNames;
                                    parameters.mapName = mapName;
                                    var desiredColors = [0,2,3,5];
                                    var lessDesiredColors = [1,4];
                                    
                                    var playerColors = [];
                                    var playerFactions = [];
                                    var count = 5000;
                                    for (var index = 0; index < numberOfPlayers; index++) {
                                        var randomIndex = Math.floor(Math.random()*desiredColors.length);
                                        var randomColor = desiredColors[randomIndex];
                                        if(desiredColors.length>0) {
                                            desiredColors.splice(randomIndex, 1);
                                        } else {
                                            randomIndex = Math.floor(Math.random()*lessDesiredColors.length);
                                            randomColor = lessDesiredColors[randomIndex];
                                            lessDesiredColors.splice(randomIndex, 1);
                                        }
                                        playerColors.push(randomColor);
                                        playerFactions.push(Math.floor(Math.random()*2));
                                    }
                                    parameters.playerColors = playerColors;
                                    parameters.factions = playerFactions;
                                    parameters.mapRequest = requestObjectId;
                                    parameters.wins = wins;
                                    parameters.losses = losses;
                                    parameters.forfeits = forfeits;
                                    parameters.createdByRandom = true;
                                    Parse.Cloud.run("requestNewMap", parameters, {
                                        success: function(mapState) {
                                            var installationQuery = new Parse.Query(Parse.Installation);
                                            installationQuery.equalTo(("userId"), currentUsers[0]);
                                            var pushMessage = "Opponents Found, Game started!";
                                            var successFunction = function() {
                                                response.success(mapState);
                                            };
                                            var failureFunction = function(error) {
                                                response.error(error.message);
                                            };
                                            UtilFunctions.sendPush(mapState.get("playersTurn"), pushMessage, mapState, successFunction, failureFunction);
                                            // Parse.Push.send({
                                            //     where: installationQuery,
                                            //     data: {
                                            //         alert: "Opponents Found, Game started!",
                                            //         map: mapState.id,
                                            //         sound: "default",
                                            //     }
                                            // }, {
                                            //     success: function() {
                                            //         // Push was successful
                                            //         response.success(mapState);
                                            //     },
                                            //     error: function(error) {
                                            //         // Handle error
                                            //     }
                                            // });
                                        },
                                        error: function(error) {
                                            
                                        },
                                        useMasterKey : true
                                    });
                                },
                                error: function(myObject, error) {
                                    response.error("Error deleting request object " + error.code + ": " + error.message);
                                },
                                useMasterKey : true
                            });
                        }
                    } else {
                        response.success(result);
                    }
                } else {
                    var MapRequest = Parse.Object.extend("MapRequest");
                    var mapRequestResult = new MapRequest();
                    mapRequestResult.set("mapName", mapName);
                    mapRequestResult.set("numberOfPlayers", numberOfPlayers);
                    mapRequestResult.set("challengeMode", challengeMode);
                    mapRequestResult.set("challengeLevel", challengeLevel);
                    mapRequestResult.add("users", request.user.id);
                    mapRequestResult.add("userNames", request.user.get("username"));
                    mapRequestResult.add("wins", request.user.get("wins"));
                    mapRequestResult.add("losses", request.user.get("losses"));
                    mapRequestResult.add("forfeits", request.user.get("forfeits"));
                    
                    mapRequestResult.save(null, {
                        success: function(mapSaveStateResult) {
                            request.user.add("mapRequests", mapSaveStateResult.id);
                            request.user.save(null, {
                                success: function() {
                                    response.success(mapSaveStateResult);
                                },
                                error: function(error) {
                                    response.error('Failed to save Map Request to user on create new: ' + error.message + " Code: " + error.code);
                                },
                                useMasterKey : true
                            });
                        }, 
                        error: function(error) {
                            response.error('Failed to create new request object, with error code: ' + error.message);
                        },
                        useMasterKey : true
                    });
                }
            },
            error: function(error) {
                response.error("Error result join game " + error.code + ": " + error.message);
            },
            useMasterKey : true
        });
    } else {
        response.error("Invalid mapName");
    }
});
