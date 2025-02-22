const DEFAULT_LANGUAGE = 'en';

NODE_ENV = process.env.NODE_ENV || "dev";

// Request
const request = require("request");

// Firebase
var admin = require("firebase-admin");

if(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    var serviceAccount = {
        "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    };

} else {
    var serviceAccount = require("./mixmix-questions-firebase-adminsdk.json");
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://dustinjourdan.firebaseio.com"
});

// Get a reference to the database service
var database = admin.database();

// Express
var express = require('express');

var app = express();

app.use(express.static(__dirname + '/public'));

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

var randomProperty = function (obj) {
    var keys = Object.keys(obj)
    return obj[keys[ keys.length * Math.random() << 0]];
};

function getRandomSubset(arr, n) {
    var result = new Array(n),
        len = arr.length,
        taken = new Array(len);
    if (n > len)
        n = len;
    while (n--) {
        var x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}

function getConfig() {
    return new Promise(resolve => {
        const url = NODE_ENV == 'prod' ? 'https://mixmix.herokuapp.com/config.json' : 'http://localhost:8080/config.json'
        console.log(url);
        request.get(url, (error, response, body) => {
            if(error) {
                return console.dir(error);
            }
            config = JSON.parse(body);
            console.log("Config :", config);

            resolve(config);
        });
    });
}

app.get('/', function(req, res) {
    getConfig().then(function(config) {
        res.render('index.ejs', {status: req.query.status, languages: config.languages});
    });
});

app.get('/mass-import', function(req, res) {
    var json = require('./questions.json');

    json.normal.forEach(question => {
        //console.log(question.question);
        //console.log(question.answer+'\n');
        var firstLanguage = Object.keys(question)[0];
        var newQuestionRef = database.ref('questions/' + NODE_ENV + '/' + firstLanguage).push({
            question: question[firstLanguage].question.replace('<BLANK>', '...').replace('....', '...'),
            solution: question[firstLanguage].answer
        });
        var uuid = newQuestionRef.key;
        Object.keys(question).slice(1).forEach(language => {
            database.ref('questions/' + NODE_ENV + '/' + language + '/' + uuid).set({
                question: question[language].question.replace('<BLANK>', '...').replace('....', '...'),
                solution: question[language].answer
            });
        });
    });
    res.redirect('/?status=success');
});

app.get('/question/random', function(req, res) {
    var language = req.query.lan || DEFAULT_LANGUAGE;
    database.ref('questions/' + NODE_ENV + '/' + language).once('value').then(function(snapshot) {
        res.json(randomProperty(snapshot.val()));
    });
});

app.get('/question/random/:nb', function(req, res) {
    var language = req.query.lan || DEFAULT_LANGUAGE;
    database.ref('questions/' + NODE_ENV + '/' + language).once('value').then(function(snapshot) {
        var subsetKeys = getRandomSubset(Object.keys(snapshot.val()), req.params.nb);
        var subset = subsetKeys.map(key => res[key] = snapshot.val()[key]);
        res.json(subset);
    });
});

app.get('/question/:id', function(req, res) {
    var language = req.query.lan || DEFAULT_LANGUAGE;
    database.ref('questions/' + NODE_ENV + '/' + language + '/' + req.params.id).once('value').then(function(snapshot) {
        res.json(snapshot.val());
    });
});

app.post('/question/add', function(req, res) {
    var language = req.body.language || DEFAULT_LANGUAGE;
    database.ref('questions/' + NODE_ENV + '/' + language).push({
        question: req.body.question,
        solution: req.body.solution
    });
    res.redirect('/?status=success');
});

app.post('/question/edit', function(req, res) {
    var language = req.body.language || DEFAULT_LANGUAGE;
    database.ref('questions/' + NODE_ENV + '/' + language + '/' + req.body.id).set({
        question: req.body.question,
        solution: req.body.solution
    });
    res.redirect('/');
});

var port = process.env.PORT || 3000;

app.listen(port);

console.log('RESTful API server started on: ' + port);
