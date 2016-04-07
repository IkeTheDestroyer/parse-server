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

/**
 * MapTemplates
 * This function adds a version field to a mapTemplate
 */
Parse.Cloud.beforeSave("MapTemplates", function(request, response) {
    var mapName = request.object.get("mapName");
    // First delete all versions older than 5
    var deleteQuery = new Parse.Query("MapTemplates");
    deleteQuery.equalTo("mapName", mapName);
    deleteQuery.descending("version");
    deleteQuery.skip(5);
    deleteQuery.find({
        success: function(result) {
            Parse.Object.destroyAll(result, {
                success: function() {

                    var query = new Parse.Query("MapTemplates");
                    query.equalTo("mapName", mapName);
                    query.descending("version");
                    query.first({
                        success: function(result) {
                            if (result) {
                                request.object.set("version", result.get("version") + 1);
                            } else {
                                request.object.set("version", 1);
                            }
                            response.success();
                        },
                        error: function(error) {
                            console.error("Error finding mapName " + error.code + ": " + error.message);
                        }
                    });
                },
                error: function(error) {
                    console.error("Error deleting mapName " + error.code + ": " + error.message);
                },
                userMasterKey: true
            });
        },
        error: function(error) {
            console.error("Error in find " + error.code + ": " + error.message);
        }
    });
});

/**
 * Users
 * This function checks the users object id and creates a user id based on the object id
 */
Parse.Cloud.beforeSave("_User", function(request, response) {
    if(request.object != null) {
        if (!request.object.get("facebookId") && request.object.get("authData")) {
            request.object.set("facebookId", request.object.get("authData").facebook.id);
        }
        if (!request.object.get("exchangeDate")) {
            request.object.set("exchangeDate", 1);
        }
        if(!request.object.get("wins")) {
            request.object.set("wins", 0);
        }
        if(!request.object.get("losses")) {
            request.object.set("losses", 0);
        }
        if(!request.object.get("forfeits")) {
            request.object.set("forfeits", 0);
        }
        if(!request.object.get("userShips")) {
            var userShips = [];
            userShips.push("deepRoller_a");
            userShips.push("striker_b");
            userShips.push("mirageBomber_c");
            userShips.push("default");
            request.object.set("userShips", userShips);
        }
        if(!request.object.get("credits")) {
            request.object.set("credits", 1000);
        }
        if(!request.object.get("inventory")) {
            var inventory = [];
            inventory.push({ itemName:"Classic", quantity:1});
            inventory.push({ itemName:"EarthAndMoon", quantity:1});
            inventory.push({ itemName:"Solea", quantity:1});
            inventory.push({ itemName:"deepRoller_a", quantity:1});
            inventory.push({ itemName:"marlin_a", quantity:1});
            inventory.push({ itemName:"striker_b", quantity:1});
            inventory.push({ itemName:"wasp_b", quantity:1});
            inventory.push({ itemName:"mirageBomber_c", quantity:1});
            inventory.push({ itemName:"kingCobra_c", quantity:1});
            request.object.set("inventory", inventory);
        }
        
        if(!request.master && request.user != null) {
            request.object.set("wins", request.user.get("wins"));
            request.object.set("losses", request.user.get("losses"));
            request.object.set("forfeits", request.user.get("forfeits"));
            request.object.set("friendData", request.user.get("friendData"));
            request.object.set("facebookName", request.user.get("facebookName"));
            request.object.set("email", request.user.get("email"));
            request.object.set("exchangeDate", request.user.get("exchangeDate"));
            request.object.set("mapRequests", request.user.get("mapRequests"));
            request.object.set("currentGames", request.user.get("currentGames"));
            request.object.set("userShips", request.user.get("userShips"));
            request.object.set("inventory", request.user.get("inventory"));
            request.object.set("credits", request.user.get("credits"));
        }
    }
    response.success();
});

/**
 * Users
 * This function checks the users object id and creates a user id based on the object id
 */
Parse.Cloud.beforeSave("_Installation", function(request, response) {
    if (!request.object.get("userId") && request.user != null) {
        request.object.set("userId", request.user.id);
    }
    response.success();
});
