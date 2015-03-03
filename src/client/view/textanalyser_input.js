define(['jquery', 'Bacon_wrapper', 'underscore', 'util', 'view/completer', 'rz_bus', 'textanalysis', 'consts'],
function($,        Bacon,           _,            util,        completer,   rz_bus,   textanalysis,   consts)
{
// Aliases
var value = util.value;

// Constants
var nbsp = String.fromCharCode(160);

function textanalyser_input(spec) {
    var selectionStart = function () {
        return util.selectionStart(element_raw);
    }

    function key(val) {
        return function (e) {
            return e.keyCode == val;
        };
    };

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

        base_parts = current_text.split(/   */)
        parts = _.flatten(base_parts.slice(0, base_parts.length - 1).map(function (l) { return [l, '  ']; }));
        if (base_parts[base_parts.length - 1].length != 0) {
            parts.push(base_parts[base_parts.length - 1]);
        }
        function span(text, clazz) {
            return $('<span class="' + clazz + '">' + text.replace(/ /g, nbsp) + '</span>')[0];
        };

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
            on_analysis: new Bacon.Bus(),
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
        },
        analysisCompleter = completer(element, $(spec.completer_name), completer_spec),
        document_keydown = new Bacon.Bus(),
        input_bus = new Bacon.Bus();

    analysisCompleter.options.plug(textanalysis.suggestions_options);

    util.assert(1 === element.length);

    var enters = element.asEventStream('keydown').filter(key(13))
        .map(function (e) {
            var text;
            e.preventDefault();
            e.stopPropagation();

            if (!analysisCompleter.handleEnter()) {
                text = current_value();
                value(element_raw, "");
                return text;
            } else {
                return false;
            }
        });

    rz_bus.ui_key.plug(document_keydown);

    ta.on_sentence = enters.filter(function (v) { return v !== false; });
    ta.on_analysis.plug(enters.filter(function (v) { return v === false; }).map(current_value));
    ta.on_tab = element.asEventStream('keydown').filter(key(9));

    element.asEventStream('keydown').onValue(function (e) {
        document_keydown.push({where: consts.KEYSTROKE_WHERE_TEXTANALYSIS, keys: [e.keyCode]});
    });

    element.asEventStream('input selectionchange click').onValue(function (e) {
        analysisCompleter.oninput(current_value(), selectionStart(element_raw));
        e.stopPropagation();
        e.preventDefault();
    });

    ta.on_analysis.plug(element.asEventStream('input').map(current_value).map(function (val) {
        return update_element(val);
    }));

    return ta;
};

return textanalyser_input;
}
);
