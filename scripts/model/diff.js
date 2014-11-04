"use strict"

/**
 * Diff module
 */
define(
        [ 'model/util' ],
        function(model_util) {

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

                this.link_set_rm = obj_spec.link_set_rm;
                this.node_set_rm = obj_spec.node_set_rm;
                this.node_set_add = obj_spec.node_set_add;
                this.link_set_add = obj_spec.link_set_add;
            }

            /**
             * Attribute diff object, organized by type, where currently
             * node,link types are supported
             */
            function Attr_Diff(obj_spec) {
                this.__type_node = {}
                this.__type_link = {}
            }

            Attr_Diff.prototype.init_attr_diff = function(type, id) {

                if ('node' != type && 'link' != type) {
                    console
                            .error('attempt to init attribute diff for unsupported type: '
                                    + type);
                    return;
                }

                var type_field = '__type_' + type;
                this[type_field][id] = {
                    '__attr_write' : {},
                    '__attr_remove' : []
                };

                return this;
            }

            Attr_Diff.prototype.init_attr_diff_node = function(id) {
                return this.init_attr_diff('node', id);
            }

            Attr_Diff.prototype.init_attr_diff_link = function(id) {
                return this.init_attr_diff('link', id);
            }

            Attr_Diff.prototype.add_attr_write_node = function(n_id, attr_name,
                    attr_val) {

                if (undefined == this.__type_node[n_id]) {
                    this.init_attr_diff_node(n_id);
                }
                this.__type_node[n_id].__attr_write[attr_name] = attr_val;
                return this;
            }

            Attr_Diff.prototype.add_attr_rm_node = function(n_id, attr_name) {
                if (undefined == this[n_id]) {
                    this.init_attr_diff(n_id);
                }
                this.__type_node[n_id].__attr_remove.push(attr_name);
                return this;
            }

            /**
             * Visual diff object expressing any visual change to the state of a
             * particular visualization type
             */
            function Vis_Diff(obj_spec) {
            }

            function new_topo_diff(obj_spec) {
                /*
                 * validate obj_spec
                 */
                // TODO
                var ret = new Topo_Diff(obj_spec);
                return ret;
            }

            function new_attr_diff(obj_spec) {
                /*
                 * validate obj_spec
                 */
                // TODO
                var ret = new Attr_Diff(obj_spec);
                ret.__type_node = {}; // id-to-obj map
                ret.__type_link = {}; // id-to-obj map
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
                new_vis_diff : new_vis_diff,
                new_diff_set : new_diff_set,
            }
        });