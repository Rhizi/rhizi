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

    function create_node__set_random_id(node_spec) {
        if (undefined == node_spec) {
            node_spec = {};
        }

        var ret = new Node();
        ret.id = random_id();

        ret.name = node_spec.name;
        ret.type = node_spec.type;
        ret.state = node_spec.state;
        ret.status = node_spec.status;
        ret.url = node_spec.url;

        ret.start = node_spec.start;
        ret.end = node_spec.end;

        return ret;
    }

    function create_link__set_random_id(link_spec) {
        var ret = new Link();
        ret.id = random_id();
    }

    /**
     * determine if nodes are equal by ID
     *
     * @param other_node
     * @returns {Boolean}
     */
    Node.prototype.equlas_by_id = function(other) {
        ret = this.id.toLowerCase() == other.id.toLowerCase();
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
    Link.prototype.equlas_by_id = function(other) {
        return this.id.toLowerCase() == other.id.toLowerCase();
    }

    return {
        random_node_name : random_node_name,
        create_node__set_random_id : create_node__set_random_id,
        create_link__set_random_id : create_link__set_random_id,
    };
});
