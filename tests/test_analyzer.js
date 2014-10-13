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

var data = [
["#a hello there #b", ["a", "b"], [["a", "b", "hello there"]],
["#a hello there2 #ba", ["a", "ba"], ["a", "ba", "hello there2"]]],
["#c and #d like #e", ["c", "d", "e"], [["c", "e", "like"], ["d", "e", "like"]]],
["#f and #g and #h are cool", ["f", "g", "h", "are cool"], [["f", "are cool", ""], ["g", "are cool", ""], ["h", "are cool", ""]]], // the are should be a label actually, but harder to do.
["#i likes #j and #k", ["i", "j", "k"], ["i", "j", "likes"], ["i", "k", "likes"]],
["#q likes #r but doesn't like #l", ["q", "r", "l"], []],
];
/*
#t and #u like #v
#w #x #y
sometimes #z and #ab aren't friends
I like to work with #a
*/


var done = function (errors, window) {
    debugger;
    if (process.argv.length > 2) {
        window.analyzeSentence(process.argv.slice(2).join(" "), true);
        dump_graphviz(window);
    }
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
