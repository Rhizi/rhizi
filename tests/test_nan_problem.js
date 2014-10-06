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

function feed_sentence(window, s, finalize)
{
    var i;
    console.log('******* feeding: ' + s);
    for (i = 1 ; i <= s.length; ++i) {
        console.log('======= ' + s.substr(0, i));
        window.analyzeSentence(s.substr(0, i), false);
    }
    if (finalize) {
        window.analyzeSentence(s, true);
    }
}

function dump_nodes(window) {
    var nodes = window.force.nodes();
    for(var i = 0 ; i < nodes.length; ++i) {
        console.log('nodes[' + nodes[i].id + '/' + nodes[i].type + '].[xy] = (' + nodes[i].x + ',' + nodes[i].y + ')');
    }
}

var env = jsdom.env({
    scripts: script_filenames,
    html: "<html><body></body></html>",
    created: function(errors, window) {
        window.console.log = console.log; // slightly evil
        window.process = process; // more evil
    },
    done: function (errors, window) {
        var i;
        var s1 = "#a";
        var s2 = "#a is";
        var nodes;

        window.force
              .nodes(window.nodes)
              .links(window.links)
              .alpha(0.1)
              .start();
        console.log('---------');
        console.log(errors);
        console.log('---------');
        //console.log(window.textAnalyser2("#a"));
        feed_sentence(window, s1, true);
        dump_nodes(window);
        feed_sentence(window, s2, false);
        console.log(window.force.alpha());
        dump_nodes(window);
        debugger;
        window.force.tick();
        console.log(window.force.alpha());
        dump_nodes(window);
        //console.log(window.nodes);
        //console.log(window.links);
        process.exit();
        window.debug_print(window.force);
        //process.exit();
    }
});
