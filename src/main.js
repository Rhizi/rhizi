define(['textanalysis.ui', 'textanalysis', 'buttons', 'history', 'drag_n_drop', 'robot', 'model/core', 'rz_config', 'rz_core', 'view/selection', 'util'],
function(textanalysis_ui,   textanalysis,   buttons,   history,   drag_n_drop,   robot,   model_core,   rz_config,   rz_core, selection,          util) {

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

        json = util.getParameterByName('json');
        if (json) {
            rz_core.load_from_json(json);
        }

        document.body.onkeyup = function(e) {
            var key = (e.key || (e.charCode && String.fromCharCode(e.charCode))
                             || (e.which && String.fromCharCode(e.which))).toLowerCase();

            if (e.altKey && e.ctrlKey && key == 'i') {
                $('#textanalyser').focus();
            }
            if (e.altKey && e.ctrlKey && key == 'o') {
                $('#search').focus();
            }
        };
        // TODO: move me somewhere
        $('#search').on('input', function(e) {
            var text = this.value,
                r = new RegExp(text.trim()); // TODO fails for quotes
            if (text.length > 0) {
                selection.byVisitors(function (n) { return n.name.match(r); });
            } else {
                selection.clear();
            }
            rz_core.update_view__graph(false);
            e.preventDefault();
        });
        $('#search').on('keypress', function(e) {
            if (e.which == 13) {
                return false;
            }
            return undefined;
        });

        var intro_task_elem = $('#intro-task');
        // TODO: messages (why tasks?) - this one is special but we want them to be handled in their own file.
        if (!localStorage.intro_task_hide) {
            intro_task_elem.show();
        }
        $('#intro-task .task-close-button').click(function(e) {
            localStorage.intro_task_hide = true;
            intro_task_elem.hide();
        });

        // TODO: interaction between the hack above and this
        model_core.init(rz_config);
        textanalysis.init(rz_core.graph);
    }

    return {
        main: main };
    }
);
