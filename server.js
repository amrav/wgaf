if (process.env.NODETIME_ACCOUNT_KEY) {
    require('nodetime').profile({
        accountKey: process.env.NODETIME_ACCOUNT_KEY,
        appName: process.env.APP_NAME
    });
}

var restify = require('restify');
var _ = require('underscore');
var bunyan = require('bunyan');
var user = require('./user');
var link = require('./link');
var log = require('./utils').log;
var mail = require('./mail');
var auth = require('./auth');
var restifyJwt = require('restify-jwt');
var utils = require('./utils');

var server = restify.createServer({
    name: "wgaf",
    log: log
});

server.pre(restify.pre.userAgentConnection());

server.pre(function (request, response, next) {
    if (request.url === '/ping')
        return response.send(200);
    request.log.debug({req: request}, 'start');
    return next();
});

server.on('after', function(request, response, route) {
    request.log.debug({res: response}, 'finished');
});

server.on('uncaughtException', function(request, response, route, error) {
    request.log.error({err: error},
                      "Couldn't serve %s %s", request.method, request.url);
    response.send(500);
});

restify.CORS.ALLOW_HEADERS.push('authorization');
server.use(restify.CORS());
server.use(restify.fullResponse());
server.use(restify.queryParser());
server.use(restify.bodyParser());

server.use(function(request, response, next) {
    if (_.has(request, 'params') && request.params !== null)
        if (_.has(request.params, 'password')) {
            var safeParams = _.omit(request.params, 'password');
            safeParams.password = '**********';
            request.log.debug({params: safeParams});
        } else
            request.log.debug({params: request.params});
    return next();
});

var jwtAuth = restifyJwt({secret: utils.SECRET});

server.post('/users', user.new_);
server.get('/users', user.search);
server.del('/users/:username', jwtAuth, user.del);
server.post('/users/:username/following', jwtAuth, user.follow);
server.get('/users/:username/verify/:verify', user.verify);
server.post('/users/:username/links', jwtAuth, link.new_);
server.get('/users/:username/links', jwtAuth, link.get);
server.post('/send_links', jwtAuth, link.sendLinksTest);
server.post('/broadcast', jwtAuth, mail.broadcast);
server.post('/auth', auth.getAccessToken);

var port = Number(process.env.PORT || 7777);
server.listen(port, function() {
    log.info('%s listening at %s', server.name, server.url);
});
