/**
 * MapState
 * Check to see if the user has the right to delete mapstate before allowing it to happen
 */
Parse.Cloud.beforeDelete("MapState", function(request, response) {
	var userIds = request.object.get("userIds");
	if (request.master) {
		response.success();
	} else {
		if (Parse.Cloud.arrayContainsValue(userIds, request.user.id)) {
			response.success();
		} else {
			response.error("Error: unauthorized delete");
		}
	}
});

/**
 * User
 * Delete Facbook access when deleting user
 */
Parse.Cloud.beforeDelete("_User", function(request, response) {
	if (request.master) {
        if (request.object.get("authData")) {
            var accessToken = request.object.get("authData").facebook.access_token;
            var userId = request.object.get("authData").facebook.id;
            var urlString = "https://graph.facebook.com/" + userId + "/permissions?access_token=" + accessToken;
            Parse.Cloud.httpRequest({
                method: "DELETE",
                url: urlString,
                body: {
                }
            }).then(function(httpResponse) {
                // success
                response.success();
            },function(httpResponse) {
                // error
                console.error('Request failed with response code ' + httpResponse.status);
                response.success();
            });
        } else {
            response.success();
        }
    } else {
        response.error("Not authorized user");
    }
});


/**
 * MapRequest
 * Clean up pointers from users that have a reference to this Map Request
 */
Parse.Cloud.beforeDelete("MapRequest", function(request, response) {
    Parse.Cloud.useMasterKey();
    var userQuery = new Parse.Query("_User");
    userQuery.containedIn("objectId", request.object.get("users"));
    userQuery.find({
        success: function(users) {
            if(users == null || users.length <= 0) {
                response.success();
            }
            var usersSaved = 0;
            for (var i = 0; i < users.length; i++) {
                users[i].remove("mapRequests", request.object.id);
                users[i].save(null, {
                    success: function(result) {
                        usersSaved++;
                        if (usersSaved == users.length) {
                            response.success();
                        }
                    },
                    error: function(result, error) {
                        response.error(error.message);
                    }
                });
            }
        },
        error: function(error) {
            response.error("Error on get users " + error.message);
        }
    });
});