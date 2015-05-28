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

"use strict"

/**
 * Diff module
 */
define(['consts'],
function(consts) {

function Meta(obj_spec) {
    this.sentence = (obj_spec && obj_spec.sentence) || '';
    this.author = (obj_spec && obj_spec.author) || '';
    this.ts_created = (obj_spec && obj_spec.ts_created) || undefined;
}

function new_meta_from_spec(obj_spec) {
    var ret = new Meta(obj_spec);

    return ret;
}

/**
 * A set of diff objects
 */
function Diff_Set(obj_spec) {
    this.__diff_set_topo = [];
    this.__diff_set_attr = [];
    this.__diff_set_vis = [];
}
Diff_Set.prototype.add_diff_obj = function(diff_obj) {
    if (diff_obj instanceof Topo_Diff) {
        this.__diff_set_topo.push(diff_obj);
    }
    if (diff_obj instanceof Attr_Diff) {
        this.__diff_set_attr.push(diff_obj);
    }
    if (diff_obj instanceof Vis_Diff) {
        this.__diff_set_vis.push(diff_obj);
    }
}

/**
 * Topological diff object
 */
function Topo_Diff(obj_spec) {

    this.link_id_set_rm = obj_spec.link_id_set_rm;
    this.node_id_set_rm = obj_spec.node_id_set_rm;
    this.node_set_add = obj_spec.node_set_add;
    this.link_set_add = obj_spec.link_set_add;
    this._link_set_add__fix_empty_links();
    this.meta = new_meta_from_spec(obj_spec.meta);

}

Topo_Diff.prototype._link_set_add__fix_empty_links = function() {

    function set_empty_link(link) {
        if (link.name === '') {
            link.name = consts.EMPTY_LINK_NAME;
        }
    }
    this.link_set_add.forEach(set_empty_link);

}

Topo_Diff.prototype.for_each_node_add = function(callback, this_arg) {
    this.node_set_add.forEach(callback, this_arg);
}

Topo_Diff.prototype.for_each_node_rm = function(callback, this_arg) {
    this.node_id_set_rm.forEach(callback, this_arg);
}

Topo_Diff.prototype.for_each_link_add = function(callback, this_arg) {
    this.link_set_add.forEach(callback, this_arg);
    this._link_set_add__fix_empty_links();
}

Topo_Diff.prototype.for_each_link_rm = function(callback, this_arg) {
    this.link_id_set_rm.forEach(callback, this_arg);
}

/**
 * Attribute diff object, organized by type, where currently
 * node,link types are supported
 */
function Attr_Diff() {
    this.__type_node = {};
    this.__type_link = {};
}

Attr_Diff.prototype.toString = function() {
    return 'AttrDiff<' + JSON.stringify(this) + '>';
}

Attr_Diff.prototype.init_attr_diff = function(type_name, id) {

    if ('node' != type_name && 'link' != type_name) {
        console.error('attempt to init attribute diff for unsupported type: ' + type_name);
        return;
    }

    var type_field = '__type_' + type_name;
    this[type_field][id] = {
        '__attr_write' : {},
        '__attr_remove' : []
    };

    this.id_to_node_map = this.__type_node;
    this.id_to_link_map = this.__type_link;

    return this;
}

Attr_Diff.prototype.init_attr_diff_node = function(id) {
    return this.init_attr_diff('node', id);
}

Attr_Diff.prototype.init_attr_diff_link = function(id) {
    return this.init_attr_diff('link', id);
}

Attr_Diff.prototype.add_node_attr_write = function(n_id, attr_name,
        attr_val) {

    if (undefined == this.__type_node[n_id]) {
        this.init_attr_diff_node(n_id);
    }
    this.__type_node[n_id].__attr_write[attr_name] = attr_val;
    return this;
}

Attr_Diff.prototype.add_node_attr_remove = function(n_id, attr_name) {
    if (undefined == this[n_id]) {
        this.init_attr_diff(n_id);
    }
    this.__type_node[n_id].__attr_remove.push(attr_name);
    return this;
}

Attr_Diff.prototype.add_link_attr_write = function(l_id, attr_name,
        attr_val) {

    if ('name' === attr_name && String(attr_val).length === 0) {
        attr_val = consts.EMPTY_LINK_NAME;
    }
    if (undefined == this.__type_link[l_id]) {
        this.init_attr_diff_link(l_id);
    }
    this.__type_link[l_id].__attr_write[attr_name] = attr_val;
    return this;
}

Attr_Diff.prototype.add_link_attr_remove = function(l_id, attr_name) {
    if (undefined == this[l_id]) {
        this.init_attr_diff(l_id);
    }
    this.__type_link[l_id].__attr_remove.push(attr_name);
    return this;
}

/**
 * @param callback signature: 'function (n_id, n_attr_diff) { ... }
 */
Attr_Diff.prototype.for_each_node = function(callback) {
    for (var n_id in this['__type_node']) {
        var n_attr_diff = this['__type_node'][n_id];
        callback(n_id, n_attr_diff);
    }
}

/**
 * @param callback signature: 'function (l_id, l_attr_diff) { ... }
 */
Attr_Diff.prototype.for_each_link = function(callback) {
    for (var l_id in this['__type_link']) {
        var l_attr_diff = this['__type_link'][l_id];
        callback(l_id, l_attr_diff);
    }
}

/**
 * @param id of node to check for inclusion of
 */
Attr_Diff.prototype.has_node_id_attr_write = function(n_id, attr) {
    return this.__type_node[n_id] !== undefined && this.__type_node[n_id].__attr_write[attr];
}

/**
 * @param id of link to check for inclusion of
 */
Attr_Diff.prototype.has_link_id_attr_write = function(n_id, attr) {
    return this.__type_link[n_id] !== undefined && this.__type_link[n_id].__attr_write[attr];
}

/**
 * Visual diff object expressing any visual change to the state of a
 * particular visualization type.
 *
 * @obj_spec if none is passed a default topo_diff is constructed
 *           with node,link add sets
 */
function Vis_Diff(obj_spec) {
}

function new_topo_diff(obj_spec) {
    /*
     * validate obj_spec
     */
    var ret;
    undefined == obj_spec && (obj_spec = {});
    undefined == obj_spec.node_set_add && (obj_spec.node_set_add = []);
    undefined == obj_spec.link_set_add && (obj_spec.link_set_add = []);
    undefined == obj_spec.node_id_set_rm && (obj_spec.node_id_set_rm = []);
    undefined == obj_spec.link_id_set_rm && (obj_spec.link_id_set_rm = []);
    ret = new Topo_Diff(obj_spec);
    return ret;
}

function new_attr_diff() {
    /*
     * validate obj_spec
     */
    // TODO
    var ret = new Attr_Diff();
    ret.__type_node = {}; // id-to-obj map
    ret.__type_link = {}; // id-to-obj map
    ret.meta = new_meta_from_spec({});
    return ret;
}

/**
 * Convert a Attr_Diff spec to an Attr_Diff object
 *
 */
function new_attr_diff_from_spec(attr_diff_spec) {
    var ret = new_attr_diff();

    for (var n_id in attr_diff_spec['__type_node']) {

        var n_attr_diff = attr_diff_spec['__type_node'][n_id];

        // process attr writes: node
        for (var attr_name in n_attr_diff['__attr_write']) {
            var attr_val = n_attr_diff['__attr_write'][attr_name];
            ret.add_node_attr_write(n_id, attr_name, attr_val);
        };

        // process attr removals: node
        for (var attr_name in n_attr_diff['__attr_remove']) {
            ret.add_node_attr_remove(n_id, attr_name);
        };
    };

    for (var l_id in attr_diff_spec['__type_link']) {

        var n_attr_diff = attr_diff_spec['__type_link'][l_id];

        // process attr writes: link
        for (var attr_name in n_attr_diff['__attr_write']) {
            var attr_val = n_attr_diff['__attr_write'][attr_name];
            ret.add_link_attr_write(l_id, attr_name, attr_val);
        };

        // process attr removals: link
        for (var attr_name in n_attr_diff['__attr_remove']) {
            ret.add_link_attr_remove(l_id, attr_name);
        };
    };

    ret.meta =  attr_diff_spec.meta;

    return ret;
}

function new_vis_diff(obj_spec) {
    /*
     * validate obj_spec
     */
    // TODO
    var ret = new Vis_Diff(obj_spec);
    return ret;
}

function new_diff_set(obj_spec) {
    /*
     * validate obj_spec
     */
    // TODO
    var ret = new Diff_Set(obj_spec);
    return ret;
}

return {
    new_topo_diff : new_topo_diff,
    new_attr_diff : new_attr_diff,
    new_attr_diff_from_spec : new_attr_diff_from_spec,
    new_vis_diff : new_vis_diff,
    new_diff_set : new_diff_set,
    is_attr_diff: function (obj) { return obj instanceof Attr_Diff; },
    is_topo_diff: function (obj) { return obj instanceof Topo_Diff; },
}

}); // Module end
