var fs = require('fs'),
    jsdom = require('jsdom');

var script_filenames = [
               "d3/d3.v3.min.js",
               "scripts/jquery.js",
               "external/jquery-ui.js",
               "scripts/caret.js",

               "scripts/autocomplete.js",
               "scripts/history.js",
               "scripts/rhizicore.js",
               "scripts/textanalysis.js",
               "scripts/textanalysis-ui.js",
               "scripts/buttons.js",
               "scripts/drag_n_drop.js",
               "scripts/robot.js",
               "scripts/watchdog.js",
               "scripts/gant.js"].map(function(x) { return "../" + x; });

//var scripts = script_filenames.map(function (x) { console.log('reading ' + x); return fs.readFileSync(x); });

var typein = function(window, text) {
    var c;

    for(c in text) {
        console.log(c);
    }
}

var env = jsdom.env({
    //src: scripts,
    scripts: script_filenames,
    //url: "http://localhost:12345/",
    html: "<html><body></body></html>",
    done: function (errors, window) {
        console.log('---------');
        console.log(errors);
        console.log('---------');
        //typein(window, "#a is #b|");
        console.log(window.textAnalyser2("#a"));
        process.exit();
    }
});
