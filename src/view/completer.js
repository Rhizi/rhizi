define(
['jquery', 'Bacon'],
function($, Bacon) {

function unquoted(name)
{
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

function setCaret(e, num)
{
    e.selectionStart = e.selectionEnd = num;
}

var completer = (function (input_element, dropdown, base_config) {
    var config = get_config(base_config),
        dropdown_raw = dropdown[0],
        options_bus = new Bacon.Bus(),
        options = [],
        selected_index = -1,
        input_element_raw = input_element[0],
        completion_start = 0,
        completion_end = 0,
        minimum_length = 1;

    // turn off the browser's autocomplete
    input_element.attr('autocomplete', 'off');

    //$('.ui-autocomplete').css('width', '10px');
    options_bus.onValue(function update_options(new_options) {
        options = new_options;
    });

    input_element.keyup(function(e) {
        var ret = undefined;
        switch (e.keyCode) {
        case 38: //UP
            prev_option();
            ret = false;
            break;
        case 40: //DOWN
            next_option();
            ret = false;
            break;
        default:
            // This catches cursor move due to keyboard events. no event for cursor movement itself
            // below we catch cursor moves due to mouse click
            oninput(input_element_raw.value, input_element_raw.selectionStart);
        }
        return ret;
    });
    input_element.keydown(function(e) {
        switch (e.keyCode) {
        case 38:
        case 40:
            return false;
        }
    });

    function get_config(base) {
        return {
            triggerStart: base && base.triggerStart || '#',
            triggerEnd: base && base.triggerEnd || ' ',
        };
    }

    function completions(text)
    {
        var ret = [],
            noquotes = unquoted(text.toLowerCase());

        for (var name in options) {
            if (name.toLowerCase().indexOf(noquotes) === 0) {
                ret.push(name);
            }
        }
        return ret;
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
        var hash = text.slice(0, cursor).lastIndexOf(config.triggerStart);
        // TODO check if current completion has been invalidated
        _invalidateSelection();
        dropdown.hide();
        dropdown_raw.innerHTML = ""; // remove all elements
        if (hash == -1 && config.triggerStart != ' ') { // space matches start of string too
            return;
        }
        var space = text.slice(hash + 1).indexOf(config.triggerEnd);
        space = space == -1 ? text.length : space;
        if (space < cursor) {
            return;
        }
        completion_start = hash + 1;
        completion_end = space;
        var string = text.slice(completion_start, completion_end);
        if (string.length < minimum_length) {
            return;
        }
        // [hash] [cursor] [space/end]
        completions(string).forEach(function(name) {
            dropdown.append($('<div class="suggestion-item">' + name + '</div>'));
        });
        dropdown.children().each(function (index, elem) {
            elem.onclick = function() { _applySuggestion(index); };
            input_element.focus();
        });
        if (dropdown.children().length > 0) {
            dropdown.show();
        }
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
        var s = dropdown.children()[index].innerText;
        if (s.indexOf(' ') != -1) {
            return '"' + s + '"';
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
    function _applySuggestion(index) {
        var cur = input_element.val(),
            start = cur.slice(0, completion_start) + _get_option(index) + ' ';
        input_element.val(start + cur.slice(completion_end));
        setCaret(input_element, start.length);
        oninput('', 0);
    }
    function handleEnter() {
        if (selected_index == -1) {
            return false;
        }
        _applySuggestion(selected_index);
        return true;
    }

    return {
        options: options_bus,
        oninput: oninput,
        next_option: next_option,
        prev_option: prev_option,
        handleEnter: handleEnter,
    };
});

return completer;

});
