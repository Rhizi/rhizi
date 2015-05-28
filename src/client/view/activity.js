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

define(['jquery', 'underscore', 'Bacon', 'view/selection'],
function($,        _,            Bacon,        selection) {

var MINUTE_IN_MSEC = 60000;

var incomingActivityBus = new Bacon.Bus(),
    graph_view_element,
    graph_view,
    graph,
    activities = [];

function is_topo(diff)
{
    return diff['link_id_set_rm'] !== undefined && diff['node_set_add'] !== undefined,
           diff['node_id_set_rm'] !== undefined && diff['link_set_add'] !== undefined;
}

function is_attr(diff)
{
    return diff['__type_node'] !== undefined && diff['__type_link'] !== undefined;
}

function node_ids_from_diff(diff)
{
    return is_attr(diff) ? _.keys(diff['__type_node']) : _.pluck(diff.node_set_add, 'id');
}

function link_ids_from_diff(diff)
{
    return is_attr(diff) ? _.keys(diff['__type_link']) : _.pluck(diff.link_set_add, 'id');
}

function diff_to_summary_str__topo(diff)
{
    var nodes_added = _.pluck(diff.node_set_add, 'name'),
        links_added = _.pluck(diff.link_set_add, 'name');

    return (nodes_added.length > 0 ? 'added ' + nodes_added.join(' ') + ' nodes' : '') +
        (nodes_added.length > 0 && links_added.length > 0 ? ', ' : '') +
        (links_added.length > 0 ? 'added ' + links_added.join(' ') + ' links' : '');
}

function diff_to_summary_str__attr(diff)
{
    //var nodes_changed = _.map(diff.__type_node0
    var nodes_changed,
        links_changed;

    function collect(root, graph_elem_find_func) {
        return _.map(_.keys(root), function (id) {
                var e_name_or_id,
                    cur_graph_elem,
                    writes = root[id].__attr_write,
                    ret = [];

                _.each(_.keys(writes), function (key) {
                    var val = writes[key];

                    if (key === 'name') {
                        ret.push('renamed to ' + val)
                    } else {
                        ret.push(key + ' changed to ' + val);
                    }
                });
                _.map(root[id].__attr_remove, function (id) {
                    ret.push(id + ' removed');
                });

                // attempt name resolution
                cur_graph_elem = graph_elem_find_func(id);
                e_name_or_id = (cur_graph_elem && cur_graph_elem.name) || id; // use id as fallback, eg. when element not present in current graph
                return e_name_or_id + ': ' + ret.join(', '); /* TODO: use the previous name of the node, not the new name */
            });
    }
    nodes_changed = collect(diff.__type_node, graph.find_node__by_id);
    links_changed = collect(diff.__type_link, graph.find_link__by_id);
    return (nodes_changed.concat(links_changed)).join(';');
}

function diff_to_summary_str(diff)
{
    if (is_topo(diff)) {
        return diff_to_summary_str__topo(diff);
    }
    if (is_attr(diff)) {
        return diff_to_summary_str__attr(diff);
    }

}

function time_diff(old_date, new_date)
{
    var delta = Math.floor((new_date - old_date) / 1000.0),
        seconds = Math.floor(delta % 60),
        minutes = Math.floor((delta / 60) % 60),
        hours = Math.floor((delta / 3600) % 24),
        days = Math.floor((delta / 86400));

    if (delta < 60) {
        return 'less than a minute ago'
    }
    if (delta < 3600) {
        if (minutes === 1) return '1 minute ago';
        return '' + minutes + ' minutes ago';
    }
    if (delta < 86400) {
        if (hours === 1) return '1 hour ago';
        return '' + hours + ' hours ago';
    }

    if (days === 1) return 'a day ago';
    return '' + days + ' days ago';
}

function make_time_ago_div(creation_date, now)
{
    return 
}

function Activity(diff)
{
    var meta = diff.meta || {},
        new_div = $('<div class="activity__entry"></div>'),
        activity = this,
        affected_node_ids = node_ids_from_diff(diff),
        affected_link_ids = link_ids_from_diff(diff),
        author = meta.author || 'Anonymous',
        sentence = meta.sentence,
        explanation = (sentence !== undefined && sentence.length > 0) ? sentence : diff_to_summary_str(diff);

    this.div = new_div;
    if (is_topo(diff)) {
        new_div[0].classList.add('topo-diff');
    }
    if (is_attr(diff)) {
        new_div[0].classList.add('attr-diff');
    }
    this.creation_date = meta.ts_created !== undefined ? new Date(meta.ts_created) : new Date();
    this.commit = meta.commit; // [!] unused, should link to permanent url
    this.author = author;
    this.sentence = sentence;
    this.explanation = explanation;
    this.diff = diff;
    this.affected_node_ids = affected_node_ids;
    this.affected_link_ids = affected_link_ids;
    this.author_element = $('<span class="activity__entry__author">by ' + author + '</span>'),
    this.explanation_element = $('<span class="activity__entry__summary">' + explanation + '</span>');
    this.time_ago_element = $('<span class="activity__entry__date"></span>');
    new_div.append([this.explanation_element, this.author_element, this.time_ago_element]);

    new_div.on('click', function (event) {
        var affected_nodes = _.filter(_.map(activity.affected_node_ids, graph.find_node__by_id), null);

        (event.shiftKey ? selection.invert_both : selection.select_both)
            (affected_nodes, affected_links);
    });
    new_div.hover(function (e) {
        var affected_nodes = _.filter(_.map(activity.affected_node_ids, graph.find_node__by_id), null);
            affected_links = _.filter(_.map(activity.affected_link_ids, graph.find_link__by_id), null);

        _.each(affected_nodes, graph_view.node__hover__start);
        _.each(affected_links, graph_view.link__hover__start);
    }, function (e) {
        var affected_nodes = _.filter(_.map(activity.affected_node_ids, graph.find_node__by_id), null);
            affected_links = _.filter(_.map(activity.affected_link_ids, graph.find_link__by_id), null);

        _.each(affected_nodes, graph_view.node__hover__end);
        _.each(affected_links, graph_view.link__hover__end);
    });
    this.update_time_ago_element(new Date());
}

Activity.prototype.update_time_ago_element = function (zero_time) {
    this.time_ago_element.text(time_diff(this.creation_date, zero_time));
}

/**
 * appendActivity(activity)
 *
 * [!] should be diff?
 *
 */
function appendActivity(diff)
{
    var activity = new Activity(diff);

    activities.push(activity);
    $('#activity_view__body').prepend(activity.div);
    // TODO - only update visible (visible_in / out hooks?)
    // TODO - x button
    // TODO - user name (requires protocol update?)
}

function update_div_ago(activity)
{
    activity.update_time_ago_element(new Date());
}

function update_ago()
{
    _.each(activities, update_div_ago);
}

function clear()
{
    activities.splice(0); // reset activities
    $('#activity_view__body').empty();
}

function init(_graph, _graph_view, _graph_view_element)
{
    incomingActivityBus.onValue(appendActivity);
    graph_view = _graph_view;
    graph = _graph;
    setInterval(update_ago, MINUTE_IN_MSEC);
    $('#checkbox__activity-view-toggle').on('change', function() {
        $('#activity_view').toggle();
    });
    clear();
}

return {
    init: init,
    clear: clear,
    incomingActivityBus: incomingActivityBus,
};

}); // close define
