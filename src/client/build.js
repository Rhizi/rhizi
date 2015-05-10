({
    baseUrl: ".",
    shim: {
        'socketio': { exports: 'io' },
    },
    paths: {
        autocomplete: '../../res/client/lib/autocomplete',
        caret: '../../res/client/lib/caret',
        Bacon: '../../res/client/lib/Bacon',
        d3: '../../res/client/lib/d3/d3',
        FileSaver: '../../res/client/lib/FileSaver',
        jquery: '../../res/client/lib/jquery',
        socketio: '../../res/client/lib/socket.io/socket.io.min_0.9.10',
        html2canvas: '../../res/client/lib/html2canvas',
        underscore: '../../res/client/lib/underscore',
        feedback: '../../res/client/lib/feedback',
    },
    name: "main",
    out: "main-built.js",
    optimize: "uglify2",
    generateSourceMaps: true,
    preserveLicenseComments: false,
})
