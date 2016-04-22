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
require("./BeforeSaveFunctions.js");
require("./BeforeDeleteFunctions.js");
require("./CreateNewMap.js");
require("./SubmitTurn.js");

var UtilFunctions = require("./UtilFunctions.js");

/// <reference path="../parse/parse.d.ts" />


// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
Parse.Cloud.define("exchangeResources", function(request, response) {
    var previousDate =new Date(request.user.get("exchangeDate"));
    var currentDate = new Date();
    var waitTime = 7200000; // 2hours
    // var waitTime = 60000; 
    if(currentDate.getTime() - previousDate.getTime() > waitTime) {
        request.user.set("exchangeDate", currentDate.getTime());
        request.user.save(null, {
            success: function() {
                response.success("Success");
            }, 
            error: function(result, error) {
                response.error(error);
            },
            useMasterKey : true
        });
        response.success();
    } else {
        response.error("Frigate return time not reached");
    }
});

/**
 * Removes Player From Game
 */
Parse.Cloud.define("playerForfeit", function(request, response) {
    if(request.user != null) {
        var mapStateId = request.params.mapStateId;
        var mapState = Parse.Object.extend("MapState");
        var query = new Parse.Query(mapState);
        query.get(mapStateId, {
            success: function(mapState) {
                var userIds = mapState.get("userIds");
                var playerIndex = -1;
                for (var index = 0; index < userIds.length; index++) {
                    var userId = userIds[index];
                    if(userId == request.user.id) {
                        playerIndex = index;
                        break;
                    }
                }
                var shouldDestroyMapState = false;
                if(playerIndex >=0) {
                    UtilFunctions.removePlayerFromMapstate(playerIndex, mapState, "forfeits");
                    if(!mapState.get("createdByRandom")) {
                        if(mapState.get("round") == 0) {
                            var players = mapState.get("players");
                            if(players.length <= 1) {
                                shouldDestroyMapState = true;
                            }
                        }
                    }
                    if(shouldDestroyMapState) {
                        for (var index = 0; index < players.length; index++) {
                            UtilFunctions.removePlayerFromMapstate(index, mapState, "wins");
                        }
                        response.success();
                    } else {
                        mapState.save(null, {
                            success: function(mapStateResult) {
                                var playersTurn = mapStateResult.get("playersTurn");
                                var installationQuery = new Parse.Query(Parse.Installation);
                                installationQuery.equalTo(("userId"), userIds[playersTurn]);
                                Parse.Push.send({
                                    where: installationQuery,
                                    data: {
                                        alert: "Your Turn!",
                                        map: mapStateResult.id,
                                        sound: "default"
                                    }
                                }, {
                                    success: function() {
                                        // Push was successful
                                        response.success(mapStateResult);
                                    },
                                    error: function(error) {
                                        // Handle error
                                        response.error("Push unsuccessful")
                                    },
                                    useMasterKey : true
                                });
                            },
                            error: function(mapStateResult, error) {
                                response.error("Failed to save mapState " + error.message);
                            },
                            useMasterKey : true
                        });
                    }
                } else {
                    response.error("Invalid Player removals " + request.user.id);
                }
            },
            error: function(object, error) {
                var errorMessage = "Error finding game " + mapStateId + ", " + error.code + ": " + error.message;
                response.error(errorMessage);
            },
            useMasterKey : true
        });
    }
});

/**
 * Removes Player From map request
 */
Parse.Cloud.define("resetUserRecord", function(request, response) {
    if(request.user != null) {
        request.user.set("wins", 0);
        request.user.set("losses", 0);
        request.user.set("forfeits", 0);
        request.user.save(null, {
            success: function() {
                response.success();
            },
            error: function(error) {
                response.error(error.message);
            },
            useMasterKey : true
        });
    } else {
        response.error("Invalid User");
    }
});


/**
 * Removes Player From map request
 */
