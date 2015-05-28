/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

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
