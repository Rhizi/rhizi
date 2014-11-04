"use strict";

/**
 * API calls designed to execute against a local backend service
 */
define([], function() {

    function RZ_API_Backend() {

        /**
         * issue rhizi server ajax call
         */
        var ajax_rs = function(path, req_opts, on_success, on_error) {

            function on_error_wrapper(xhr, err_text, err_thrown) {
                // log wrap callback
                console.error('error: \'' + err_text + '\'');
                if (on_error && typeof (on_error) === "function") {
                    on_error(err_type, err_text);
                }
            }

            function on_success_wrapper(xhr, text) {
                // log wrap callback
                var ret_data = xhr.data;
                console.log('success: ' + JSON.stringify(ret_data));

                if (on_success) {
                    on_success(ret_data);
                }
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

            $.ajax('http://127.0.0.1:3000' + path, req_opts);
        }

        /**
         * common attr_diff
         */
        this.commit_diff_attr = function(attr_diff, on_success, on_error) {

            var post_dict = {
                'attr_diff' : attr_diff
            }

            var req_opts = {
                type : 'POST',
                data : JSON.stringify(post_dict),
            };

            return ajax_rs('/graph/attr-diff-commit', req_opts, on_success,
                    on_error);
        }

        /**
         * commit topo_diff
         */
        this.commit_diff_topo = function(topo_diff, on_success, on_error) {

            var post_dict = {
                'topo_diff' : topo_diff
            }

            var req_opts = {
                type : 'POST',
                data : JSON.stringify(post_dict),
            };

            return ajax_rs('/graph/diff-commit-topo', req_opts, on_success,
                    on_error);
        }

        /**
         * commit vis_diff
         */
        this.commit_diff_vis = function(vis_diff, on_success, on_error) {
            // TODO impl
        }

        /**
         * commit a diff_set
         */
        this.commit_diff_set = function(diff_set, on_success, on_error) {

            var post_dict = {
                'diff_set' : diff_set
            }

            var req_opts = {
                type : 'POST',
                data : JSON.stringify(post_dict),
            };

            return ajax_rs('/graph/diff-commit-set', req_opts, on_success,
                    on_error);
        }

        /**
         * clone rhizi repo
         */
        this.clone = function(depth, on_success, on_error) {

            // prep request
            var req_opts = {
                type : 'POST',
            };

            ajax_rs('/graph/clone', req_opts, on_success, on_error);
        }

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

            // prep request data
            var post_dict = {
                'id_set' : id_set
            }

            // prep request
            var req_opts = {
                type : 'POST',
                data : JSON.stringify(post_dict),
            };

            return ajax_rs('/load/node-set-by-id', req_opts, on_success,
                    on_error);
        }

        /**
         * load link set by src / dst id
         */
        this.load_link_set = function(link_ptr_set, on_success, on_error) {

            // prep request data
            var post_dict = {
                'link_ptr_set' : link_ptr_set
            }

            // prep request
            var req_opts = {
                type : 'POST',
                data : JSON.stringify(post_dict),
            };

            return ajax_rs('/load/link-set/by_link_ptr_set', req_opts,
                    on_success, on_error);
        }

        /**
         * add a node set
         */
        this.add_node_set = function(n_set, on_success, on_error) {
            var topo_diff = new Topo_Diff();
            topo_diff.node_set_add = n_set;

            return this.topo_diff_commit(topo_diff, on_success, on_error);
        }

        /**
         * add a link set
         */
        this.add_link_set = function(l_set, on_success, on_error) {
            var topo_diff = new Topo_Diff();
            topo_diff.link_set_add = l_set;

            return this.topo_diff_commit(topo_diff);
        }

        /**
         * remove node set
         */
        this.remove_node_set = function() {
            var topo_diff = null;
            return this.topo_diff_commit(topo_diff);
        }

        /**
         * remove link set
         */
        this.remove_link_set = function() {
            var topo_diff = null;
            return this.topo_diff_commit(topo_diff);
        }

        /**
         * update node set
         */
        this.update_node_set = function(attr_diff, on_success, on_error) {
            return this.attr_diff_commit(attr_diff, on_success, on_error);
        }

        /**
         * update link set
         */
        this.update_link_set = function() {
            var attr_diff = null;
            return this.attr_diff_commit(null);
        }
    }

    return new RZ_API_Backend();
});