Parse.Cloud.define("leaveMapRequest", function(request, response) {
    if(request.user != null) {
        var requestId = request.params.mapRequestId;
        var mapRequest = Parse.Object.extend("MapRequest");
        var query = new Parse.Query(mapRequest);
        query.get(requestId, {
            success: function(requestResult) {
                var userIds = requestResult.get("users");
                var playerIndex = -1;
                for (var index = 0; index < userIds.length; index++) {
                    var userId = userIds[index];
                    if(userId == request.user.id) {
                        playerIndex = index;
                        break;
                    }
                }
                if(playerIndex >=0) {
                    if(userIds.length <=1) {
                        requestResult.destroy({
                            success: function() {
                                response.success()
                            },
                            error: function(error) {
                                response.error("Error deleting map request " + error.message);
                            },
                            useMasterKey : true
                        });
                    } else {
                        var wins = requestResult.get("wins");
                        var losses = requestResult.get("losses");
                        var forfeits = requestResult.get("forfeits");
                        var userNames = requestResult.get("userNames");
                        
                        wins.splice(playerIndex, 1);
                        losses.splice(playerIndex, 1);
                        forfeits.splice(playerIndex, 1);
                        userNames.splice(playerIndex, 1);
                        userIds.splice(playerIndex, 1);
                        requestResult.save({
                            success: function(savedRequest) {
                                request.user.remove("mapRequests", requestId);
                                request.user.save(null, {
                                    success: function(result) {
                                        response.success(savedRequest);
                                    },
                                    error: function(result, error) {
                                        response.error(error);
                                    },
                                    useMasterKey : true
                                });
                            },
                            error: function(error) {
                                response.error("Error saving map request " + error.message);
                            },
                            useMasterKey : true
                        });
                    }
                } else {
                    response.error("Invalid user");
                }
            }, 
            error: function(error) {
                response.error("Error getting map request " + error.message);
            },
            useMasterKey : true
        });
    } else {
        response.error("Invalid user");
    }
});


/**
 * Buy item and update it on user
 */
Parse.Cloud.define("buyItem", function(request, response) {
    var itemName = request.params.itemName;
    var quantity = request.params.quantity;
    var price = request.params.price;
    if(price < 0) {
        response.error("Negative price");
    }
    if(request.user != null) {
        var inventory = request.user.get("inventory");
        var itemInInventory = false;
        for (var index = 0; index < inventory.length; index++) {
            var item = inventory[index];
            if(item.itemName == itemName) {
                item.quantity = item.quantity + 1;
                itemInInventory = true;
                break;
            }
        }
        if(!itemInInventory) {
            var newItem = {itemName:itemName,quantity:quantity};
            inventory.push(newItem);
        }
        request.user.set("inventory", inventory);
        request.user.increment("credits", -price);
        request.user.save(null, {
            success: function() {
                response.success();
            },
            error: function(error) {
                response.error(error.message);
            },
            useMasterKey : true
        });
    } else {
        response.error("User not set");
    }
});

/**
 * Consume item and update it on user
 */
Parse.Cloud.define("consumeItem", function(request, response) {
    var itemName = request.params.itemName;
    var quantity = request.params.quantity;
    if(request.user != null) {
        var inventory = request.user.get("inventory");
        for (var index = 0; index < inventory.length; index++) {
            var item = inventory[index];
            if(item.itemName == itemName) {
                item.quantity = item.quantity - quantity;
                break;
            }
        }
        request.user.set("inventory", inventory);
        request.user.save(null, {
            success: function() {
                response.success();
            },
            error: function(error) {
                response.error(error.message);
            },
            useMasterKey : true
        });
    } else {
        response.error("User not set");
    }
});

/**
 * add credits
 */
Parse.Cloud.define("addCredits", function(request, response) {
    var amount = request.params.amount;
    if(request.user != null) {
        request.user.increment("credits", amount);
        request.user.save(null, {
            success: function() {
                response.success();
            },
            error: function(error) {
                response.error(error.message);
            },
            useMasterKey : true
        });
    } else {
        response.error("User not set");
    }
});

/**
 * Check if user name available
 */
Parse.Cloud.define("checkUserNameAvailable", function(request, response) {
    // Parse.Cloud.useMasterKey();
    var saveIfAvailable = request.params.saveIfAvailable;
    var potentialName = request.params.potentialName.trim();
    if(potentialName == "") {
        response.error("User name taken");
    }
    var userQuery = new Parse.Query("_User");
    userQuery.useMasterKey = true;
    userQuery.equalTo("username", request.params.potentialName);
    userQuery.find({
        success: function(users) {
            if(users.length > 0) {
                response.success("");
            } else {
                if(saveIfAvailable) {
                    request.user.set("username", potentialName);
                    request.user.save(null, {
                        success: function() {
                            response.success(potentialName);
                        },
                        error: function(error) {
                            response.error(error.message);
                        },
                        useMasterKey : true
                    });
                } else {
                    response.success(potentialName);
                }
            }
        },
        error: function(object, error) {
            response.error(error);
        },
        useMasterKey : true
    });
});

/**
 * Check if deviceId available
 */
