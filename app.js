//jshint esversion:6
require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const TwitterStrategy = require("passport-twitter").Strategy;

mongoose.connect('mongodb+srv://dannyisfree:No2Mqz0jyZ304X5g@cluster0.hpyyo.mongodb.net/secretsDB?retryWrites=true&w=majority');

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    twitterId: String,
});

const secretSchema = new mongoose.Schema({
    userId: String,
    secretContent: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("user", userSchema);
const Secret = new mongoose.model("secret", secretSchema);

app.use(session({
    secret: "This is our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(User.createStrategy());

passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        cb(null, { id: user.id, username: user.username });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
},
    function (request, accessToken, refreshToken, profile, done) {
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return done(err, user);
        });
    }
));

passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: "http://localhost:3000/auth/twitter/secrets"
},
    function (token, tokenSecret, profile, cb) {
        User.findOrCreate({ twitterId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

let port = process.env.PORT;  
if (port == null || port == "") { //If app is not on heroku server, you can connect via port 3000
  port = 3000;
}

app.listen(port, function (req, res) {
    console.log("Server started on port 3000.");
});

app.get("/", function (req, res) {
    res.render("home.ejs");
});

app.get("/login", function (req, res) {
    res.render("login.ejs");
});

app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function (error) {
        passport.authenticate("local")(req, res, function (error) {
            res.redirect("/secrets");
        });
    });
});

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/login");
});

app.get("/register", function (req, res) {
    res.render("register.ejs");
});

app.post("/register", function (req, res) {
    User.register({ username: req.body.username }, req.body.password, function (error) {
        if (error) {
            console.log(error);
            res.redirect("/register");
        }
        else {
            passport.authenticate("local")(req, res, function (error) {
                res.redirect("/secrets");
            });
        }
    });

});

app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile']
    }));

app.get('/auth/google/secrets',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/secrets');
    });

app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/secrets',
    passport.authenticate('twitter', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/secrets');
    });

app.get("/secrets", function (req, res) {
    Secret.find({}, function (error, secrets) {
        if (error) {
            res.send(error)
        } else {
            res.render("secrets.ejs", { secretsList: secrets });
        }
    });

});

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit.ejs");
    }
    else {
        res.redirect("/login");
    }
});

app.post("/submit", function (req, res) {
    const userId = req.user.id;
    const secretContent = req.body.secret;

    const newSecret = new Secret({
        userId: userId,
        secretContent: secretContent
    });

    newSecret.save(function (error) {
        if (error) {
            res.send(error);
        }
        else {
            res.redirect("/secrets")
        }
    });
});