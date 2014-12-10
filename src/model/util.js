"use strict"

/**
 * model utility functions:
 *    - convert from/to client/backend data representations
 */
define(['jquery', 'model/diff'],
function($, model_diff) {

    /**
     * read by adapting from backend format
     */
    function adapt_format_read_node(n_raw) {
        var ret;

        ret = $.extend({
            'type' : n_raw['__label_set'][0].toLowerCase(), // discard all
            // labels except
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
            '__label_set' : [n_raw.type],
        }, n_raw);

        delete ret.state;
        delete ret.status
        delete ret.type;

        return ret
    }

    /**
     * read by adapting from backend format
     */
    function adapt_format_read_link_ptr(l_raw) {
        var ret;

        ret = $.extend({
            '__src_id' : l_raw['__src_id'],
            '__dst_id' : l_raw['__dst_id'],
            'type' : l_raw['__label_set'][0].toLowerCase(), // discard all
            // labels except
            'state' : 'perm',
        }, l_raw);

        ret['name'] = ret['type'];

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
            '__label_set' : [l_raw.name],
        }, l_raw);

        delete ret.__dst;
        delete ret.__src;
        delete ret.source; // introduced by d3 accessor methods
        delete ret.state;
        delete ret.status;
        delete ret.target;

        return ret;
    }

    /**
     * write adapt diff from node set, link set. sets may be passed by reference
     * as they are cloned
     */
    function adapt_format_write_topo_diff(n_set, l_set) {

        var new_n_set = $.extend([], n_set);
        var new_l_set = $.extend([], l_set);

        // filter out 'bubble' nodes
        new_n_set = new_n_set.filter(function(n) {
            return 'bubble' != n.type;
        });

        new_n_set = $.map(new_n_set, function(n, _) {
            return adapt_format_write_node(n);
        })

        new_l_set = $.map(new_l_set, function(l, _) {
            return adapt_format_write_link(l);
        })

        var topo_diff = new model_diff.new_topo_diff({
            node_set_add : new_n_set,
            link_set_add : new_l_set
        });
        return topo_diff;
    }

    return {
        adapt_format_read_node : adapt_format_read_node,
        adapt_format_read_link_ptr : adapt_format_read_link_ptr,
        adapt_format_write_node : adapt_format_write_node,
        adapt_format_write_link : adapt_format_write_link,
        adapt_format_write_topo_diff : adapt_format_write_topo_diff,
    }
});