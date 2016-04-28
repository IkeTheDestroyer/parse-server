// Example express application adding the parse-server module to expose Parse
// compatible API routes.

var express = require('express')
, kue = require('kue');
var url = require('url');
var redis;
var password;
if (process.env.REDIS_URL) {
    var rtg = require("url").parse(process.env.REDIS_URL);
    redis = require("redis").createClient(rtg.port, rtg.hostname);
    password = rtg.auth.split(":")[1];
    redis.auth(password);
    var kueOptions = {};
    kueOptions.redis = {
        port: parseInt(rtg.port),
        host: rtg.hostname,
        auth: password
    };
    queue = kue.createQueue(kueOptions);
} else {
    redis = require("redis").createClient();
    queue = kue.createQueue();
}

var UtilFunctions = require('./cloud/UtilFunctions.js');

var ParseServer = require('parse-server').ParseServer;
var path = require('path');

var databaseUri = process.env.DATABASE_URI || process.env.MONGOLAB_URI;

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

var api = new ParseServer({
  databaseURI: databaseUri || '',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || '',
  masterKey: process.env.MASTER_KEY || '', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',  // Don't forget to change to https if needed
  liveQuery: {
    classNames: ["Posts", "Comments"], // List of classes to support for query subscriptions
  },
  push : {
    android : {
      senderId : process.env.ANDROID_SENDER_ID || '',
      apiKey : process.env.ANDROID_API_KEY || ''
    },
    ios : [
      {
        pfx: __dirname + '/ParsePushDevelopment.p12', // Dev PFX or P12
        bundleId: process.env.BUNDLE_ID || '',
        production: false // Dev
      },
      {
        pfx: __dirname + '/ParsePushProduction.p12', // Prod PFX or P12
        bundleId: process.env.BUNDLE_ID || '',  
        production: true // Prod
      }
    ]
  }
});
// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

var app = express();

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api)
.use(kue.app);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
  res.status(200).send('Make sure to star the parse-server repo on GitHub!');
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
app.get('/test', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/test.html'));
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('parse-server-example running on port ' + port + '.');
});

UtilFunctions.startExpireJob(process.env.JOB_DELAY_TIME || 300);


// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);