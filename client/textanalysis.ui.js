/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

define(['jquery', 'Bacon', 'consts', 'rz_bus', 'rz_core', 'textanalysis', 'util', 'view/textanalyser_input', 'model/types'],
function($,        Bacon ,  consts ,  rz_bus ,  rz_core ,  textanalysis ,  util,        textanalyser_input,   model_types) {

var element_name = '#textanalyser',
    input = textanalyser_input({
        'element_name': element_name,
        'completer_name': '#input-suggestion'
        }),
    description = consts.description,
    input_bus = new Bacon.Bus();

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
    };
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
        e_intro.show();
        e_label.show();
        e_desc.show();
        e_name.html(model_types.node_titles[textanalysis.selected_type()]);
        e.show();
    };
    typeselection.hide = function() {
        e.hide();
    };
    typeselection.showChosenType = function(node_id, nodetype) {
        var desc = description[nodetype];

        if (document.getElementById(node_id) === null) {
            return;
        }
        attach_to(node_id);
        e_intro.hide();
        e_label.show();
        e_name.html(model_types.node_titles[nodetype]);
        if (desc) {
            e_desc.html(description[nodetype]);
            e_desc.show();
        } else {
            e_desc.hide();
        }
    };
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

    if (finalize || sentence.length === 0) {
        typeselection.hide();
    } else {
        rz_core.main_graph_view.nodes__user_visible(ret.existing_nodes(rz_core.main_graph));
    }
    input_bus.push({where: consts.INPUT_WHERE_TEXTANALYSIS, input: sentence});
}

function changeType(up)
{
    var cursor = input.selectionStart(),
        lastnode = textanalysis.lastnode(rz_core.edit_graph, cursor),
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
    input.on_cursor.onValue(function (cursor) {
        var lastnode = textanalysis.lastnode(rz_core.edit_graph, cursor);

        if (lastnode === null) {
            return;
        }
        textanalysis.selected_type_set(lastnode.type);
        typeselection.showChosenType(lastnode.id, lastnode.type);
    });
    input.on_type.onValue(function (up) {
            if (textanalysis.lastnode(rz_core.edit_graph, input.selectionStart())) {
                changeType(up);
            }
        });

    function submitNewSentence(text) {
        console.log('submitting: ' + text);
        analyzeSentence(
            {
                sentence: text,
                finalize: true
            });
    }

    rz_bus.ui_input.plug(input_bus);
};

return {
        analyzeSentence: analyzeSentence,
        main: main
       };
}); // define
