var _ = require('underscore');
var m = require('./mongoose');
var utils = require('./utils');
var log = require('bunyan').createLogger({'name': 'wgaf'});
var jwt = require('jwt-simple');
var SECRET = utils.SECRET;
var mail = require('./mail');
require('sugar');

function new_(req, res, next) {
    if (!utils.validateRequest(req, res, ['token', 'username', 'url', 'summary'])) {
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
            'summary': req.params.summary,
            'username': req.params.username
        });
        link.save(function(err, yell) {
            if (err) {
                log.error(err);
                res.send(500);
                return next();
            }
            log.info("Saved link: ", {url: link.url, summary: link.summary});
            res.send(201);
            return next();
        });
    });
}

function sendLinksTest(req, res, next) {
    sendLinks(function() {
        log.info("Links sent!");
        res.send(200);
        next();
    });
}

function sendLinks(cb) {
    function addLinks(username, context, done) {
        m.Link.find({username: username, time: {$gte: context.user.updated}},
                    function(err, links) {
                        if (err) {
                            log.error(err);
                            return;
                        }
                        context.links = context.links.concat(links);
                        done();
                    });
    }
    function email(user, done) {
        log.info("constructing email for " + user.username);
        var context = {links: [], user: user};
        utils.asyncForEach(user.following, addLinks, context, function() {
            log.info("links for " + user.username, context.links);
            user.updated = Date.now();
            user.save(function(err) {
                if (err) {
                    log.error(err);
                    return;
                }
                log.info("Saved follower last updated: " + user.username);
                if (context.links.length === 0)
                    return done();
                mail.sendLinks(user.username, context.links, user.email, done);
            });
        });
    }
    m.User.find({verified: true}, 'username following email updated', function(err, users) {
        if (err) {
            log.error(err);
            return;
        }
        utils.asyncForEach(users, email, function() {
            log.info("Finished mailing users");
            if (typeof cb === 'function')
                cb();
        });
    });
}

(function () {
    function runUpdate() {
        var ms = Date.create('18:00+0530') - Date.now();
        if (ms > 0) {
            setTimeout(function() {
                sendLinks(runUpdate);
            }, ms);
        }
    }
    runUpdate();
})();

exports.new_ = new_;
exports.sendLinksTest = sendLinksTest;
