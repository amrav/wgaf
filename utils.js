var _ = require('underscore');
var jwt = require('jwt-simple');
var SECRET = process.env.SECRET || "foobar";

function validateRequest(req, res, params) {
    for (var i = 0; i < params.length; ++i) {
	if (!_.has(req.params, params[i])) {
            res.send(400, {"code": "BadParams", "message": "required params missing"});
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
        res.send(403);
        return false;
    }
    
    if (!_.has(token, 'username') || token.username !== req.params.username) {
        res.send(403);
        return false;
    }
    return true;
}

exports.validateRequest = validateRequest;
exports.authenticateRequest = authenticateRequest;
exports.SECRET = SECRET;
