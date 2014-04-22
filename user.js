var _ = require('underscore');
var m = require('./mongoose');
var utils = require('./utils.js');
var log = utils.log;
var jwt = require('jwt-simple');
var mail = require('./mail');
require('sugar');
var SECRET = utils.SECRET;

function new_(req, res, next) {
    if (!utils.validateRequest(req, res, ['username', 'email', 'password'])) 
	return next();
    var user = new m.User({'username': req.params.username,
                           'email': req.params.email,
                           'password': req.params.password,
                           'verified': false,
                           'updated': Date.create("1 day ago")});
    user.save(function(err, user) {
	if (err && err.code === m.UNIQUE_KEY_ERROR) {
            res.send(403, {"code": "UserExists", "message": "username/email already exists"});
	}
	else if (err) {
            req.log.error(err);
            res.send(500);
	}
	else {
            req.log.info({username: user.username}, "New user created");
            var token = jwt.encode({username: user.username}, SECRET);
            res.send(201, {token: token});
            mail.verify(user.username, user.email, function() {
                req.log.info("Sent verification email to " + user.email);
            });
	}
        next();
    });
}

function login(req, res, next) {
    
    if (!utils.validateRequest(req, res, ['username', 'password'])) 
	return next();
    
    m.User.findOne({username: req.params.username}, "username password verified",
                   function(err, user) {
	if (err) {
            res.send(500);
            req.log.error(err);
            return next();
	}
        if (user === null) {
            res.send(404, {"code": "NoUserFound", "message": "no such user exists"});
            return next();
        }
        user.comparePassword(req.params.password, function(err, match) {
            if (err) {
                req.log.error(err);
                res.send(500);
                return next();
            }
            if (match) {
                if (_.has(user, 'verified') && !user.verified) {
                    res.send(401, {"message": "user not verified"});
                    return next();
                }
                req.log.info({username: user.username}, "User signed in");
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
                req.log.error(err);
            }
            else if (user === null) {
                res.send(404, {"code": "NoUserFound", "message": "no such user exists"});
            }
            else {
                res.send(200, {"status": "User deleted"});
                req.log.info({"Deleted user": user});
            }
            next();
        });
}

function follow(req, res, next) {
    if (!utils.validateRequest(req, res, ['token', 'username', 'target']))
        return next();
    if (!utils.authenticateRequest(req, res))
        return next();
    
    m.User.find({username: {$in: [req.params.username, req.params.target]}},
                function(err, users) {
                    if (err) {
                        req.log.error(err);
                        res.send(500);
                        return next();
                    }
                    if (users.length !== 2) {
                        res.send(404, {"code": "NoUserFound",
                                       "message": "no such user exists"});
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
                            req.log.error(err);
                            res.send(500);
                            return next();
                        }
                        req.log.info("Saved follower: ", follower);
                        followed.save(function(err, yell) {
                            if (err) {
                                req.log.error(err);
                                res.send(500);
                                return next();
                            }
                            req.log.info("Saved followed: ", followed);
                            res.send(201);
                            return next();
                        });
                    });
                });
}

function verify(req, res, next) {
    if (!utils.validateRequest(req, res, ['username', 'verify']))
        return next();
    var token;
    try {
        token = jwt.decode(req.params.verify, utils.SECRET);
    } catch (err) {
        req.log.info(err);
        res.send(401);
        return next();
    }
    if (token.username !== req.params.username || token.type !== 'verify') {
        res.send(401);
        return next();
    }
    m.User.update({username: req.params.username}, {verified: true},
                  function(err, users) {
                      if (err) {
                          req.log.error(err);
                          res.send(500);
                          return next();
                      }
                      req.log.info("Verified email: " + req.params.username);
                      res.header('Location', utils.APP_URL);
                      res.send(302);
                      return next(false);
                  });
}

exports.new_ = new_;
exports.del = del;
exports.follow = follow;
exports.login = login;
exports.verify = verify;
