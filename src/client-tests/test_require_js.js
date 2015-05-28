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

var jsdom = require("jsdom").jsdom;
var document = jsdom();
var window = document.parentWindow;
var addScript = require('./test_util').addScript;

window.console.log = console.log;
window.is_node = true;

addScript(window, '../src/external/require.js')
    .load_next('test_app.js')
    .done(function () {
        var config = document.config
        var requirejs = window.requirejs;
        var require = window.require;
        console.log('callback after test_app.js loading');
        console.log(config);
        require.config(config);
        requirejs(['require', 'test', './test2.js', 'main'], function(require, test, test2, main) {
            console.log('here we are after test_app prerequisites');
            debugger;
            test.f();
            main.main();
            process.exit();
        });
    });
