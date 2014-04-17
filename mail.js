var nodemailer = require('nodemailer');
var log = require('./utils').log;
var jwt = require('jwt-simple');
var utils = require('./utils');

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

    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            log.error(error);
        }else{
            log.info("Message sent: " + response.message);
            cb();
        }
    });
}

function verify(username, email, cb) {
    log.info("mail.js: Sending verification email");
    var token = jwt.encode({username: username, type: 'verify'}, utils.SECRET);
    var verifyUrl = utils.API_URL + '/users/' + username + '/verify/' + token;
    var body = '<p>Welcome to WGAF. Please verify your email by going to this link:<br /><a href="' + verifyUrl + '">' + verifyUrl + '</a></p>';
    body += '<p>If you did not sign up for WGAF, please ignore this email. You will not get any further emails from us.</p>';
    mail(email, "Verify your email", body, cb);
}

function sendLinks(username, links, email, cb) {
    log.info("mail.js: Sending links to " + email);
    var body = "<p>Hi " + username + ". Here are today's links.</p>";
    body += "<ol>";
    for (var i = 0; i < links.length; i++) {
        body += '<li><a href="' + links[i].url + '">' +
            (links[i].title || links[i].url) + '</a>' +
            ' - <b>' + links[i].username + '</b>' +
            (links[i].summary &&
             (', <i>' + links[i].summary + '</i></li>') ||
             '');
    }
    body += '</ol>';
    mail(email, "Daily Digest", body, cb);
}

exports.mail = mail;
exports.verify = verify;
exports.sendLinks = sendLinks;
