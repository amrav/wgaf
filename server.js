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

var server = restify.createServer({
    name: "wgaf",
});

server.pre(function (request, response, next) {
    var ip = request.headers['x-forwarded-for'] ||
        request.connection.remoteAddress ||
        request.socket.remoteAddress ||
        request.connection.socket.remoteAddress;
    log.info(request.method + " " + request.url + " from " + ip);
    return next();
});

server.pre(restify.pre.userAgentConnection());

server.on('after', function(request, response, route) {
    if (response.header('Content-Type') === 'application/json')
        log.info({"Response body": response._body});
    log.info("Finish " + request.method + " " + request.url);
});

server.on('uncaughtException', function(request, response, route, error) {
    log.error(error);
    response.send(500);
    log.error("Couldn't serve %s %s", request.method, request.url);
});

server.use(restify.CORS());
server.use(restify.fullResponse());
server.use(restify.bodyParser());

server.use(function(request, response, next) {
    if (!_.has(request, 'header') ||
        !request.header('Content-Type').match('application/json') &&
        !request.header('Content-Type').match('x-www-form-urlencoded'))
        return next();
    if (_.has(request, 'params') && request.params !== null)
        if (_.has(request.params, 'password')) {
            var safeParams = _.omit(request.params, 'password');
            safeParams.password = '**********';
            log.info({"Request params": safeParams});
        } else
            log.info({"Request params": request.params});
    return next();    
});

server.post('/users', user.new_);
server.del('/users/:username', user.del);
server.post('/users/:username/sessions', user.login);
server.post('/users/:username/following', user.follow);
server.get('/users/:username/verify/:verify', user.verify);
server.post('/users/:username/links', link.new_);
server.post('/send_links', link.sendLinksTest);

var port = Number(process.env.PORT || 7777);
server.listen(port, function() {
    log.info('%s listening at %s', server.name, server.url);
});
