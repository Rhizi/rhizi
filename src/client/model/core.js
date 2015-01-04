"use strict"

/**
 * core model module - currently unused
 */
define(['util'], function(util) {

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
    Node.prototype.equals = function(other_node){
        return this.id == other_node.id;
    }

    function Link() {
    }
    // adapt Link to force_layout create __src,__dst aliases
    Link.prototype.__defineGetter__('source', function(){
        return this.__src;
    });
    Link.prototype.__defineGetter__('target', function(){
        return this.__dst;
    });

    /**
     * the most flexible way to create a node: - perform spec field validation -
     * fill-in missing spec fields
     */
    function create_node_from_spec(node_spec) {
        var ret = new Node();

        if (undefined != node_spec.id) {
            // reuse id if present
            __set_obj_id(ret, node_spec.id);
        }

        util.assert(undefined != node_spec.name, 'create_node_from_spec: name missing');

        ret.name = node_spec.name;

        // type
        if (undefined == node_spec.type) {
            console.debug('create_node_from_spec: undefined type, falling back to \'perm\'');
            node_spec.type = 'perm';
        }
        ret.type = node_spec.type;

        // status
        ret.status = node_spec.status || 'unknown';

        // visual
        ret.x = node_spec.x;
        ret.y = node_spec.y;

        // other
        ret.state = node_spec.state;
        ret.url = node_spec.url;
        ret.start = node_spec.start;
        ret.end = node_spec.end;

        return ret;
    }

    function __set_obj_id(obj, id) {
        Object.defineProperty(obj, "id", {
            value: id,
            enumerable: true,
            writable: false
        });
    }

    /**
     * @param node_spec: id must not be defined
     */
    function create_node__set_random_id(node_spec) {
        if (undefined == node_spec) {
            node_spec = {};
        }

        var ret = create_node_from_spec(node_spec);

        util.assert(undefined == ret.id); // id must not be defined in spec
        __set_obj_id(ret, random_id());

        return ret;
    }

    function create_link__set_random_id(src, dst, link_spec) {
        var ret = create_link_from_spec(src, dst, link_spec);
        __set_obj_id(ret, random_id());
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

    function create_link_from_spec(src, dst, link_spec) {
        var ret = new Link(),
            temp = link_spec.state === 'temp';

        if (undefined != link_spec.id) {
            // reuse id if present
            __set_obj_id(ret, link_spec.id);
        }

        util.assert(undefined != src, 'create_link_from_spec: src missing');
        util.assert(undefined != dst, 'create_link_from_spec: dst missing');
        util.assert(temp || undefined != src.id, 'create_link_from_spec: non temp src missing id');
        util.assert(temp || undefined != dst.id, 'create_link_from_spec: non temp dst missing id');
        util.assert(undefined != link_spec.name, 'create_link_from_spec: name missing, unable to deduce type');

        ret.__src = src;
        ret.__dst = dst;
        ret.__type = link_spec.name;

        if (undefined == link_spec.name){
            console.warn('create_link_from_spec: name: ' + link_spec.name);
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
        create_node_from_spec : create_node_from_spec,
        create_node__set_random_id : create_node__set_random_id,
        create_link_from_spec : create_link_from_spec,
        create_link__set_random_id : create_link__set_random_id,
    };
});
