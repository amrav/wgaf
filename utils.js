var _ = require('underscore');
var jwt = require('jwt-simple');
var SECRET = process.env.SECRET || "foobar";
var API_URL = process.env.API_URL;
var APP_URL = process.env.APP_URL;
var bunyan = require('bunyan');
var restify = require('restify');

function resSerializer(res) {
    return {
        statusCode: res.statusCode,
        header: res.headers(),
        body: res._body
    };
}

var log = bunyan.createLogger({
    name: 'wgaf',
    streams: [
        {
            stream: process.stdout,
            level: 'debug'
        },
    ],
    serializers: {
        req: bunyan.stdSerializers.req,
        res: resSerializer,
        err: bunyan.stdSerializers.err
    }
});

function validateRequest(req, res, next, params) {
    for (var i = 0; i < params.length; ++i) {
        if (!_.has(req.params, params[i])) {
            next(new restify.errors.MissingParameterError(params[i] + ' required'));
            return false;
        }
    }
    return true;
}

function asyncForEach(list, func, context, callback) {
    if (typeof context === 'function') {
        callback = context;
        context = undefined;
    }
    if (list.length === 0)
        return callback();
    var done = 0;
    function doneOne() {
        done += 1;
        if (done === list.length) {
            callback();
        }
    }
    for (var i = 0; i < list.length; i++) {
        if (!context)
            func(list[i], doneOne);
        else
            func(list[i], context, doneOne);
    }
}

RegExp.escape = function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

function isInt(value) {
  return !isNaN(value) &&
         parseInt(Number(value)) == value &&
         !isNaN(parseInt(value, 10));
}

function validateUsername(username) {
    if (!/^[A-Za-z][_A-Za-z0-9]+$/.test(username)) {
        return false;
    } else {
        return true;
    }
}

exports.validateRequest = validateRequest;
exports.SECRET = SECRET;
exports.log = log;
exports.API_URL = API_URL;
exports.APP_URL = APP_URL;
exports.asyncForEach = asyncForEach;
exports.isInt = isInt;
exports.validateUsername = validateUsername;
