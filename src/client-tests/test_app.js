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
