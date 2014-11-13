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

    function Node() {
    }

    this.create_node_with_random_id = function(node_spec) {
        var ret = new Node();
        ret.id = random_id();

        ret.name = spec.name;
        ret.type = spec.type;
        ret.state = spec.state;
        ret.status = spec.status;
        ret.url = spec.url;

        ret.start = spec.start;
        ret.end = spec.end;

        return ret;
    }

    this.create_link_with_random_id = function(link_spec) {
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
        create_node_with_random_id : create_node_with_random_id,
        create_link_with_random_id : create_link_with_random_id,
    };
});
