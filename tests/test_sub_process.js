var spawn = require('child_process').spawn;

var ls = spawn('ls');
ls.stdout.on('data', function (data) {
    console.log('stdout ' + data.length);
});
ls.on('close', function(code, signal) {
    console.log('closed, ' + code + ', ' + signal);
});
