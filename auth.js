var restify = require('restify');
var jwt = require('jsonwebtoken');
var utils = require('./utils');
var log = utils.log;
var m = require('./mongoose');

exports.getAccessToken = function(req, res, next) {
    if (!utils.validateRequest(req, res, next, ['username', 'password'])) {
        return;
    }
    m.User.findOne(
        {username: req.params.username}, 'username password verified',
        function(err, user) {
            if (err) {
                throw err;
            }
            if (user === null) {
                next(new restify.errors.InvalidCredentialsError('Bad auth'));
                return;
            }
            user.comparePassword(req.params.password, function(err, match) {
                if (err) {
                    throw err;
                }
                if (match) {
                    if (user.verified !== undefined && !user.verified) {
                        return next(new restify.errors.NotAuthorizedError('email not verified'));
                    }
                    req.log.info({username: user.username}, "User signed in");
                    var token = jwt.sign({username: user.username}, utils.SECRET);
                    res.send(200, {token: token});
                    return next();
                }
                else {
                    req.log.info({username: user.username}, "User login failed auth");
                    return next(new restify.errors.InvalidCredentialsError('Bad auth'));
                }
            });
        });
};
