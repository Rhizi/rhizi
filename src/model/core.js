"use strict"

/**
 * core model module - currently unused
 */
define([], function() {

    /**
     * return a random id
     */
    var random_id;

    var random_id__hash = function() {
        return Math.random().toString(36).substring(2, 10);
    }

    var random_id__seq = function () {
        var id = 0;
        function get_next() {
            var next = id;
            id += 1;
            return next;
        }
        return get_next;
    }

    function random_node_name() {
        return random_id__hash();
    }

    function init(config){
        if (config['rand_id_generator'] == 'hash') {
            random_id = random_id__hash;
        }
        if (config['rand_id_generator'] == 'seq') {
            random_id = random_id__seq();
        }
    }

    function Node() {
    }

    function Link() {
    }

    /**
     * the most flexible way to create a node: - perform spec field validation -
     * fill-in missing spec fields
     */
    function crete_node_from_spec(node_spec) {
        var ret = new Node();

        // name
        if (undefined == node_spec.name) {
            console.debug('crete_node_from_spec: undefined name, falling back to \"\"');
            node_spec.name = "";
        }
        ret.name = node_spec.name;

        // type
        if (undefined == node_spec.type) {
            console.debug('crete_node_from_spec: undefined type, falling back to \'empty\'');
            node_spec.type = 'empty';
        }
        ret.type = node_spec.type;

        // status
        if (undefined == node_spec.status) {
            node_spec.type = 'unknown';
        }
        ret.status = node_spec.status;

        // visual
        ret.x = node_spec.x;
        ret.y = node_spec.y;

        // other
        ret.state = node_spec.state;
        ret.url = node_spec.url;
        ret.start = node_spec.start;
        ret.end = node_spec.end;
        ret.x = node_spec.x;
        ret.y = node_spec.y;
        console.log(ret);

        return ret;
    }

    /**
     *
     */
    function create_node__set_random_id(node_spec) {
        if (undefined == node_spec) {
            node_spec = {};
        }

        var ret = crete_node_from_spec(node_spec);
        Object.defineProperty(ret, "id", {
            value: random_id(),
            writable: false
        });

        return ret;
    }

    function create_link__set_random_id(src, dst, link_spec) {
        var ret = crete_link_from_spec(src, dst, link_spec);
        Object.defineProperty(ret, "id", {
            value: random_id(),
            writable: false
        });

        return ret;
    }

    /**
     * determine if nodes are equal by name
     *
     * @param other_node
     * @returns {Boolean}
     */
    Node.prototype.equal_by_name = function(other) {
        ret = this.name.toLowerCase() == other.name.toLowerCase();
        if (false == ret) {
            console.debug(this.id + ' != ' + other.id);
        }
        return ret;
    }

    function crete_link_from_spec(src, dst, link_spec) {
        if (undefined == src) {
            console.error('crete_link_from_spec: undefined: src');
            return null;
        }
        if (undefined == dst) {
            console.error('crete_link_from_spec: undefined: dst');
            return null;
        }

        var ret = new Link();
        ret.__src = src;
        ret.__dst = dst;
        ret.__type = 'textual_link';

        if (undefined == link_spec.name){
            console.warn('crete_link_from_spec: name: ' + link_spec.name);
            link_spec.name = "";
        }
        ret.name = link_spec.name.trim();

        ret.state = link_spec.state;
        return ret;
    }

    /**
     * determine if links are equal by ID
     *
     * @param other_node
     * @returns {Boolean}
     */
    Link.prototype.equal_by_id = function(other) {
        return this.id.toLowerCase() == other.id.toLowerCase();
    }

    return {
        init : init,
        Node: Node, // allow model adaptation
        Link: Link, // allow model adaptation
        random_node_name : random_node_name,
        crete_node_from_spec : crete_node_from_spec,
        crete_link_from_spec : crete_link_from_spec,
        create_node__set_random_id : create_node__set_random_id,
        create_link__set_random_id : create_link__set_random_id,
    };
});
