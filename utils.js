var _ = require('underscore');
var jwt = require('jwt-simple');
var SECRET = process.env.SECRET || "foobar";

function validateRequest(req, res, params) {
    var token = null, username = null;
    for (var i = 0; i < params.length; ++i) {
	if (!_.has(req.params, params[i])) {
            res.send(400, {"code": "BadParams", "message": params[i] + " missing"});
            return false;
	}
        if (params[i] === 'token')
            token = params[i];
        else if (params[i] === 'username')
            username = params[i];
    }
    if (token !== null) {
        var decoded;
        try {
            decoded = jwt.decode(req.params.token, SECRET);
        } catch (err) {
            log.info(err);
            res.send(401, {"code": "BadAuth", "message": "unable to authenticate"});
            return false;
        }
        if (!_.has(decoded, 'username') || decoded.username !== req.params.username) {
            res.send(401, {"code": "BadAuth", "message": "unable to authenticate"});
            return false;
        }
    }
    return true;
}

function authenticateRequest(req, res) {
    var token;
    try {
        token = jwt.decode(req.params.token, SECRET);
    } catch (err) {
        log.info(err);
        res.send(401);
        return false;
    }
    
    if (!_.has(token, 'username') || token.username !== req.params.username) {
        res.send(401);
        return false;
    }
    return true;
}

exports.validateRequest = validateRequest;
exports.authenticateRequest = authenticateRequest;
exports.SECRET = SECRET;
