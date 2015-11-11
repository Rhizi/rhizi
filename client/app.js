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

(function() {

    var lib_path = '/static/lib/';
    var fragmentd_path = '${fragment_d_path}'; // [!] see README.md#Deployment note

    var config = {
        shim: {
            'socketio': { exports: 'io' },
            'Bacon': {
                deps: ['jquery'],
                exports: 'Bacon',
            }
        },
        paths: {
            autocomplete: lib_path + 'autocomplete',
            Bacon: lib_path + 'Bacon',
            caret: lib_path + 'caret',
            cola: lib_path + 'cola',
            domain_types: fragmentd_path + '/js/domain_types',
            d3: lib_path + 'd3/d3',
            feedback: lib_path + 'feedback',
            FileSaver: lib_path + 'FileSaver',
            html2canvas: lib_path + 'html2canvas',
            jquery: lib_path + 'jquery',
            socketio: lib_path + 'socket.io/socket.io.min_0.9.10',
            underscore: lib_path + 'underscore',
        }
    }

    if (rz_config.optimized_main) {
        config.paths.main = 'main-built';
    }
    config.urlArgs = typeof local_config != 'undefined' ? local_config.urlArgs : RZ_VERSION;

if (window.is_node) {
    // Testing path only
    console.log('app: running under node');
    config.baseUrl = '../src/';
    window.rhizi_require_config = config;
} else {
    // [!] no need to configure baseUrl, as in
    //     config.baseUrl = ...
    //     generated script URLs include the basepath of app.js

    // Main app path
    require.config(config);

    requirejs(['main'], function(main) {
        console.log('starting rhizi logic');
        main.main();
    });
}
}());
