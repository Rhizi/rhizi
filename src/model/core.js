"use strict"

/**
 * core model module - currently unused
 */
define([], function() {

    /**
     * return a random id
     */
    var random_id = function() {
        return Math.random().toString(36).substring(2);
    }

    function random_node_name() {
        return Math.random().toString(36).substring(2, 10);
    }

    function Node() {
    }

    Node.prototype.selected = function() {
        return this.state == 'chosen' || this.state == 'enter' || this.state == 'exit';
    }

    function create_node__set_random_id(node_spec) {
        if (node_spec.id) {
            console.log('create_node__set_random_id: bug: given id');
        }
        node_spec.id = random_id();
        return create_node(node_spec);
    }

    function create_node(node_spec) {
        if (undefined == node_spec) {
            node_spec = {};
        }
        var ret = new Node();
        ret.name = node_spec.name;
        ret.type = node_spec.type;
        ret.state = node_spec.state;
        ret.status = node_spec.status;
        ret.url = node_spec.url;

        ret.start = node_spec.start;
        ret.end = node_spec.end;
        ret.x = node_spec.x;
        ret.y = node_spec.y;
        console.log(ret);

        return ret;
    }

    function create_link__set_random_id(link_spec) {
        var ret = new Link();
        ret.id = random_id();
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

    function Link() {

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
        random_node_name : random_node_name,
        create_node: create_node,
        create_node__set_random_id : create_node__set_random_id,
        create_link__set_random_id : create_link__set_random_id,
    };
});
