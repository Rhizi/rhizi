var fs = require('fs');
var spawn = require('child_process').spawn;

var tests = fs.readdirSync('.').filter(function (x) { return /^test_.*\.js$/.test(x); });
var i;
var testname;

function store_output(proc, args, stdout, stderr)
{
    var out = fs.openSync(stdout, 'w+');
    var err = fs.openSync(stderr, 'w+');
    var p = spawn(proc, args);

    p.stdout.on('data', function (data) {
        console.log(args + ' gives ' + data.length);
        fs.appendFileSync(stdout, data);
    });
    p.stderr.on('data', function (data) {
        console.log(args + ' gives ' + data.length + ' (err)');
        fs.appendFileSync(stderr, data);
    });
    p.on('close', function (code, signal) {
        console.log(proc + '(' + args.join(', ') + ') exited with ' + code);
    });

}

for (i in tests) {
    testname = tests[i];
    store_output('/usr/bin/node', [__dirname + '/' + testname], 'output/' + testname + '.stdout', 'output/' + testname + '.stderr');
}
