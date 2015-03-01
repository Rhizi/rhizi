define(['jquery', 'Bacon_wrapper', 'model/diff', 'rz_bus', 'consts'],
function($,        Bacon,           model_diff,   rz_bus,   consts)
{
var svg_input_fo_node_y = '-.70em',
    svg_input_fo_height = '30px';

/**
 * svgInput - creates an embedded input element in an svg node.
 *
 * edit_node(@sibling, @node)
 * edit_link(@sibling, @link)
 */
var svgInput = function(vis, graph) {
    var measure_node = $('#measure-node')[0],
        measure_link = $('#measure-link')[0],
        original_element,
        is_link,
        graphEditBus = new Bacon.Bus(),
        currentIdBus = new Bacon.Bus(),
        current_id = currentIdBus.toProperty(null);

    graph.diffBus
        .filter(model_diff.is_attr_diff)
        .combine(current_id, function(diff, id) { return [diff, id]; })
        .filter(function (val) {
            var diff = val[0],
                id = val[1];
            return (is_link && diff.has_link_id_attr_write(id, 'name')) ||
                   (!is_link && diff.has_node_id_attr_write(id, 'name'));
        })
        .map(function (val) { return graph.find_node__by_id(val[1]).name; })
        .onValue(function (name) {
            var svg_input = createOrGetSvgInput();
            svg_input.val(name);
        });

    function appendForeignElementInputWithID(base, elemid, width, height)
    {
        var input = document.createElement('input'),
            body = document.createElement('body'),
            fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');

        body.appendChild(input);

        fo.setAttribute('height', height || svg_input_fo_height);
        fo.style.pointerEvents = 'none';
        input.style.pointerEvents = 'all';
        fo.appendChild(body);
        base.appendChild(fo);
        input.setAttribute('id', elemid);
        return input;
    }

    function measure(text)
    {
        var span;

        span = is_link ? measure_link : measure_node;
        span.innerHTML = text;
        return span.getBoundingClientRect().width; // $().width() works too
    }

    function onkeydown(e) {
        var ret = undefined,
            jelement = createOrGetSvgInput(),
            element = jelement[0],
            newname = jelement.val(),
            fo = createOrGetSvgInputFO(),
            d;

        if (element != this) {
            console.log('unexpected editname_on_keypress this should be the svg-input element');
        }

        if (e.which == 13 || e.which == 27) {
            ret = false;
            d = jelement.data().d;
            if (e.which == 13 && newname != d.name) {
                if (d.hasOwnProperty('__src')) {
                    graph.update_link(d, {name: newname});
                } else {
                    // TODO - display hourglass
                    // TODO - use promises to make A follows B readable.
                    graph.update_node(d, {name: newname});
                }
            }
            hide();
        }
        rz_bus.ui_key.push({where: consts.KEYSTROKE_WHERE_EDIT_NODE, keys: [e.which]});
        return ret;
    };

    function resize_measure(e) {
        resize(measure($(e.target).val()) + 30);
    }

    function resize(new_width) {
        var svg_input = createOrGetSvgInput(),
            fo = createOrGetSvgInputFO();

        svg_input.css('width', new_width);
        fo.attr('width', new_width);
    }

    // FIXME: element being deleted. Some delete is legit - removal of related element. Some isn't (a click).
    // Instead of investigating (time constraint) reparenting as sibling, and introducing
    // this function. Cost of creation of element is negligble, it's just ugly..
    function createOrGetSvgInput()
    {
        var svg_input_name = 'svg-input',
            svg_input_selector = '#' + svg_input_name,
            svg_input = $(svg_input_selector);

        if (svg_input.length == 0) {
            console.log('creating new svg-input');
            svg_input = $(appendForeignElementInputWithID(vis[0][0], svg_input_name));
            svg_input.on('keydown', onkeydown);
            svg_input.bind('change keypress', resize_measure);
        }
        return svg_input;
    }

    function createOrGetSvgInputFO()
    {
        return createOrGetSvgInput().parent().parent();
    }

    /*
     * @param e visual node element
     * @param n node model object
     */
    function enable(e, n, x) {
        var oldname = n.name,
            svg_input = createOrGetSvgInput(),
            fo = createOrGetSvgInputFO();

        is_link = n.hasOwnProperty('__src');
        currentIdBus.push(n.id);

        e.parentNode.appendChild(fo[0]); // This will unparent from the old parent
        if (is_link) {
            fo.attr('transform', e.getAttribute('transform'));
            // XXX links set the text-anchor middle attribute. no idea how to do that
            fo.attr('x', -$(e).width() / 2);
            fo.attr('y', -$(e).height() / 2 - 3); // XXX This minus 3 is only kinda ok.
            fo.attr('class', 'svg-input-fo-link');
        } else {
            fo.attr('x', x);
            fo.attr('y', svg_input_fo_node_y);
            fo.attr('transform', null);
            fo.attr('class', 'svg-input-fo-node');
        }
        // Set width correctly
        resize(measure(oldname) + 30);
        fo.show();
        svg_input.val(oldname);
        svg_input.data().d = n;
        svg_input.focus();
        if (original_element) {
            original_element.show();
        }
        original_element = $(e);
        original_element.hide();
        // TODO: set cursor to correct location in text
    }

    function hide() {
        createOrGetSvgInputFO().hide();
        if (original_element && original_element.show) {
            original_element.show();
        }
    }

    // on change to graph.node[id] update val
    // on change to graph.link[id] update val
    // on delete of id hide

    return {
        enable: enable,
        hide: hide,
    };
};

return svgInput;
});
