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

define(
['jquery', 'Bacon', 'util', 'consts'],
function($, Bacon,   util,   consts) {

var value = util.value,
    selectionStart = util.selectionStart;

// constants
var VK_UP = consts.VK_UP,
    VK_DOWN = consts.VK_DOWN,
    VK_ESCAPE = consts.VK_ESCAPE,
    VK_TAB = consts.VK_TAB;

function quoted__double(string) { // quote string using double quotes
    return '"' + string + '"';
}

function unquoted(name) {
    var start = 0,
        end = name.length;

    if (name.length >= 1) {
        if (name.charAt(0) == '"') {
            start = 1;
            if (name.length > 1 && name.charAt(name.length - 1) == '"') {
                end = name.length - 1;
            }
        }
        return name.substring(start, end);
    }
    return name;
}

function setCaret(e_raw, num)
{
    util.setSelection(e_raw, num, num);
}

var completer = (function (input_element, dropdown, base_config) {
    var config = get_config(base_config),
        dropdown_raw = dropdown[0],
        dropdown_visible = false,
        options_bus = new Bacon.Bus(),
        completionsBus = new Bacon.Bus(),
        options = [],
        selected_index = -1,
        input_element_raw = input_element[0],
        completion_start = 0,
        completion_end = 0,
        minimum_length = 1,
        optional_getter = base_config.getter,
        optional_setter = base_config.setter,
        optional_selectionStart = base_config.selectionStart,
        getter = undefined !== optional_getter ? optional_getter :
                                function () { return util.value(input_element_raw); },
        setter = undefined !== optional_setter ? optional_setter :
                                function (val, caret) {
                                    util.value(input_element_raw, val);
                                    setCaret(input_element_raw, val.length);
                                },
        selectionStart = undefined !== optional_selectionStart ? optional_selectionStart :
                                function () { return util.selectionStart(input_element_raw); };

    // we need an identifier to remove callbacks without affecting other completers
    util.assert(input_element_raw.id !== '');

    // turn off the browser's autocomplete
    input_element.attr('autocomplete', 'off');

    options_bus.onValue(function update_options(new_options) {
        options = new_options;
    });

    input_element.keyup(function(e) {
        var ret = undefined;
        if (e.shiftKey) {
            return ret;
        }
        switch (e.keyCode) {
        case VK_UP: //UP
            prev_option();
            ret = false;
            break;
        case VK_DOWN: //DOWN
            next_option();
            ret = false;
            break;
        case VK_ESCAPE: // Escape
            hide();
            ret = false;
            break;
        default:
            // This catches cursor move due to keyboard events. no event for cursor movement itself
            // below we catch cursor moves due to mouse click
            oninput(getter(), selectionStart());
        }
        return ret;
    });
    input_element.keydown(function(e) {
        switch (e.keyCode) {
        case VK_UP:
        case VK_DOWN:
            return false;
        case VK_TAB: // Tab
            if (config.hideOnTab) {
                hide();
            }
            break;
        }
    });

    function anyof_re(chars)
    {
        return new RegExp('[' + chars.replace('[', '\\[').replace(']', '\\]') + ']');
    }

    function get_config(base) {
        var trigger_start = base && base.triggerStart || rz_config.separator_string,
            trigger_start_is_separator = (undefined === base || undefined === base.triggerStart),
            trigger_end_is_separator = (undefined === base || undefined === base.triggerEnd);
        return {
            triggerStart: (trigger_start_is_separator && rz_config.separator_string.length > 1 ?
                new RegExp(rz_config.separator_string) : anyof_re(trigger_start)),
            triggerEnd: (trigger_end_is_separator && rz_config.separator_string.length > 1 ?
                new RegExp(rz_config.separator_string) : anyof_re(base && base.triggerEnd || ' ')),
            hideOnTab: base && base.hasOwnProperty('hideOnTab') ? base.hideOnTab : true,
            matchStartOfString: (base && base.matchStartOfString) || rz_config.node_edge_separator,
            appendOnCompletion: (base && base.appendOnCompletion) || '',
            quoteSpaceContaining: (base && base.quoteSpaceContaining) || false,
        };
    }

    function completions(text)
    {
        var ret = [];

        for (var name in options) {
            if (name.toLowerCase().indexOf(text.toLowerCase()) !== -1) {
                ret.push(name);
            }
        }
        ret.sort();
        return ret;
    }

    var click_event = 'click.completer.' + input_element_raw.id;
    function hide_on_click(e) {
        hide();
    }

    function show() {
        if (dropdown.children().length > 0 && !dropdown_visible) {
            dropdown_visible = true;
            dropdown.show();
            $(document).on(click_event, "body", hide_on_click);
        }
    }
    function hide()
    {
        dropdown.hide();
        dropdown_visible = false;
        $(document).off(click_event, "body", hide_on_click);
    }

    /**
     * Helper similar to String.lastIndexOf but works with regular expressions
     */
    function lastRegexpIndex(s, r)
    {
        var reversed = s.split('').reverse().join(''); // constly
            index = reversed.search(r);

        if (index == -1) {
            return -1;
        }
        return s.length - 1 - index;
    }

    /***
     * #this is a #
     *             ^
     *
     * #this is a #t
     *              ^
     *
     * #this and #that then #he
     *             ^
     */
    function oninput(text, cursor) {
        var trigger_start_index = lastRegexpIndex(text.slice(0, cursor), config.triggerStart);
        // TODO check if current completion has been invalidated
        _invalidateSelection();
        hide();
        dropdown_raw.innerHTML = ""; // remove all elements
        if (trigger_start_index == -1 && !config.matchStartOfString) {
            return;
        }
        var space = text.slice(trigger_start_index + 1).search(config.triggerEnd);
        space = space == -1 ? text.length : space;
        if (space < cursor) {
            return;
        }
        completion_start = trigger_start_index + 1;
        completion_end = space;
        var string = unquoted(text.slice(completion_start, completion_end));
        if (string.length < minimum_length) {
            return;
        }
        completions(string).forEach(function(name) {
            var suggestion = $('<div class="suggestion-item">' + name + '</div>');
            suggestion.on('click', function(e) {
                // TODO: move to handling element?
                _applySuggestion(name);
                input_element.focus();
            });
            dropdown.append(suggestion);
        });
        show();
    }

    function _invalidateSelection() {
        update_highlighting(-1);
    }

    function _move_option(change, default_value) {
        var next,
            n = dropdown.children().length;

        if (n == 0) {
            return;
        }
        show();
        if (selected_index == -1) {
            next = default_value;
        } else {
            next = (selected_index + change) % n;
        }
        update_highlighting(next);
    }
    function next_option() {
        _move_option(1, 0);
    }
    function prev_option() {
        _move_option(dropdown.children().length - 1, dropdown.children().length - 1);
    }
    function _get_option(index) {
        if (dropdown.children().length <= index) {
            console.log('error: dropdown does not contain index ' + index +
                        ', it has ' + dropdown.children().length + ' elements');
            return '';
        }
        var e = dropdown.children()[index],
            s = e.innerText || e.textContent;
        if (s.indexOf(' ') != -1 && config.quoteSpaceContaining) {
            return quoted__double(s);
        }
        return s;
    }
    function _choice(i) {
        return dropdown.children().eq(i);
    }
    function update_highlighting(new_index) {
        if (selected_index != -1) {
            _choice(selected_index).removeClass('selected');
        }
        if (new_index != -1) {
            _choice(new_index).addClass('selected');
        }
        selected_index = new_index;
    }
    function _applySuggestion(str) {
        var cur = getter(),
            start = cur.slice(0, completion_start) + str + config.appendOnCompletion,
            new_text = start + cur.slice(completion_end);
        setter(new_text, new_text.length);
        oninput('', 0);
        completionsBus.push(str);
    }
    function handleEnter() {
        if (selected_index == -1) {
            return false;
        }
        _applySuggestion(_get_option(selected_index));
        return true;
    }

    return {
        // input bus
        options: options_bus,
        // output bus
        completionsBus: completionsBus,
        oninput: oninput,
        next_option: next_option,
        prev_option: prev_option,
        handleEnter: handleEnter,
    };
});

return completer;

});
