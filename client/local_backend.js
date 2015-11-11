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

function obj_keys(obj)
{
    var ret = [],
        k;

    for (k in obj) {
        ret.push(k);
    }
    return k;
}

/**
 * API calls designed to execute against a local backend service
 */
define(['util', 'model/core'],
function(util,   model_core) {

    function new_graph() {
        return new model_graph.Graph({temporary: false, base: null, backend: 'none'});
    }

    function get_doc_name() {
        return 'Local Backend Doc';
    }

    function get_doc() {
        return docs[get_doc_name()];
    }

	var rz_core,
        model_graph,
        docs = {},
        graph = undefined;

    // TODO: use a promise - not working for some reason with karma..
    function init_graph(cb) {
        function got_model_graph(inner_model_graph) {
            model_graph = inner_model_graph;
            graph = new_graph();
            // insert starting document
            if (get_doc_name() !== undefined) {
                docs[get_doc_name()] = graph;
            }
            if (cb !== undefined) {
                cb();
            }
        }
        if (model_graph === undefined) {
            require(['model/graph'], got_model_graph);
        } else {
            got_model_graph(model_graph);
        }
    }

    function Local_Backend() {

        this.init_graph = init_graph;
        init_graph();

        /**
         * common attr_diff
         */
        this.commit_diff__attr = function(attr_diff, on_success, on_error) {
            init_graph(function () {
                get_doc().commit_diff__attr(attr_diff);
                on_success(attr_diff);
            });
        };

        /**
         * commit topo_diff
         */
        this.commit_diff__topo = function(topo_diff, on_success, on_error) {
            init_graph(function () {
                get_doc().commit_diff__topo(topo_diff);
                on_success(topo_diff);
            });
        };

        /**
         * clone rhizi repo
         */
        this.rzdoc_clone = function(on_success, on_error) {
            init_graph(function () {
                on_success(docs[get_rz_core().rzdoc__current__get_name()]);
            });
        };

        /**
         * create rzdoc
         */
        this.rzdoc_create = function(rzdoc_name, on_success, on_error) {
            init_graph(function () {
                var new_graph = new_graph();
                docs[rzdoc_name] = new_graph;
                on_success(new_graph);
            });
        };

        /**
         * list available rzdocs
         */
        this.rzdoc_search = function(search_query, on_success, on_error) {
            init_graph(function () {
                return []; // TODO
            });
        };
    }

    return new Local_Backend();
});