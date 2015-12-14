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

({
    baseUrl: ".",
    shim: {
        'socketio': { exports: 'io' },
        'Bacon': {
            deps: ['jquery'],
            exports: 'Bacon',
        }
    },
    paths: {
        autocomplete: '../res/client/lib/autocomplete',
        Bacon: '../res/client/lib/Bacon',
        caret: '../res/client/lib/caret',
        domain_types: '../res/local/js/domain_types',
        d3: '../res/client/lib/d3/d3',
        feedback: '../res/client/lib/feedback',
        FileSaver: '../res/client/lib/FileSaver',
        html2canvas: '../res/client/lib/html2canvas',
        jquery: '../res/client/lib/jquery',
        socketio: '../res/client/lib/socket.io/socket.io.min_0.9.10',
        underscore: '../res/client/lib/underscore',
    },
    name: "main",
    out: "main-built.js",
    optimize: "uglify2",
    generateSourceMaps: true,
    preserveLicenseComments: false,
})
