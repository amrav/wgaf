var mongoose = require('mongoose');
var log = require('bunyan').createLogger({name: 'wgaf'});
var bcrypt = require('bcrypt');
var SALT_WORK_FACTOR = 10;

exports.UNIQUE_KEY_ERROR = 11000;

var mongoUri = process.env.MONGOHQ_URL || 'mongodb://localhost/wgaf';
mongoose.connect(mongoUri);

var db = mongoose.connection;
db.on('error', log.error.bind(console, 'connection error:'));

var userSchema = mongoose.Schema({
    username: {type: String, index: {unique: true }, required: true},
    email: {type: String, required: true},
    following: [String],
    followers: [String],
    updated: {type: Date, default: Date.now},
    password: {type: String, required: true}
});

userSchema.pre('save', function(next) {
    var user = this;

    if (!user.isModified('password')) return next();

    bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
        if (err) return next(err);

        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);

            user.password = hash;
            next();
        });
    });
});

userSchema.methods.comparePassword = function(candidate, cb) {
    bcrypt.compare(candidate, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

var User = mongoose.model('User', userSchema);

var linkSchema = mongoose.Schema({
    url: {type: String, required: true},
    title: {type: String, required: true},
    time: {type: Date, default: Date.now, index: true},
    username: {type: String, required: true, index: true}
});

var Link = mongoose.model('Link', linkSchema);

db.once('open', function() {
    log.info('Connected to mongoDB');
});

exports.User = User;
exports.Link = Link;
