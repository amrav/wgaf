var restify = require('restify');
var _ = require('underscore');
var bunyan = require('bunyan');
var user = require('./user');
var link = require('./link');

/*
 * Set up logging
 */

var log = bunyan.createLogger({
    name: 'wgaf',
    streams: [
	{
            stream: process.stdout,
            level: 'info'
	},
    ],
    serializers: {
	req: bunyan.stdSerializers.req,
	res: bunyan.stdSerializers.res
    }
});

var server = restify.createServer({
    name: "wgaf",
});

server.pre(function (request, response, next) {
    log.info({req: request});
    return next();
});

server.pre(restify.pre.userAgentConnection());

server.on('after', function(request, response, route) {
    log.info({"Response body": response._body});
    log.info({res: response});
});

server.on('uncaughtException', function(request, response, route, error) {
    log.error(error);
    response.send(500);
    log.error("Couldn't serve %s %s", request.method, request.url);
});

/* ----- */

server.use(restify.CORS());
server.use(restify.fullResponse());
server.use(restify.bodyParser());

server.use(function(request, response, next) {
    if (_.has(request, 'params') && request.params !== null)
        log.info({"Request params": request.params});
    return next();
});

server.post('/users', user.new_);
server.del('/users/:username', user.del);
server.post('/users/:username/sessions', user.login);
server.post('/users/:username/following', user.follow);
server.post('/users/:username/links', link.new_);
server.post('/send_links', link.sendLinksTest);

var port = Number(process.env.PORT || 7777);
server.listen(port, function() {
    log.info('%s listening at %s', server.name, server.url);
});
