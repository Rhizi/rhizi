"use strict"

define(['jquery', 'Bacon_wrapper', 'consts', 'rz_bus', 'rz_core', 'textanalysis', 'view/completer', 'util'],
function($,        Bacon         ,  consts ,  rz_bus ,  rz_core ,  textanalysis ,       completer ,  util) {

var text = "", // Last text of sentence
    element_name = '#textanalyser',
    element = $(element_name),
    element_raw = element[0],
    plus_button = $('#btn_add'),
    description = consts.description,
    input = new Bacon.Bus(),
    initial_width = element.width(),
    plus_button_initial_offset = plus_button.offset();

function get_svg__body_position(node_id)
{
    var item = document.getElementById(node_id),
        matrix = item.getScreenCTM();
    return {x: matrix.e, y: matrix.f};
}

var typeselection = function TypeSelectionDialog() {
    var e = $('.type_selection'),
        e_intro = e.find('#type_selection__intro'),
        e_label = e.find('#type_selection__chosen_type_label'),
        e_name = e.find('#type_selection__chosen_type_name'),
        e_desc = e.find('#type_selection__chosen_type_desc'),
        typeselection = {};

    typeselection.analysisNodeStart = function(node_id) {
        typeselection.show(node_id);
    }
    function set_position(node_id)
    {
        var x,
            y,
            node_location;

        node_location = get_svg__body_position(node_id);
        x = node_location.x - 20; // subtract average node size
        y = node_location.y + 25;
        e.css({ left: x,
                top: y,
              });
    }
    typeselection.show = function(node_id) {
        set_position(node_id);
        e_label.hide();
        e_desc.hide();
        e_intro.show();
        e.show();
    }
    typeselection.hide = function() {
        e.hide();
    }
    typeselection.showChosenType = function(node_id, nodetype) {
        var desc = description[nodetype];

        set_position(node_id);
        e_intro.hide();
        e_label.show();
        e_name.html(nodetype);
        if (desc) {
            e_desc.html(description[nodetype]);
            e_desc.show();
        } else {
            e_desc.hide();
        }
    }
    return typeselection;
}();

var analysisCompleter = completer(element, $('#input-suggestion'), {hideOnTab: false});

function analyzeSentence(spec)
{
    util.assert(spec.sentence !== undefined &&
                spec.finalize !== undefined,
                "bad input");

    var sentence = spec.sentence,
        finalize = spec.finalize,
        ret = textanalysis.textAnalyser(spec),
        lastnode;

    ret.applyToGraph({
        main_graph: rz_core.main_graph,
        edit_graph: rz_core.edit_graph,
        backend_commit: rz_config.backend_enabled,
    });

    switch (ret.state) {
    case textanalysis.ANALYSIS_NODE_START:
        lastnode = textanalysis.lastnode(rz_core.edit_graph, element_raw.selectionStart);
        if (lastnode !== null) {
            typeselection.analysisNodeStart(lastnode.id);
        }
        break;
    case textanalysis.ANALYSIS_LINK:
        typeselection.hide();
        break;
    }

    if (finalize || sentence.length == 0) {
        typeselection.hide();
    } else {
        rz_core.main_graph_view.nodes__user_visible(ret.existing_nodes(rz_core.main_graph));
    }
}

function textSelect(inp, s, e) {
    e = e || s;
    if (inp.createTextRange) {
        var r = inp.createTextRange();
        r.collapse(true);
        r.moveEnd('character', e);
        r.moveStart('character', s);
        r.select();
    } else if (inp.setSelectionRange) {
        inp.focus();
        inp.setSelectionRange(s, e);
    }
}

function changeType(arg) {
    var lastnode = textanalysis.lastnode(rz_core.edit_graph, element_raw.selectionStart),
        nodetype,
        id,
        name;

    if (!lastnode) {
        name = id = consts.NEW_NODE_NAME;
    } else {
        id = lastnode.id;
        name = lastnode.name;
    }
    nodetype = (arg === 'up'? textanalysis.selected_type_next() : textanalysis.selected_type_prev());

    rz_core.edit_graph.editType(id, nodetype);
    typeselection.showChosenType(id, nodetype);
    textanalysis.set_type(name, nodetype);
}

var main = function ()
{
    if (element.length != 1) {
        return;
    }

    analysisCompleter.options.plug(textanalysis.suggestions_options);

    var document_keydown = new Bacon.Bus();
    rz_bus.ui_key.plug(document_keydown);

    element.keydown(function(e) {
        var ret = undefined;

        switch (e.keyCode) {
        case 13:
            if (!analysisCompleter.handleEnter()) {
                submitNewSentence();
            } else {
                analyzeSentence({
                    sentence: element.val(),
                    finalize: false,
                });
            }
            ret = false;
            break;
        case 9: //TAB
            if (textanalysis.lastnode(rz_core.edit_graph, element_raw.selectionStart)) {
                e.preventDefault();
                changeType(e.shiftKey ? "up" : "down");
                ret = false;
            }
            break;
        }
        document_keydown.push({where: consts.KEYSTROKE_WHERE_TEXTANALYSIS, keys: [e.keyCode]});
        return ret;
    });
    element.bind('input selectionchange click', function(e) {
        analysisCompleter.oninput(element_raw.value, element_raw.selectionStart);
        e.stopPropagation();
        e.preventDefault();
    });

    function submitNewSentence() {
        text = element.val();
        element.val("");
        analyzeSentence({
            sentence: text,
            finalize: true,
            });
        text = "";
    }

    // Click is required to prevent the default action - this is a form so that's a post,
    // and away we go.
    // The mousedown is required because CSS3 transitions eat some events sometimes. This is
    // the closest I've come to an explanation:
    //   http://stackoverflow.com/questions/15786891/browser-sometimes-ignores-a-jquery-click-event-during-a-css3-transform
    plus_button.bind("click mousedown", function(e) {
        console.dir(e);
        submitNewSentence();
        e.preventDefault();
    });

    rz_bus.ui_input.plug(input);
    if ('oninput' in document.documentElement) {
        element.on('input', function(e) {
            analyze_element_text();
        });
    } else {
        console.log('textanalysis.ui: fallback to polling');
        window.setInterval(function() {
            analyze_element_text();
        }, 50);
    }
};

var analyze_element_text = function()
{
    if (element.val() == text) {
        return;
    }
    text = element.val();
    analyzeSentence({
        sentence: text,
        finalize: false,
    });
    input.push({where: consts.INPUT_WHERE_TEXTANALYSIS, input: text});
    stretch_input_to_text_size();
}

function stretch_input_to_text_size()
{
    var new_width = Math.min(Math.max(initial_width, text.length * 9 + 20), $(window).width() * 0.8);

    element.width(new_width);
    plus_button.offset({'left': element.offset().left + element.width() - 18});
}

return {
        analyzeSentence: analyzeSentence,
        main: main
       };
}); // define
