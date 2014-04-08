var _ = require('underscore');
var log = require('bunyan').createLogger({'name': 'wgaf'});
var m = require('./mongoose');
var utils = require('./utils.js');
var jwt = require('jwt-simple');
var SECRET = utils.SECRET;

function new_(req, res, next) {
    if (!utils.validateRequest(req, res, ['username', 'email', 'password'])) 
	return next();
    var user = new m.User({'username': req.params.username,
                           'email': req.params.email,
                           'password': req.params.password});
    user.save(function(err, user) {
	if (err && err.code === m.UNIQUE_KEY_ERROR) {
            res.send(403, {"code": "UserExists", "message": "username/email already exists"});
	}
	else if (err) {
            log.error(err);
            res.send(500);
	}
	else {
            log.info({username: user.username}, "New user created");
            var token = jwt.encode({username: user.username}, SECRET);
            res.send(201, {token: token});
	}
        next();
    });
}

function login(req, res, next) {
    
    if (!utils.validateRequest(req, res, ['username', 'password'])) 
	return next();
    
    m.User.findOne({username: req.params.username}, function(err, user) {
	if (err) {
            res.send(500);
            log.error(err);
            return next();
	}
        if (user === null) {
            res.send(404, {"code": "NoUserFound", "message": "no such user exists"});
            return next();
        }
        user.comparePassword(req.params.password, function(err, match) {
            if (err) {
                log.error(err);
                res.send(500);
                return next();
            }
            if (match) {
                log.info({username: user.username}, "User signed in");
                var token = jwt.encode({username: user.username}, SECRET);
                res.send(200, {token: token});
            }
            else {
                log.info({username: user.username}, "User login failed auth");
                res.send(403, {"code": "BadAuth"});
            }
            next();
        });
    });
}

function del(req, res, next) {
    if (!utils.validateRequest(req, res, ['token', 'username']))
        return next();
    if (!utils.authenticateRequest(req, res))
        return next();
        
    m.User.findOneAndRemove(
        {'username': username},
        function (err, user) {
            if (err) {
                res.send(500);
                log.error(err);
            }
            else if (user === null) {
                res.send(404, {"code": "NoUserFound", "message": "no such user exists"});
            }
            else {
                res.send(200, {"status": "User deleted"});
                log.info({"Deleted user": user});
            }
            next();
        });
}

function follow(req, res, next) {
    if (!utils.validateRequest(req, res, ['token', 'username', 'target']))
        return next();
    if (!utils.authenticateRequest(req, res))
        return next();
    
    var usernames = new RegExp(req.params.username + '|' +
                               req.params.target, 'i');
    m.User.find({username: usernames}, function(err, users) {
        if (err) {
            log.error(err);
            res.send(500);
            return next();
        }
        if (users.length !== 2) {
            res.send(404, {"code": "NoUserFound", "message": "no such user exists"});
            return next();
        }
        var follower, followed;
        if (users[0].username === req.params.username) {
            follower = users[0];
            followed = users[1];
        } else {
            follower = users[1];
            followed = users[0];
        }
        follower.following.push(followed.username);
        followed.followers.push(follower.username);
        follower.save(function(err, yell) {
            if (err) {
                log.error(err);
                res.send(500);
                return next();
            }
            log.info("Saved follower: ", follower);
            followed.save(function(err, yell) {
                if (err) {
                    log.error(err);
                    res.send(500);
                    return next();
                }
                log.info("Saved followed: ", followed);
                res.send(201);
                return next();
            });
        });
    });
}

exports.new_ = new_;
exports.del = del;
exports.follow = follow;
exports.login = login;
