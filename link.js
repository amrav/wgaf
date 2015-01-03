var _ = require('underscore');
var m = require('./mongoose');
var utils = require('./utils');
var log = require('bunyan').createLogger({'name': 'wgaf'});
var jwt = require('jwt-simple');
var SECRET = utils.SECRET;
var mail = require('./mail');
var restify = require('restify');
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

function get(req, res, next) {
    if (req.user.username !== req.params.username) {
        next(new restify.errors.NotAuthorizedError());
        return;
    }
    if (!utils.validateRequest(req, res, next, ['page', 'limit'])) {
        return;
    }
    if (!utils.isInt(req.query.page) || !utils.isInt(req.query.limit) ||
        req.query.page < 0 || req.query.limit < 0) {
        next(new restify.errors.InvalidArgumentError('page and limit must be non-negative integers'));
        return;
    }
    var cursor = m.Link.find({username: req.user.username},
                             {url: 1, summary: 1, time: 1, _id: 0})
            .skip(req.query.page * req.query.limit)
            .sort({time: -1})
            .limit(req.query.limit)
            .exec(function(err, data) {
                if (err) {
                    throw err;
                }
                res.send(200, data);
                next();
                return;
            });
}

function sendLinksTest(req, res, next) {
    sendLinks(function() {
        res.send(200);
        next();
    });
}

function sendLinks(cb) {

    log.info('Links update started');

    function addLinks(username, context, done) {
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
                    log.error({err: err, user: user}, 'Error saving user!');
                    return done();
                }
                if (context.links.length === 0)
                    return done();
                mail.sendLinks(user.username, context.links, user.email, done);
            });
        });
    }

    // Update all users that haven't been updated for at least 20 hours.
    m.User
        .find({verified: true, updated: {$lt: Date.create('20 hours ago')}})
        .select('username following email updated')
        .exec(function(err, users) {
            if (err) {
                throw err;
            }
            utils.asyncForEach(users, email, function() {
                log.info("Finished mailing users");
                if (typeof cb === 'function')
                    cb();
            });
        });
}

function future(date) {
    while (date < Date.now()) {
        date = date.addHours(24);
    }
    return date;
}

function scheduleUpdates() {

    // This redundancy is required because Heroku
    // can randomly restart dynos.
    var firstUpdate = future(Date.create('18:00+0530')) - Date.now();
    var secondUpdate = future(Date.create('19:00+0530')) - Date.now();
    var thirdUpdate = future(Date.create('20:00+0530')) - Date.now();

    setTimeout(sendLinks, firstUpdate);
    setTimeout(sendLinks, secondUpdate);
    setTimeout(sendLinks, thirdUpdate);
}

if (process.env.NODE_ENV === 'production' || true) {
    scheduleUpdates();
    setInterval(scheduleUpdates, 24 * 3600 * 1000);
}

exports.new_ = new_;
exports.sendLinksTest = sendLinksTest;
exports.get = get;
