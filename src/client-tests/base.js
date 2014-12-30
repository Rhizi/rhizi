var fs = require('fs'),
    jsdom = require('jsdom'),
    addScript = require('./test_util').addScript;

function dump_nodes(window) {
    var nodes = window.force.nodes();
    for(var i = 0 ; i < nodes.length; ++i) {
        console.log('nodes[' + nodes[i].id + '/' + nodes[i].type + '].[xy] = (' + nodes[i].x + ',' + nodes[i].y + ')');
    }
}

function dump_graphviz(force) {
    var i;
    var nodes = force.nodes();
    var links = force.links();
    var q = function(s) {
        if (s.search(' ') == -1) {
            return s;
        }
        return '"' + s + '"';
    };

    console.log('digraph {');
    for (i = 0 ; i < nodes.length; ++i) {
        if (nodes[i].type == 'bubble') {
            console.log(' BUBBLE;');
        } else {
            console.log(' ' + q(nodes[i].name) + ';');
        }
    }
    for (i = 0 ; i < links.length; ++i) {
        var link = links[i];
        console.log(' ' + q(link.__src.name) + ' -> ' + q(link.__dst.name) + ' [label=' + link.name + '];');
    }
    console.log('}');
}

function run_tests(settings) {
    var document = jsdom.jsdom('<html><body></body></html>');
    var window = document.parentWindow;

    window.console.log = console.log; // slightly evil
    window.process = process; // more evil
    window.is_node = true;
    if (settings.created) {
        settings.created(undefined, window);
    }
    debugger
    addScript(window, '../client/require.js')
        .load_next('../client/app.js')
        .done(function () {
            console.log('test harness: starting script loading with requirejs');
            console.dir(window.require);
            window.require.config(window.rhizi_require_config);
            window.requirejs(['main'], function(main) {
                console.log('test harness: main loaded');
                main.main();
                if (settings.done) {
                    settings.done(undefined, window);
                }
                process.quit();
            });
        });
    //window.setInterval(function() { console.log('.'); return true; }, 100);
}

function reset(window) {
    window.require('rz_core').graph.clear();
}

function nodes(window) {
    return window.require('rz_core').force.nodes().map(function (n) {
        return n.name;
    });
}

function links(window) {
    return window.require('rz_core').force.links().map(function (l) {
        debugger;
        return [l.__src.name, l.__dst.name, l.name];
    });
}

exports.run_tests = run_tests;
exports.dump_graphviz = dump_graphviz;
exports.reset = reset;
exports.links = links;
exports.nodes = nodes;
