(function() {
    var lib_path = '../lib/';
    var config = {
        paths: {
            jquery: lib_path + 'jquery',
            'jquery-ui': lib_path + 'jquery-ui',
            'd3': lib_path + 'd3/d3',
            FileSaver: lib_path + 'FileSaver',
            caret: lib_path + 'caret',
            autocomplete: lib_path + 'autocomplete',
        }
    }

    config.urlArgs = (typeof local_config != 'undefined') && local_config.urlArgs;

if (window.is_node) {
    // Testing path only
    console.log('app: running under node');
    config.baseUrl = '../scripts/';
    window.rhizi_require_config = config;
} else {
    // Main app path
    require.config(config);

    requirejs(['main'], function(main) {
        console.log('starting rhizi logic');
        main.main();
    });
}
}());