Parse.Cloud.define("checkDeviceIdInUse", function(request, response) {
    var deviceId = request.params.deviceId;
    if(deviceId == "") {
        response.error("Invalid Id");
    }
    var userQuery = new Parse.Query("_User");
    userQuery.equalTo("deviceId", deviceId);
    userQuery.first({
        success: function(user) {
            if(user) {
                response.success(user.get("username"));
            } else {
                response.success("");
            }
        },
        error: function(object, error) {
            response.error(error);
        },
        useMasterKey : true
    });
});

/**
 * Set deviceId
 */
Parse.Cloud.define("setDeviceId", function(request, response) {
    var deviceId = request.params.deviceId;
    if(deviceId == "") {
        response.error("Invalid Id");
    }
    if(request.user != null) {
        request.user.set("deviceId", deviceId);
        request.user.save(null, {
            success: function() {
                response.success();
            },
            error: function(error) {
                response.error(error.message);
            },
            useMasterKey : true
        });
    } else {
        response.error("No User");
    }
});

/**
 * Update friend data saved on user
 */
Parse.Cloud.define("updateFriendData", function(request, response) {
    var facebookIds = request.params.facebookIds;
    var newFriendData = [];
    var userQuery = new Parse.Query("_User");
    userQuery.containedIn("facebookId", facebookIds);
    userQuery.find({
        success: function(results) {
            if(request.user.get("friendData")) {
                newFriendData = request.user.get("friendData");
            }
            for (var index = 0; index < results.length; index++) {
                var user = results[index];
                var newFriend = {objectId:user.id, facebookId:user.get("facebookId"), username:user.get("username"), facebookName:user.get("facebookName")};
                var alreadyInList = false;
                var needsUpdate = false;
                for (var friendIndex = 0; friendIndex < newFriendData.length; friendIndex++) {
                    var friend = newFriendData[friendIndex];
                    if(friend.objectId == user.id) {
                        alreadyInList = true;
                        if(friend.username != user.get("username")) {
                            needsUpdate = true;
                            friend.username = user.get("username");
                        }
                        if(friend.facebookId != user.get("facebookId")) {
                            friend.username = user.get("facebookId");
                            needsUpdate = true;
                        }
                        if(friend.facebookName != user.get("facebookName")) {
                            friend.facebookName = user.get("facebookName");
                            needsUpdate = true;
                        }
                    }
                }
                if(!alreadyInList) {
                    newFriendData.push(newFriend);
                }
            }
            request.user.setEmail(request.params.email);
            request.user.set("facebookName", request.params.facebookName);
            request.user.set("friendData", newFriendData);
            request.user.save(null, {
                success: function(user) {
                    response.success(user.get("friendData"));
                },
                error: function(error) {
                    response.error("Error saving user data" + error);
                },
                useMasterKey : true
            });
        },
        error: function(object, error) {
            response.error("Error in finding facbook friends ids " + error);
        },
        useMasterKey : true
    });
});

/**
 * Update friend data saved on user
 */
Parse.Cloud.define("addFriend", function(request, response) {
    var userQuery = new Parse.Query("_User");
    userQuery.get(request.params.objectId, {
        success: function(newFriend) {
            var friend = {objectId:newFriend.id, facebookId:newFriend.get("facebookId"), username:newFriend.get("username")};
            var userFriends = request.user.get("friendData");
            var friendAlreadyInList = false;
            if(userFriends) {
                for (var index = 0; index < userFriends.length; index++) {
                    var userFriend = userFriends[index];
                    if(userFriend.objectId == newFriend.id) {
                        friendAlreadyInList = true;
                        break;
                    }
                }
            }
            if(!friendAlreadyInList) {
                request.user.add("friendData", friend);
                request.user.save(null, {
                    success: function(user) {
                        response.success(newFriend);
                    },
                    error: function(error) {
                        response.error("Error saving user data" + error);
                    },
                    useMasterKey : true
                });
            } else {
                response.success(newFriend);
            }
        },
        error: function(object, error) {
            response.error("Error in finding facbook friends ids " + error);
        },
        useMasterKey : true
    });
});

/**
 * Update friend data saved on user
 */
Parse.Cloud.define("userExistsWithFbId", function(request, response) {
    var facebookId = request.params.facebookId;
    var userQuery = new Parse.Query("_User");
    userQuery.equalTo("facebookId", facebookId);
    userQuery.find({
        success: function(results) {
             if(results.length > 0) {
                response.success(true);
            } else {
                response.success(false);
            }
        },
        error: function(object, error) {
            response.error("Erorr finding user " + error);
        },
        useMasterKey : true
    });
});



// Array.prototype.sortNumeric = function() {
//     this.sort(function (a,b) {return b-a});
// };

