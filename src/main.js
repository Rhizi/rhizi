define(['jquery', 'textanalysis.ui', 'buttons', 'history', 'drag_n_drop', 'robot', 'rz_core'],
function($,        textanalysis_ui,   buttons,   history,   drag_n_drop,   robot,   rz_core) {

    function getParameterByName(name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    function expand(obj){
        if (!obj.savesize) {
            obj.savesize = obj.size;
        }
        obj.size = Math.max(obj.savesize, obj.value.length);
    }

    this.main = function() {
        var json;

        console.log('Rhizi main started');
        drag_n_drop.init();
        $('#editname').onkeyup = function() { expand(this); };
        $('#editlinkname').onkeyup = function() { expand(this); };
        $('#textanalyser').onkeyup = function() { expand(this); };

        textanalysis_ui.main();
        // TODO: jquery BBQ: $.deparam.querystring().json;
        json = getParameterByName('json');
        if (json) {
            rz_core.load_from_json(json);
        }
    }
    
    return {
        main: main };
    }
);
