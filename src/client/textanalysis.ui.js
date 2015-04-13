"use strict"

define(['jquery', 'Bacon', 'consts', 'rz_bus', 'rz_core', 'textanalysis', 'util', 'view/textanalyser_input'],
function($,        Bacon         ,  consts ,  rz_bus ,  rz_core ,  textanalysis ,  util,        textanalyser_input) {

var element_name = '#textanalyser',
    input = textanalyser_input({
        'element_name': element_name,
        'completer_name': '#input-suggestion',
        }),
    plus_button = $('#btn_add'),
    description = consts.description,
    input_bus = new Bacon.Bus(),
    plus_button_initial_offset = plus_button.offset();

function get_svg__body_position(node_id)
{
    var item = document.getElementById(node_id),
        matrix = item.getScreenCTM();
    return {x: matrix.e, y: matrix.f};
}

var typeselection = function TypeSelectionDialog() {
    var fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject'),
        e = $('.type_selection'),
        e_intro = e.find('#type_selection__intro'),
        e_label = e.find('#type_selection__chosen_type_label'),
        e_name = e.find('#type_selection__chosen_type_name'),
        e_desc = e.find('#type_selection__chosen_type_desc'),
        typeselection = {};

    fo.setAttribute('width', 400);
    fo.setAttribute('height', 200);

    fo.appendChild(e[0]);
    typeselection.analysisNodeStart = function(node_id) {
        typeselection.show(node_id);
    }
    function attach_to(node_id) {
        var node = document.getElementById(node_id);

        if (node === undefined) {
            console.log('cannot show type selection since node does not exist: ' + node_id);
            return;
        }
        node.appendChild(fo);
    }
    typeselection.show = function(node_id) {
        if (document.getElementById(node_id) === null) {
            return;
        }
        attach_to(node_id);
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

        if (document.getElementById(node_id) === null) {
            return;
        }
        attach_to(node_id);
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

function analyzeSentence(spec)
{
    util.assert(spec.sentence !== undefined &&
                spec.finalize !== undefined,
                "bad input");

    var sentence = spec.sentence,
        finalize = spec.finalize,
        ret = textanalysis.textAnalyser({'sentence': sentence, 'finalize': finalize}),
        lastnode;

    ret.applyToGraph({
        main_graph: rz_core.main_graph,
        edit_graph: rz_core.edit_graph,
        backend_commit: rz_config.backend_enabled,
    });

    switch (ret.state) {
    case textanalysis.ANALYSIS_NODE_START:
        lastnode = textanalysis.lastnode(rz_core.edit_graph, input.selectionStart());
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
    input_bus.push({where: consts.INPUT_WHERE_TEXTANALYSIS, input: sentence});
}

function changeType(up)
{
    var lastnode = textanalysis.lastnode(rz_core.edit_graph, input.selectionStart()),
        nodetype,
        id,
        name;

    if (!lastnode) {
        name = id = consts.NEW_NODE_NAME;
    } else {
        id = lastnode.id;
        name = lastnode.name;
    }
    nodetype = (up ? textanalysis.selected_type_next() : textanalysis.selected_type_prev());

    rz_core.edit_graph.editType(id, nodetype);
    typeselection.showChosenType(id, nodetype);
    textanalysis.set_type(name, nodetype);
}

var main = function ()
{
    input.on_sentence.onValue(submitNewSentence);
    input.on_analysis__input.onValue(function (sentence) {
            input.on_analysis__output.push(analyzeSentence({
                sentence: sentence,
                finalize: false,
            }));
        });
    input.on_type.onValue(function (up) {
            if (textanalysis.lastnode(rz_core.edit_graph, input.selectionStart())) {
                changeType(up);
                ret = false;
            }
        });

    function submitNewSentence(text) {
        analyzeSentence(
            {
                sentence: text,
                finalize: true,
            });
    }

    // Click is required to prevent the default action - this is a form so that's a post,
    // and away we go.
    // The mousedown is required because CSS3 transitions eat some events sometimes. This is
    // the closest I've come to an explanation:
    //   http://stackoverflow.com/questions/15786891/browser-sometimes-ignores-a-jquery-click-event-during-a-css3-transform
    plus_button.bind("click mousedown", function(e) {
        console.dir(e);
        submitNewSentence(input.value());
        e.preventDefault();
    });

    input.on_resize.onValue(function () {
        plus_button.offset({'left': input.element.offset().left + input.element.width() - 18});
    });

    rz_bus.ui_input.plug(input_bus);
};

return {
        analyzeSentence: analyzeSentence,
        main: main
       };
}); // define
