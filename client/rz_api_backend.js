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
 * API calls designed to execute against a local backend service
 */
define(['util', 'model/core'], function(util, model_core) {

	var rz_core;

	function get_rz_core() {
		if (rz_core === undefined) {
			rz_core =require('rz_core');
		}
		return rz_core;
	}

    function RZ_API_Backend() {

        var rz_server_url = document.location.origin;

        var common_req_ctx = function() {
            var common_ctx = { rzdoc_name: get_rz_core().rzdoc__current__get_name() };
            return common_ctx;
        };

        /**
         * issue rhizi server ajax call
         */
        var ajax_rs = function(path, req_opts, on_success, on_error) {

            function on_error_wrapper(xhr, text_status, err_thrown) {
                // log wrap callback
                var err_msg = xhr.responseJSON && xhr.responseJSON.error;
                console.error('ajax error: status: \'' + text_status + '\', error-msg: ' + err_msg);
                if (on_error && typeof (on_error) === "function") {
                    on_error(xhr, text_status, err_thrown);
                }
            };

            function on_success_wrapper(xhr, text) {
                // log wrap callback
                var ret_data = xhr.data;
                util.assert(undefined == xhr.error); // assert we no longer return errors along with HTTP 200 status codes

                console.log('ajax success: return value: ' + ret_data);
                if (on_success) {
                    on_success(ret_data);
                };
            }

            /*
             * add common request options
             */
            req_opts.dataType = "json";
            req_opts.contentType = "application/json; charset=utf-8";
            req_opts.error = on_error_wrapper;
            req_opts.success = on_success_wrapper;
            req_opts.headers = {};
            req_opts.timeout = 8000; // ms
            req_opts.crossDomain = true;

            $.ajax(rz_server_url + path, req_opts);
        };

        /**
         * common attr_diff
         */
        this.commit_diff__attr = function(attr_diff, on_success, on_error) {

            var req_data = common_req_ctx();
            req_data['attr_diff'] = attr_diff;

            var req_opts = {
                type : 'POST',
                data : JSON.stringify(req_data),
            };

            return ajax_rs('/api/rzdoc/diff-commit__attr', req_opts, on_success,
                    on_error);
        };

        /**
         * commit topo_diff
         */
        this.commit_diff__topo = function(topo_diff, on_success, on_error) {

            var req_data = common_req_ctx();
            req_data['topo_diff'] = topo_diff;

            var req_opts = {
                type : 'POST',
                data : JSON.stringify(req_data),
            };

            return ajax_rs('/api/rzdoc/diff-commit__topo', req_opts, on_success,
                    on_error);
        };

        /**
         * commit vis_diff
         */
        this.commit_diff__vis = function(vis_diff, on_success, on_error) {

            var req_data = common_req_ctx();
            req_data['vis_diff'] = vis_diff;

            var req_opts = {
                type : 'POST',
                data : JSON.stringify(req_data),
            };

            return ajax_rs('/api/rzdoc/diff-commit__vis', req_opts, on_success,
                    on_error);
        };

        /**
         * commit a diff_set
         */
        this.commit_diff__set = function(diff_set, on_success, on_error) {

            var req_data = common_req_ctx();
            req_data['diff_set'] = diff_set;

            var req_opts = {
                type : 'POST',
                data : JSON.stringify(req_data),
            };

            return ajax_rs('/api/rzdoc/diff-commit__set', req_opts, on_success,
                    on_error);
        };

        /**
         * load node-set by id attribute
         *
         * @param on_complete_cb
         *            will be called with the returned json data on successful
         *            invocation
         * @param on_error
         *            error callback
         */
        this.load_node_set = function(id_set, on_success, on_error) {

            var req_data = common_req_ctx();
            req_data['id_set'] = id_set;

            // prep request
            var req_opts = {
                type : 'POST',
                data : JSON.stringify(req_data),
            };

            return ajax_rs('/api/rzdoc/fetch/node-set-by-id', req_opts, on_success,
                    on_error);
        };

        /**
         * load link set by src / dst id
         */
        this.load_link_set = function(link_ptr_set, on_success, on_error) {

            var req_data = common_req_ctx();
            req_data['link_ptr_set'] = link_ptr_set;

            // prep request
            var req_opts = {
                type : 'POST',
                data : JSON.stringify(req_data),
            };

            return ajax_rs('/api/rzdoc/fetch/link-set/by_link_ptr_set', req_opts,
                    on_success, on_error);
        };

        /**
         * add a node set
         */
        this.add_node_set = function(n_set, on_success, on_error) {
            var topo_diff = new Topo_Diff();
            topo_diff.node_set_add = n_set;

            return this.topo_diff_commit(topo_diff, on_success, on_error);
        };

        /**
         * add a link set
         */
        this.add_link_set = function(l_set, on_success, on_error) {
            var topo_diff = new Topo_Diff();
            topo_diff.link_set_add = l_set;

            return this.topo_diff_commit(topo_diff);
        };

        /**
         * remove node set
         */
        this.remove_node_set = function() {
            var topo_diff = null;
            return this.topo_diff_commit(topo_diff);
        };

        /**
         * remove link set
         */
        this.remove_link_set = function() {
            var topo_diff = null;
            return this.topo_diff_commit(topo_diff);
        };

        /**
         * update node set
         */
        this.update_node_set = function(attr_diff, on_success, on_error) {
            return this.attr_diff_commit(attr_diff, on_success, on_error);
        };

        /**
         * update link set
         */
        this.update_link_set = function() {
            var attr_diff = null;
            return this.attr_diff_commit(null);
        };

        /**
         * clone rhizi repo
         */
        this.rzdoc_clone = function(on_success, on_error) {

            var req_data = common_req_ctx();

            // prep request
            var req_opts = {
                type : 'POST',
                data : JSON.stringify(req_data)
            };

            ajax_rs('/api/rzdoc/clone', req_opts, on_success, on_error);
        };

        /**
         * create rzdoc
         */
        this.rzdoc_create = function(rzdoc_name, on_success, on_error) {

            var req_opts = { type : 'POST' };
            return ajax_rs('/api/rzdoc/' + rzdoc_name + '/create', req_opts, on_success, on_error);
        };

        /**
         * list available rzdocs
         */
        this.rzdoc_search = function(search_query, on_success, on_error) {

            var req_data = {'search_query': search_query};
            var req_opts = { type : 'POST', data : JSON.stringify(req_data)};

            return ajax_rs('/api/rzdoc/search', req_opts, on_success, on_error);
        };
    }

    return new RZ_API_Backend();
});
