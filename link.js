var _ = require('underscore');
var m = require('./mongoose');
var utils = require('./utils');
var log = require('bunyan').createLogger({'name': 'wgaf'});
var jwt = require('jwt-simple');
var SECRET = utils.SECRET;
var mail = require('./mail');
require('sugar');

function new_(req, res, next) {
    if (!utils.validateRequest(req, res, next, ['url', 'summary'])) {
        return;
    }

    m.User.findOne({username: req.user.username}, function(err, user) {
        if (err) {
            throw err;
        }
        if (user === null) {
            return next(new restify.errors.ResourceNotFoundError('no such user found'));
        }
        var link = new m.Link({
            'url': req.params.url,
            'summary': req.params.summary,
            'username': req.user.username
        });
        link.save(function(err, link) {
            if (err) {
                throw err;
            }
            req.log.info({link: link}, "Saved link");
            res.send(200);
            return next();
        });
    });
}

function sendLinksTest(req, res, next) {
    sendLinks(function() {
        res.send(200);
        next();
    });
}

function sendLinks(cb) {
    function addLinks(username, context, done) {
        if (context.user.updated === null) {
            context.user.updated = Date.create("1 day ago");
        }
        m.Link.find({username: username, time: {$gte: context.user.updated}},
                    function(err, links) {
                        if (err) {
                            log.error({err: err});
                            return;
                        }
                        context.links = context.links.concat(links);
                        done();
                    });
    }
    function email(user, done) {
        log.info({user: user.username}, "constructing email");
        var context = {links: [], user: user};
        utils.asyncForEach(user.following, addLinks, context, function() {
            log.info({user: user.username, links: context.links}, "links for user");
            user.updated = Date.now();
            user.save(function(err) {
                if (err) {
                    log.error({err: err});
                    return done();
                }
                if (context.links.length === 0)
                    return done();
                mail.sendLinks(user.username, context.links, user.email, done);
            });
        });
    }
    m.User.find({verified: true}, 'username following email updated', function(err, users) {
        if (err) {
            log.error({err: err});
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
