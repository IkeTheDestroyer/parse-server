var crypto = require('crypto');
var cryptoAlgorithm = "aes-256-ctr"; //or whatever you algorithm you want to choose see http://nodejs.org/api/crypto.html
var cryptoPassword = "k2jfisj3jSDjf8485Sdfjs3pP";
var cipher = crypto.createCipher(cryptoAlgorithm,cryptoPassword);
var decipher = crypto.createDecipher(cryptoAlgorithm,cryptoPassword);
var m_delay = 300;
exports.myCiphering = {
    encrypt:function(text){
        var encrypted = cipher.update(text,'utf8','hex');
        encrypted += cipher.final('hex');
        return encrypted;
    },
    decrypt: function(text){
        var decrypted = decipher.update(text,'hex','utf8')
        decrypted += decipher.final('utf8');
        return decrypted;
    }
};

exports.startExpireJob = function(delay) {
    // var backoff = {
    //     delay: 60000,
    //     type: 'fixed'
    // };
    m_delay = delay;
    if(m_delay == null || m_delay == 0) {
        m_delay = 300;
    }
    var job = queue.create('expireGames', {
    }).delay(delay*1000)
    .priority('high')
    .removeOnComplete(true)
    .save();
    

    queue.process('expireGames', function(job, done){
        expireGames(done);
    });
}

function expireGames(done) {
    // email send stuff...
    var totalCount = 0;
    var expiredGames = 0;
    // Query for all mapStates
    var gamesToUpdate = [];
    var query = new Parse.Query("MapState");
    var currentDate = new Date();
    query.lessThan("expireTime", currentDate.getTime());
    query.find( function(mapStates) {
        console.error("mapstates found = " + mapStates.length);
        for (var index = 0; index < mapStates.length; index++) {
            var mapState = mapStates[index];
            if(mapState != null) {
                exports.removePlayerFromMapstate(mapState.get("playersTurn"), mapState, "forfeits"); 
                expiredGames++
                totalCount++;
                gamesToUpdate.push(mapState);
            }
        }
    }, { useMasterKey: true }).then(function() {
        return Parse.Object.saveAll(gamesToUpdate);
    }).then(function() {
        for(var index = 0; index < gamesToUpdate.length; index++) {
            var mapState = gamesToUpdate[index];
            var pushMessage = "Your Turn!";
            exports.sendPush(mapState.get("playersTurn"), pushMessage, mapState);
        }
        // Set the job's success status
        console.error(expiredGames + " expired games discovered. Job Complete");
        done();
        exports.startExpireJob(m_delay);
        },
        function(error) {
        // Set the job's error status
        console.error("Error in running expire jobs: " + error.message);
        done();
        exports.startExpireJob(m_delay);
        });
    }
    

/**
 * Returns a map template by the specified name
 * @param mapName   string      Name of the map template
 * @param callback  function    function to call upon success
 */
exports.getMapTemplate = function (mapName, callback) {
    if(mapName) {
        var query = new Parse.Query("MapTemplates");
        query.equalTo("mapName", mapName);
        query.descending("version");
        query.first({
            success: function (result) {
                if (result) {
                    callback(result);
                } else {
                    console.error("Error finding mapName " +mapName);
                }
            },
            error: function(error) {
                console.error("Error finding mapName " + error.code + ": " + error.message);
            },
            useMasterKey : true
        });
    }
};

exports.isNumber = function (o) {
    return ! isNaN (o-0) && o !== null && o !== "" && o !== false;
};

// Array.prototype.contains = function(obj) {
//     var i = this.length;
//     while (i--) {
//         if (this[i] === obj) {
//             return true;
//         }
//     }
//     return false;
// };

exports.arrayContainsValue = function(array, obj) {
    if (!Array.isArray(array)) {
        return false;
    }
    var i = array.length;
    while (i--) {
        if (array[i] === obj) {
            return true;
        }
    }
    return false;
};

exports.indexOfObjectInArray = function(array, obj) {
    if (!Array.isArray(array)) {
        return false;
    }
    var i = array.length;
    while (i--) {
        if (array[i] === obj) {
            return i;
        }
    }
    return -1;
};

exports.toPointer = function(objectId, classType) {
    return { __type:"Pointer", className:classType, objectId:objectId };
}

exports.freeVariables = function() {
    var totalSize = 0;    
    for (var i = 0; i < arguments.length; i++) {
        totalSize += Parse.Cloud.roughSizeOfObjects(arguments[i]);
        arguments[i] = null;
    }
};

exports.roughSizeOfObjects = function ( object ) {

    var objectList = [];
    var stack = [ object ];
    var bytes = 0;

    while ( stack.length ) {
        var value = stack.pop();

        if ( typeof value === 'boolean' ) {
            bytes += 4;
        }
        else if ( typeof value === 'string' ) {
            bytes += value.length * 2;
        }
        else if ( typeof value === 'number' ) {
            bytes += 8;
        }
        else if
        (
            typeof value === 'object'
            && objectList.indexOf( value ) === -1
        )
        {
            objectList.push( value );

            for( var i in value ) {
                stack.push( value[ i ] );
            }
        }
    }
    return bytes;
};

