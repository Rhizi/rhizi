define(['textanalysis.ui', 'textanalysis', 'buttons', 'history', 'drag_n_drop', 'robot', 'model/core', 'rz_config', 'rz_core', 'view/selection', 'util', 'view/completer'],
function(textanalysis_ui,   textanalysis,   buttons,   history,   drag_n_drop,   robot,   model_core,   rz_config,   rz_core, selection,          util,   completer) {

    function expand(obj){
        if (!obj.savesize) {
            obj.savesize = obj.size;
        }
        obj.size = Math.max(obj.savesize, obj.value.length);
    }

    function get_user_initials() {
        var words = logged_username.split(' '),
            first_initial = words.length >= 1 && words[0].length >= 1 ? words[0][0] : ' ',
            second_initial = words.length >= 2 && words[1].length >= 1 ? words[1][0] : (words.length >= 1 && words[0].length > 1 ? words[0][1] : '_');

        return (first_initial + second_initial).toUpperCase();
    }

    function update_username_ui() {
        // logged_username is defined in the body via a template server set variable
        $('.profile-initials').html(get_user_initials());
        $('#user_id').html(logged_username);
    }

    this.main = function() {
        var json,
            search = $('#search'),
            search_completer = completer(search, $('#search-suggestion'),
                {triggerStart:' ', triggerEnd:' '});

        console.log('Rhizi main started');
        search_completer.options.plug(textanalysis.suggestions_options);
        drag_n_drop.init();
        $('#editname').onkeyup = function() { expand(this); };
        $('#editlinkname').onkeyup = function() { expand(this); };
        $('#textanalyser').onkeyup = function() { expand(this); };

        textanalysis_ui.main();

        update_username_ui();

        json = util.getParameterByName('json');
        if (json) {
            rz_core.load_from_json(json);
        }
        if (util.getParameterByName('debug')) {
            $(document.body).addClass('debug');
            rz_core.edit_graph.set_user('fakeuser');
            rz_core.main_graph.set_user('fakeuser');
        }

        document.body.onkeyup = function(e) {
            var key = (e.key || (e.charCode && String.fromCharCode(e.charCode))
                             || (e.which && String.fromCharCode(e.which))).toLowerCase();

            if (e.altKey && e.ctrlKey && key == 'i') {
                $('#textanalyser').focus();
            }
            if (e.altKey && e.ctrlKey && key == 'o') {
                search.focus();
            }
            if (e.ctrlKey && key == 'z' && e.target.nodeName !== 'INPUT') {
                // TODO: rz_core.main_graph.undo();
            }
        };
        // TODO: move me somewhere
        function search_on_submit() {
            var text = search[0].value.trim(),
                r;

            try {
                r = new RegExp(text.replace(/ /, '|'), 'i');
            } catch (e) {
                return; // don't clear selection either
            }
            if (text.length > 0) {
                selection.byVisitors(function (n) { return n.name.match(r); });
            } else {
                selection.clear();
            }
            rz_core.update_view__graph(false);
        };
        search.on('input', search_on_submit);
        search.on('keydown', function(e) {
            if (e.which == 13 && !search_completer.handleEnter()) {
                e.preventDefault();
                search_on_submit(e);
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
        textanalysis.init(rz_core.main_graph);
    }

    return {
        main: main };
    }
);
