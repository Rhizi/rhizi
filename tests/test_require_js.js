var jsdom = require("jsdom").jsdom;
var document = jsdom();
var window = document.parentWindow;
var addScript = require('./test_util').addScript;

window.console.log = console.log;
window.is_node = true;

addScript(window, '../scripts/external/require.js')
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
