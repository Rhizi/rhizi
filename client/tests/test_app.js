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

// mocks just to all run_tests to succeed
if (typeof define == 'undefined') {
    function define(mod, cb) {
    }
}
if (typeof document == 'undefined') {
    var document = {};
}

(function() {
var config = {
    //urlArgs: "bust=" + (new Date()).getTime(), // NOTE: useful for debugging
    paths: {
        jquery: 'external/jquery',
        'jquery-ui': 'external/jquery-ui',
        caret: 'external/caret',
        'd3': 'external/d3/d3',
        autocomplete: 'external/autocomplete',
        FileSaver: 'external/FileSaver',
    }
}

define('test', function() {
    console.log('hello from test factory');
    return {f:function(){console.log(42);}};
});

console.log('test_app: running under node');
config.baseUrl = '../src/';

document.config = config;
}());
