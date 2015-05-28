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

define(['jquery', 'Bacon', 'consts', 'model/diff', 'rz_bus', 'consts'],
function($,        Bacon,           consts,   model_diff,   rz_bus,   consts)
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
    var original_element,
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
            svg_input.text(name);
        });

    function appendForeignElementInputWithID(base, elemid, width, height)
    {
        var textnode = document.createTextNode(''),
            div = document.createElement('div'),
            fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');

        div.setAttribute('contentEditable', 'true');
        div.setAttribute('width', 'auto');
        div.appendChild(textnode);
        div.style.pointerEvents = 'all';
        div.classList.add('insideforeign');
        div.setAttribute('id', elemid);
        fo.setAttribute('width', '100%');
        fo.setAttribute('height', '100%');
        fo.style.pointerEvents = 'none';
        fo.classList.add('foreign');
        fo.appendChild(div);
        base.appendChild(fo);
        return div;
    }

    function onkeydown(e) {
        var ret = undefined,
            jelement = createOrGetSvgInput(),
            element = jelement[0],
            newname = jelement.text(),
            fo = createOrGetSvgInputFO(),
            d;

        if (element != this) {
            console.log('unexpected editname_on_keypress this should be the svg-input element');
        }

        if (e.which == consts.VK_ENTER || e.which == consts.VK_ESCAPE) {
            ret = false;
            d = jelement.data().d;
            if (e.which == consts.VK_ENTER && newname != d.name) {
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
        }
        return svg_input;
    }

    function createOrGetSvgInputFO()
    {
        return createOrGetSvgInput().parent();
    }

    /*
     * Makes the input element visible at the position of @e with text
     * from @n. Uses @x as x offset.
     *
     * @param e visual node element
     * @param n node model object
     * @param x offset on x dimension from e
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
        fo.show();
        svg_input.text(oldname);
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
