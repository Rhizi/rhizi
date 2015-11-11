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
 * DOM object observers
 */
define(
[],
function() {

var MutationObserver = window.MutationObserver;
// more portable version: var MutationObserver =
// window.MutationObserver ||
// window.WebKitMutationObserver;

/**
 * observe SVG object's translate attribute (x,y values), measure
 * change rate & invoke on_slowdown_threshold_reached() upon
 * reaching change slowdown threshold.
 *
 * Caller is responsible to disconnect observer.
 */
function Mutation_Handler__on_dxy_slowdown(
        on_slowdown_threshold_reached) {

    var x_cur, y_cur, d, dx, dy, avg_d = 0;

    this.on_slowdown_threshold_reached = on_slowdown_threshold_reached;

    /**
     * handle observer mutation
     */
    this.handle_mutation = function(m) {
        if ('transform' != m.attributeName || null == m.oldValue) {
            return;
        }

        /*
         * parsed txt example:
         * "translate(173.6007550157428,275.43228723527193)"
         */
        var rgx_m = m.oldValue.match(/\((\d+.\d+),(\d+.\d+)\)/);
        x_cur = rgx_m[1];
        y_cur = rgx_m[2];
        if (undefined == this.x_prv) {
            this.x_prv = x_cur;
            this.y_prv = y_cur;
            return;
        }
        dx = x_cur - this.x_prv;
        dy = y_cur - this.y_prv;

        var d = Math.sqrt(dx * dx + dy * dy);
        // average across last samples
        avg_d = (1.0 - this.most_recent_sample_weight) * avg_d
                + this.most_recent_sample_weight * d;

        // debug
        // console.log({
        //     'dx' : dx,
        //     'dy' : dy,
        //     'd' : d,
        //     'avg_d' : avg_d,
        // });

        if (avg_d < this.slowdown_threshold) {
            // slowdown threshold reached
            if (this.on_slowdown_threshold_reached) {
                this.on_slowdown_threshold_reached();
            }
        }

        this.x_prv = x_cur;
        this.y_prv = y_cur;
    }
}

function new_Mutation_Handler__on_dxy_slowdown(
        on_slowdown_threshold_reached, slowdown_threshold,
        most_recent_sample_weight) {
    slowdown_threshold = slowdown_threshold || 0.07;
    most_recent_sample_weight = most_recent_sample_weight || 0.3;
    var ret = new Mutation_Handler__on_dxy_slowdown(
            on_slowdown_threshold_reached);
    ret.slowdown_threshold = slowdown_threshold;
    ret.most_recent_sample_weight = most_recent_sample_weight;
    return ret;
}

function new_MutationObserver(handler) {
    /*
     * FIXME implemente with inheritence - currently triggers
     * 'illegal invocation', possibly due to some interaction with
     * requirejs
     */
    // var o = new
    // window.MutationObserver(Mutation_Observer.handler);
    // var ret = Object.create(o);
    // ret. = undefined;
    // return ret;
    var for_each_mutaion = function(m_set) {
        m_set.forEach(function(m) {
            handler.handle_mutation(m);
        })
    };

    return new MutationObserver(for_each_mutaion);
}

return {
    new_MutationObserver : new_MutationObserver,
    new_Mutation_Handler__on_dxy_slowdown : new_Mutation_Handler__on_dxy_slowdown,
};

});
