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

var server = restify.createServer({
    name: "wgaf",
    log: log
});

server.pre(restify.pre.userAgentConnection());

server.pre(function (request, response, next) {
    if (request.url === '/ping')
        return response.send(200);
    request.log.info({req: request}, 'start');
    return next();
});

server.on('after', function(request, response, route) {
    request.log.info({res: response}, 'finished');
});

server.on('uncaughtException', function(request, response, route, error) {
    request.log.error({err: error},
                      "Couldn't serve %s %s", request.method, request.url);
    response.send(500);
});

server.use(restify.CORS());
server.use(restify.fullResponse());
server.use(restify.bodyParser());

server.use(function(request, response, next) {
    if (_.has(request, 'params') && request.params !== null)
        if (_.has(request.params, 'password')) {
            var safeParams = _.omit(request.params, 'password');
            safeParams.password = '**********';
            request.log.info({params: safeParams});
        } else
            request.log.info({params: request.params});
    return next();
});

server.post('/users', user.new_);
server.del('/users/:username', user.del);
server.post('/users/:username/sessions', user.login);
server.post('/users/:username/following', user.follow);
server.get('/users/:username/verify/:verify', user.verify);
server.post('/users/:username/links', link.new_);
server.post('/send_links', link.sendLinksTest);
server.post('/broadcast', mail.broadcast);

var port = Number(process.env.PORT || 7777);
server.listen(port, function() {
    log.info('%s listening at %s', server.name, server.url);
});

