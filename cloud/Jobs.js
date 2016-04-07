
var UtilFunctions = require('cloud/UtilFunctions.js');

Parse.Cloud.job("expireGames", function(request, status) {
  Parse.Cloud.useMasterKey();
  var totalCount = 0;
  var expiredGames = 0;
  // Query for all mapStates
  var gamesToUpdate = [];
  var query = new Parse.Query("MapState");
  var currentDate = new Date();
  query.lessThan("expireTime", currentDate.getTime());
  query.find(function(mapStates) {
    for (var index = 0; index < mapStates.length; index++) {
        var mapState = mapStates[index];
        if(mapState != null) {
            UtilFunctions.removePlayerFromMapstate(mapState.get("playersTurn"), mapState, "forfeits"); 
            expiredGames++
            totalCount++;
            gamesToUpdate.push(mapState);
        }
    }
  }).then(function() {
    return Parse.Object.saveAll(gamesToUpdate);
  }).then(function() {
      for(var index = 0; index < gamesToUpdate.length; index++) {
        var mapState = gamesToUpdate[index];
        var pushMessage = "Your Turn!";
        UtilFunctions.sendPush(mapState.get("playersTurn"), pushMessage, mapState);
      }
      // Set the job's success status
      status.success(expiredGames + " expired games discovered. Job Complete");
    },
    function(error) {
      // Set the job's error status
      status.error("Error in running expire jobs");
    });
});


Parse.Cloud.job("setGameStateToAlmostWinning", function(request, status) {
  var mapId = request.params.mapStateId;
  var playerIndex =  request.params.playerIndex;
  Parse.Cloud.useMasterKey();
  var template = Parse.Object.extend("MapState");
  var templateQuery = new Parse.Query(template);
  var owner;
  templateQuery.get(mapId, function(mapState) {
    var firstTerritoryForPlayer = [];
    for (var index = 0; index < mapState.get("numberOfPlayers"); index++) {
      firstTerritoryForPlayer.push(false);
    }
    var territoryOwnerMap = mapState.get("territoryToOwnerMap");
    for (var territoryName in territoryOwnerMap) {
      if (territoryOwnerMap.hasOwnProperty(territoryName)) {
        owner = territoryOwnerMap[territoryName];
        if(firstTerritoryForPlayer[owner] != true) {
          firstTerritoryForPlayer[owner] = true;
        } else {
          territoryOwnerMap[territoryName] = playerIndex;
        }
      }
    }
    return mapState.save();
  }).then(function() {
      // Set the job's success status
      status.success("Successfully set map " + mapId + " to almostWinning conditions for player " + playerIndex);
    },
    function(error) {
      // Set the job's error status
      status.error("Uh oh, something went wrong.");
    });
});