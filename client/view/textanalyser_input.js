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

define(['jquery', 'Bacon', 'underscore', 'util', 'view/completer', 'rz_bus', 'textanalysis', 'consts'],
function($,        Bacon,           _,            util,        completer,   rz_bus,   textanalysis,   consts)
{
"use strict";

// Aliases
var value = util.value;

// Constants
var nbsp = String.fromCharCode(160),
    VK_UP = consts.VK_UP,
    VK_DOWN = consts.VK_DOWN,
    VK_ENTER = consts.VK_ENTER;


function textanalyser_input(spec) {
    var selectionStart = function () {
        return util.selectionStart(element_raw);
    };

    function key(val) {
        return function (e) {
            return e.keyCode === val;
        };
    }

    function shift_key(val) {
        return function(e) {
            return e.keyCode === val && e.shiftKey;
        };
    }

    function current_value() {
        return nbsp_to_spaces(value(element_raw));
    }

    function nbsp_to_spaces(str) {
        return str.replace(new RegExp(nbsp, 'g'), ' ');
    }

    function stretch_input_to_text_size(text)
    {
        var new_width = Math.min(Math.max(initial_width, text.length * 9 + 20), $(window).width() * 0.8);

        element.width(new_width);
        ta.on_resize.push();
    }

    function update_element(current_text, input_cursor_location)
    {
        var parts,
            base_parts,
            classes = ['analyser-span-node', 'analyser-span-space-node-link',
                       'analyser-span-link', 'analyser-span-space-link-node'],
            cursor_location = (undefined === input_cursor_location ? selectionStart() : input_cursor_location);

        base_parts = current_text.split(/   */);
        parts = _.flatten(base_parts.slice(0, base_parts.length - 1).map(function (l) { return [l, '  ']; }));
        if (base_parts[base_parts.length - 1].length !== 0) {
            parts.push(base_parts[base_parts.length - 1]);
        }
        function span(text, clazz) {
            return $('<span class="' + clazz + '">' + text.replace(/ /g, nbsp) + '</span>')[0];
        }

        element.text('');
        parts.map(function (part, index) {
           element.append(span(part, classes[index % classes.length]));
        });
        util.setSelection(element_raw, cursor_location, cursor_location);
        stretch_input_to_text_size(current_text);
        return current_text;
    }

    var element_name = spec.element_name,
        ta = {
            spec: spec,
            on_analysis__input: new Bacon.Bus(),
            on_analysis__output: new Bacon.Bus(),
            on_cursor: new Bacon.Bus(),
            on_resize: new Bacon.Bus(),
            element: $(element_name),
            selectionStart: selectionStart,
            value: current_value,
        },
        element = ta.element,
        element_raw = element[0],
        initial_width = element.width(),
        completer_spec = {
            hideOnTab: false,
            getter: current_value,
            setter: function (text, cursor) { update_element(text, cursor); },
            selectionStart: selectionStart,
            appendOnCompletion: '  ',
        },
        analysisCompleter = completer(element, $(spec.completer_name), completer_spec),
        document_keydown = new Bacon.Bus(),
        selectionBus = element.asEventStream('selectstart input keyup').map(selectionStart).skipDuplicates(),
        plus_button = $('#btn_add');

    function first_argument(one) { return one; }

    analysisCompleter.options.plug(
        textanalysis.suggestions_options
        .combine(selectionBus, first_argument)
        .combine(ta.on_analysis__output, first_argument)
        .map(
        function (options) {
            var is_link = textanalysis.element_at_position__is_link(selectionStart());

            return options[is_link ? 'links' : 'nodes'];
        }));

    util.assert(1 === element.length);

    var enters = element.asEventStream('keydown').filter(key(VK_ENTER))
        .map(function (e) {
            var text;
            e.preventDefault();
            e.stopPropagation();

            if (!analysisCompleter.handleEnter()) {
                text = current_value();
                return text;
            } else {
                return false;
            }
        });

    rz_bus.ui_key.plug(document_keydown);

    function prevent_default_and_stop_propagation(e) {
        e.preventDefault();
        e.stopPropagation();
        return e;
    }
    function stream_shift_key(key) {
        return element.asEventStream('keydown')
            .filter(shift_key(key))
            .map(prevent_default_and_stop_propagation);
    }

    // Click is required to prevent the default action - this is a form so that's a post,
    // and away we go.
    // The mousedown is required because CSS3 transitions eat some events sometimes. This is
    // the closest I've come to an explanation:
    //   http://stackoverflow.com/questions/15786891/browser-sometimes-ignores-a-jquery-click-event-during-a-css3-transform
    var plus_clicks = plus_button.asEventStream('click mousedown')
        .map(function (e) {
            e.preventDefault();
        })
        .throttle(100);

    ta.on_resize.onValue(function () {
        plus_button.offset({'left': element.offset().left + element.width() - 18});
    });

    function clear_and_return() {
        var v = current_value();
        value(element_raw, "");
        return v;
    }

    ta.on_sentence = enters
        .filter(function (v) { return v !== false; })
        .merge(plus_clicks)
        .map(clear_and_return);
    ta.on_analysis__input.plug(enters.filter(function (v) { return v === false; }).map(current_value));
    ta.on_type = stream_shift_key(VK_UP).map(true).merge(stream_shift_key(VK_DOWN).map(false));

    element.asEventStream('keydown').onValue(function (e) {
        document_keydown.push({where: consts.KEYSTROKE_WHERE_TEXTANALYSIS, keys: [e.keyCode]});
    });

    element.asEventStream('input selectionchange click').onValue(function (e) {
        analysisCompleter.oninput(current_value(), selectionStart(element_raw));
        e.stopPropagation();
        e.preventDefault();
    });

    ta.on_cursor.plug(element.asEventStream('input keyup click selectionchange').map(function() {
        return selectionStart();}).skipDuplicates());

    ta.on_analysis__input.plug(element.asEventStream('input').map(current_value).map(function (val) {
        return update_element(val);
    }));

    ta.clear = function () {
        value(element_raw, "");
    };

    return ta;
}

return textanalyser_input;
}
);
