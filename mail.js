var nodemailer = require('nodemailer');
var log = require('./utils').log;
var jwt = require('jsonwebtoken');
var utils = require('./utils');
var m = require('./mongoose');

var username = process.env.MANDRILL_USERNAME;
var password = process.env.MANDRILL_APIKEY;

var smtpTransport = nodemailer.createTransport("SMTP",{
    service: "Mandrill",
    auth: {
        user: username,
        pass: password
    }
});

function mail(email, subject, body, cb) {
    var mailOptions = {
        from: "WGAF <no-reply@mail.wgaf.amrav.net",
        to: email,
        subject: subject,
        html: body
    };
    log.info("mail: Sending email to " + email);
    smtpTransport.sendMail(mailOptions, function(error, response){
        if (error) {
            cb(error);
        } else {
            log.info("Message sent: " + response.message);
            cb();
        }
    });
}

function verify(username, email, cb) {
    log.info("mail.js: Sending verification email");
    var token = jwt.encode({username: username}, utils.SECRET, {subject: 'verify'});
    var verifyUrl = utils.API_URL + '/users/' + username + '/verify/' + token;
    var body = '<p>Welcome to WGAF. Please verify your email by going to this link:<br /><a href="' + verifyUrl + '">' + verifyUrl + '</a></p>';
    body += '<p>If you did not sign up for WGAF, please ignore this email. You will not get any further emails from us.</p>';
    mail(email, "Verify your email", body, cb);
}

function forgotPassword(username, email, cb) {
    log.info('mail.js: Sending forgot password email');
    var token = jwt.sign({username: username},
                         utils.SECRET,
                         {
                             subject: 'forgotPassword',
                             expiresInMinutes: 60
                         });
    var forgotUrl = utils.APP_URL + '/@' + username +
            '/change-password?token=' + token;
    var body = '<p>Hi ' + username + '. Someone, probably you, asked for your password to be reset. To reset your password, click this link: <a href="' + forgotUrl + '">' + forgotUrl + '</a></p>';
    body += '<p>If you did not ask to reset your password, please ignore this email.</p>';
    log.info('Email sent: ' + body);
    mail(email, 'Password Reset Email', body, cb);
}

function sendLinks(username, links, email, cb) {
    log.info("mail.js: Sending links to " + email);
    var body = "<p>Hi " + username + ". Here are today's links.</p>";
    body += "<ol>";
    for (var i = 0; i < links.length; i++) {
        body += '<br /><li><a href="' + links[i].url + '">' +
            (links[i].title || links[i].url) + '</a>' +
            ' - <b>' + links[i].username + '</b>' +
            (links[i].summary &&
             (', <i>' + links[i].summary + '</i></li>') ||
             '');
    }
    body += '</ol>';
    mail(email, "Daily Digest", body, cb);
}

function broadcast(req, res, next) {
    if (!utils.validateRequest(req, res, ['username', 'token', 'subject', 'body']))
        return next();
    if (!utils.authenticateRequest(req, res))
        return next();
    if (req.params.username !== 'amrav') {
        res.send(404);
        return next();
    }
    res.send(201);
    next();
    m.User.find({verified: true}, 'username email', function(err, users) {
        if (err) {
            req.log.error(err);
            return;
        }
        utils.asyncForEach(users, function(user, done) {
            mail(user.email, req.params.subject, req.params.body, function(err) {
                req.log.info("Mailed broadcast: " + user.username);
            });
            done();
        }, function() {
            req.log.info("Finished mailing broadcast to " + users.length + " users");
        });
    });
}

exports.mail = mail;
exports.verify = verify;
exports.sendLinks = sendLinks;
exports.broadcast = broadcast;
exports.forgotPassword = forgotPassword;
