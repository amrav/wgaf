var _ = require('underscore');
var m = require('./mongoose');
var utils = require('./utils');
var log = require('bunyan').createLogger({'name': 'wgaf'});
var jwt = require('jwt-simple');
//TODO: Make this private
var SECRET = "foobar";

function new_(req, res, next) {
    if (!utils.validateRequest(req, res, ['token', 'username', 'url', 'title'])) {
        return next();
    }

    if (!utils.authenticateRequest(req, res))
        return next();

    m.User.findOne({username: req.params.username}, function(err, user) {
        if (err) {
            log.error(err);
            res.send(500);
            return next();
        }
        if (user === null) {
            res.send(404, {"code": "NoUserFound", "message": "no such user exists"});
            return next();
        }
        var link = new m.Link({
            'url': req.params.url,
            'title': req.params.title,
            'username': req.params.username
        });
        link.save(function(err, yell) {
            if (err) {
                log.error(err);
                res.send(500);
                return next();
            }
            log.info("Saved link: ", {url: link.url, title: link.title});
            res.send(201);
            return next();
        });
    });
}

function sendLinksTest(req, res, next) {
    sendLinks2(function() {
        log.info("Links sent!");
        res.send(200);
        next();
    });
}

function sendLinks(cb) {
    function addLinks(username, index, following) {
        var allLinks = this.links;
        var done = this.done;
        var cb = this.cb;
        m.Link.find({'username': username}, function(err, links) {
            if (err) {
                log.error(err);
                return;
            }
            allLinks.push(links);
            done += 1;
            if (done === following.length)
                cb();
        });
    }
    function email(user, index, users) {
        log.info("constructing email for " + user.username);
        callback = this.cb;
        var context = {links: [], done: 0, cb: function () {
            log.info("links for " + user.username, context.links);
            callback();
        }};
        if (user.following.length === 0)
            return context.cb();
        _.each(user.following, addLinks, context);
    }
    m.User.find({}, 'username following email', function(err, users) {
        var context = {done: 0, cb: function() {
            context.done += 1;
            if (context.done === users.length)
                cb();
        }};
        if (users.length === 0)
            return cb();
        _.each(users, email, context);
    });
}

exports.new_ = new_;
exports.sendLinksTest = sendLinksTest;
