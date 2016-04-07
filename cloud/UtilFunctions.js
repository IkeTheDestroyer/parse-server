var crypto = require('crypto');
var cryptoAlgorithm = "aes-256-ctr"; //or whatever you algorithm you want to choose see http://nodejs.org/api/crypto.html
var cryptoPassword = "k2jfisj3jSDjf8485Sdfjs3pP";
var cipher = crypto.createCipher(cryptoAlgorithm,cryptoPassword);
var decipher = crypto.createDecipher(cryptoAlgorithm,cryptoPassword);
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
            }
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
    var installationQuery = new Parse.Query(Parse.Installation);
    var players = mapState.get("players");
    if(playerIndex >= 0 && playerIndex < players.length) {
        var userId = players[playerIndex].objectId;
        installationQuery.equalTo(("userId"), userId);
        Parse.Push.send({
            where: installationQuery,
            data: {
                alert: message,
                map: mapState.id,
                sound: "default"
            }
         }, {
            success: function() {
                if(successFunction != null) {
                    successFunction();
                }
            },
            error: function(error) {
                if(failureFunction != null) {
                    failureFunction(error);
                }
            }
        });
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
                    }
            });
        },
        error: function(object, error) {
            console.error("Error getting user on removal " + error);
        }
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
            }
        });
    }
};