exports.sendPush = function(playerIndex, message, mapState, successFunction, failureFunction) {
    // var installationQuery = new Parse.Query(Parse.Installation);
    
    //     installationQuery.equalTo(("userId"), userId);
    //     Parse.Push.send({
    //         where: installationQuery,
    //         data: {
    //             alert: message,
    //             map: mapState.id,
    //             sound: "default"
    //         }
    //      }, {
    //         success: function() {
    //             if(successFunction != null) {
    //                 successFunction();
    //             }
    //         },
    //         error: function(error) {
    //             if(failureFunction != null) {
    //                 failureFunction(error);
    //             }
    //         },
    //         useMasterKey : true
    //     });
    // }
    var players = mapState.get("players");
    if(playerIndex >= 0 && playerIndex < players.length) {
        var userId = players[playerIndex].objectId;
        var userQuery = new Parse.Query("_User");
        userQuery.get(userId, {
            success : function (user) {
                var pushIds = user.get("pushIds");
                if(pushIds != null && pushIds.length > 0) {
                    var notification = { 
                        app_id: "9f784777-6c38-46c1-a82f-2a32f3b9bf7d",
                        contents: {"en": message},
                        include_player_ids: pushIds,
                        data: {
                            map: mapState.id,
                        }
                    };
                    
                    var headers = {
                        "Content-Type": "application/json",
                        "Authorization": "Basic N2ZmMWNjN2MtNDhhNy00ZmI1LWI4NjQtYjM0ZTVhZDA3Yjlk"
                    };

                    var options = {
                        host: "onesignal.com",
                        port: 443,
                        path: "/api/v1/notifications",
                        method: "POST",
                        headers: headers
                    };

                    var https = require('https');
                    var req = https.request(options, function(res) {  
                        res.on('data', function(result) {
                            if(successFunction != null) {
                                successFunction();
                            }
                        });
                    });

                    req.on('error', function(e) {
                        failureFunction(e.message);
                    });

                    req.write(JSON.stringify(notification));
                    req.end();
                } else {
                    Debug.Log("pushIds null " + pushIds);
                    if(successFunction != null) {
                        successFunction();
                    }
                }
            },
            error : function (error) {
                console.error("userquery bad");
                if(failureFunction != null) {
                    failureFunction(error.message);
                }
            },
            userMasterKey : true
        });
    } else {
        console.error("index bad");
        if(successFunction != null) {
            successFunction();
        }
    }
};

exports.titleCase = function(str) {
   var splitStr = str.toLowerCase().split(' ');
   for (var i = 0; i < splitStr.length; i++) {
       splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
   }
   return splitStr.join(' '); 
};

/**
 * Removes a player from the mapState and returns resulting mapState
 */
exports.removePlayerFromMapstate = function(playerIndex, mapState, removalType) {
    if(removalType != "losses" && removalType != "wins" && removalType != "forfeits") {
        removalType = "losses";
    }
    var players = mapState.get("players");
    var userIds = mapState.get("userIds");
    var playersTurn = mapState.get("playersTurn");
    var round = mapState.get("round");
    var previousActions = mapState.get("previousActions");
    var userNameValues = mapState.get("userNameValues")
    var usedPowerCards = mapState.get("usedPowerCards");
    var newUsedPowerCards = [];
    usedPowerCards.forEach(function(arrayItem) {
        if (arrayItem.player != playerIndex) {
            newUsedPowerCards.push(arrayItem);
        }
    });
    mapState.set("usedPowerCards", newUsedPowerCards);
    var territoryToOwnerMap = mapState.get("territoryToOwnerMap");
    for (var territroyName in territoryToOwnerMap) {
        if (territoryToOwnerMap.hasOwnProperty(territroyName)) {
            var owner = territoryToOwnerMap[territroyName];
            if(owner === playerIndex) {
                territoryToOwnerMap[territroyName] = -1;
            } else if (owner > playerIndex) {
                // territoryToOwnerMap[territroyName] = territoryToOwnerMap[territroyName] -1;
            }
        }
    }
    var currentDate = new Date();
    var expireDuration = mapState.get("expireDuration");
    mapState.set("expireTime", currentDate.getTime() + expireDuration);
    var newActions = [];
    if(previousActions != null) {
        for (var k = 0; k < players.length; k++) {
            for (var j = 0; j < previousActions.length; j++) {
                if (previousActions[j][k] != null) {
                    var newAction = {};
                    if (k > playerIndex) {
                        newAction[k - 1] = previousActions[j][k];
                        newActions.push(newAction);
                    } else {
                        newAction[k] = previousActions[j][k];
                        newActions.push(newAction);
                    }
                }
            }
        }
    }
    // if(removalType == "forfeits" && round > 1) {
    //     var action = {actionId:mapState.get("actionId"), actionType:"forfeit", cards:null , destination:players[playerIndex].objectId}
    //     var actions = [];
    //     actions.push(action);
    //     var currentActions = {};
    //     currentActions[playerIndex] = actions;
    //     
    //     previousActions.push(currentActions);
    // }
    var userQuery = new Parse.Query("_User");
    userQuery.get(players[playerIndex].objectId, {
        success: function(user) {
            if(round!= 0 && !mapState.get("createdByRandom")) {
                user.increment(removalType);
            }
            user.remove("currentGames", mapState.id);
            user.save(null, {
                    success: function() {
                    },
                    error: function(error) {
                        console.error("Error saving user losses " + error);
                    },
                    useMasterKey : true
            });
        },
        error: function(object, error) {
            console.error("Error getting user on removal " + error);
        },
        useMasterKey : true
    });
    userNameValues.splice(playerIndex, 1);
    userIds.splice(playerIndex, 1);
    players.splice(playerIndex, 1);
    if(playerIndex<playersTurn) {
        playersTurn--;
        if(playersTurn<0) {
            playersTurn = 0;
        }
    }
    if (playersTurn >= players.length) {
        playersTurn = 0;
        round++;
    }
    mapState.set("round", round);
    mapState.set("playersTurn", playersTurn);
    if(players.length < 1) {
         mapState.destroy({
            success: function(myObject) {
            },
            error: function(error) {
                console.error("Error deleting map state " + error);
            },
            useMasterKey : true
        });
    }
};