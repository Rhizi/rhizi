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

var completer = (function (input_element, dropdown) {
    var triggerStart = '#',
        triggerEnd = '',
        dropdown_raw = dropdown[0],
        options_bus = new Bacon.Bus(),
        options = [],
        selected_index = -1,
        input_element_raw = input_element[0],
        completion_start = 0,
        completion_end = 0;

    // turn off the browser's autocomplete
    input_element.attr('autocomplete', 'off');

    //$('.ui-autocomplete').css('width', '10px');
    options_bus.onValue(function update_options(new_options) {
        options = new_options;
    });

    function completions(text)
    {
        var ret = [],
            noquotes = unquoted(text);

        for (var name in options) {
            if (name.toLowerCase().indexOf(noquotes) === 0) {
                ret.push(name);
            }
        }
        return ret;
    }

    function oninput(text, cursor) {
        // #this is a #
        //             ^
        //
        // #this is a #t
        //              ^
        //
        // #this and #that then #he
        //             ^
        console.log(text);
        console.log(cursor);
        var hash = text.slice(0, cursor).lastIndexOf('#');
        // TODO check if current completion has been invalidated
        _invalidateSelection();
        dropdown_raw.innerHTML = ""; // remove all elements
        if (hash == -1) {
            return;
        }
        var space = text.slice(hash).indexOf(' ');
        space = space == -1 ? text.length : space;
        if (space < cursor) {
            return;
        }
        // [hash] [cursor] [space/end]
        completions(text.slice(hash + 1, space)).forEach(function(name) {
            dropdown.append($('<div>' + name + '</div>'));
            dropdown.children().each(function (index, elem) {
                    elem.onclick = function() { _applySuggestion(index); };
                    input_element.focus();
                });
        });
        completion_start = hash + 1;
        completion_end = space;
    }

    function _invalidateSelection() {
        update_highlighting(-1);
    }

    function move_option(change, default_value) {
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
        move_option(1, 0);
    }
    function prev_option() {
        move_option(-1, dropdown.children().length);
    }
    function _get_option(index) {
        return dropdown.children()[index].innerHTML;
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
        hide: function() {
            console.log('hide');
            dropdown.hide();
        },
        show: function() {
            console.log('show');
            dropdown.show();
        },
        oninput: oninput,
        next_option: next_option,
        prev_option: prev_option,
        handleEnter: handleEnter,
    };
});

return completer;

});
