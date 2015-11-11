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

/**
 * model utility functions: - convert from/to client/backend data
 * representations
 */
define([ 'jquery', 'model/diff' ], function($, model_diff) {

    function __sanitize_label__write(label_str){
        var ret = label_str[0].toUpperCase() +
                  label_str.substring(1).toLowerCase();
        return ret;
    }

    function __sanitize_label__read(label_str){
        return label_str.toLowerCase();
    }

    /**
     * read by adapting from backend format
     */
    function adapt_format_read_node(n_raw) {
        var ret;

        ret = $.extend({
            // type:
            // - discard all but first label
            // - adjust to lowercase
            'type' : __sanitize_label__read(n_raw['__label_set'][0]),
            'state' : 'perm',
        }, n_raw);

        delete ret.__label_set;

        return ret;
    }

    /**
     * write by adapting to backend format
     */
    function adapt_format_write_node(n_raw) {
        var ret = $.extend({
        }, n_raw);

        ret['__label_set'] = [__sanitize_label__write(n_raw.type)];

        delete ret.state;
        delete ret.status;
        delete ret.type;

        return ret;
    }

    /**
     * read by adapting from backend format
     */
    function adapt_format_read_link_ptr(l_raw) {
        var ret;

        ret = $.extend({
            'state' : 'perm',
        }, l_raw);

        ret['name'] = __sanitize_label__read(ret['__type'][0]);
        delete ret.__type;

        return ret;
    }

    /**
     * write by adapting to backend format
     */
    function adapt_format_write_link(l_raw) {
        var ret = $.extend({
            '__src_id' : l_raw.source.id,
            '__dst_id' : l_raw.target.id,
        }, l_raw);

        ret['__type'] = [__sanitize_label__write(l_raw.__type)];

        delete ret.__dst;
        delete ret.__src;
        delete ret.source; // introduced by d3 accessor methods
        delete ret.state;
        delete ret.status;
        delete ret.target;
        delete ret.name;

        return ret;
    }

    /**
     * write adapt diff from node set, link set. sets may be passed by reference
     * as they are cloned
     */
    function adapt_format_write_diff__topo(n_set, l_set) {

        var new_n_set = $.extend([], n_set);
        var new_l_set = $.extend([], l_set);

        new_n_set = $.map(new_n_set, function(n, _) {
            return adapt_format_write_node(n);
        });

        new_l_set = $.map(new_l_set, function(l, _) {
            return adapt_format_write_link(l);
        });

        var topo_diff = new model_diff.new_topo_diff({
            node_set_add : new_n_set,
            link_set_add : new_l_set
        });
        return topo_diff;
    }

    /**
     * read adapt attr_diff from backend format
     */
    function adapt_format_read_diff__attr(diff_spec) {
        var attr_diff = new model_diff.new_attr_diff();
        attr_diff.id_to_node_map = diff_spec['__type_node'];
        attr_diff.id_to_link_map = diff_spec['__type_link'];
        return attr_diff;
    }

    return {
        adapt_format_read_node : adapt_format_read_node,
        adapt_format_read_link_ptr : adapt_format_read_link_ptr,
        adapt_format_write_node : adapt_format_write_node,
        adapt_format_write_link : adapt_format_write_link,

        adapt_format_write_diff__topo : adapt_format_write_diff__topo,
        adapt_format_read_diff__attr : adapt_format_read_diff__attr,
    };
});
