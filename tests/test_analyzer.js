var fs = require('fs'),
    jsdom = require('jsdom');

var script_filenames = [
               "external/scripts/d3/d3.js",
               "external/scripts/jquery.js",
               "external/scripts/jquery-ui.js",
               "external/scripts/autocomplete.js",

               "scripts/caret.js",
               "scripts/history.js",
               "scripts/rhizicore.js",
               "scripts/textanalysis.js",
               "scripts/textanalysis-ui.js",
               "scripts/buttons.js",
               "scripts/drag_n_drop.js",
               "scripts/robot.js",
               "scripts/watchdog.js",
               "scripts/gant.js"].map(function(x) { return "../" + x; });

function dump_nodes(window) {
    var nodes = window.force.nodes();
    for(var i = 0 ; i < nodes.length; ++i) {
        console.log('nodes[' + nodes[i].id + '/' + nodes[i].type + '].[xy] = (' + nodes[i].x + ',' + nodes[i].y + ')');
    }
}

function dump_graphviz(window) {
    var i;
    var nodes = window.force.nodes();
    var links = window.force.links();
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
        console.log(' ' + q(link.source.name) + ' -> ' + q(link.target.name) + ';');
    }
    console.log('}');
}

var done = function (errors, window) {
    window.analyzeSentence(process.argv.join(" "), true);
    dump_graphviz(window);
    process.exit();
}

var env = jsdom.env({
    scripts: script_filenames,
    html: "<html><body></body></html>",
    created: function(errors, window) {
        window.console.log = console.log; // slightly evil
        window.process = process; // more evil
    },
    done: done});
