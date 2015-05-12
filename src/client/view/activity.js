define(['jquery', 'underscore', 'Bacon', 'view/selection'],
function($,        _,            Bacon,        selection) {

var incomingActivityBus = new Bacon.Bus(),
    activity_element,
    graph_view_element,
    graph;

function init(_graph, _graph_view_element)
{
    activity_element = $('<div class="activity-root-div"></div>');
    graph_view_element = _graph_view_element;
    graph_view_element.append(activity_element);
    graph = _graph;
}

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

function topo_explanation(diff)
{
    var nodes_added = _.pluck(diff.node_set_add, 'name'),
        links_added = _.pluck(diff.link_set_add, 'name');

    return (nodes_added.length > 0 ? 'added ' + nodes_added.join(' ') + ' nodes' : '') +
        (nodes_added.length > 0 && links_added.length > 0 ? ', ' : '') +
        (links_added.length > 0 ? 'added ' + links_added.join(' ') + ' links' : '');
}

function attr_explanation(diff)
{
    //var nodes_changed = _.map(diff.__type_node0
    return '' + diff;
}

function explanation_from_diff(diff)
{
    if (is_topo(diff)) {
        return topo_explanation(diff);
    }
    if (is_attr(diff)) {
        return attr_explanation(diff);
    }

}

function time_diff(d1, d2)
{
    var delta = Math.floor((d2 - d1) / 1000.0),
        seconds = delta % 60,
        minutes = (delta / 60) % 60,
        hours = (delta / 3600) % 24,
        days = Math.floor((delta / 86400));

    if (delta < 60) {
        return '' + delta + ' seconds ago';
    }
    if (delta < 3600) {
        return '' + minutes + 'minutes and ' + seconds + ' seconds ago';
    }
    return '' + days + ' days, ' + minutes + ' minutes and ' + seconds + ' seconds ago';
}

/**
 * appendActivity(activity)
 *
 * [!] should be diff?
 *
 */
function appendActivity(diff)
{
    var new_div = $('<div class="activity-div"></div>'),
        meta = diff.meta || {},
        creation_date = meta.ts_created !== undefined ? new Date(meta.ts_created) : new Date(),
        commit = meta.commit, // [!] unused, should link to permanent url
        author = meta.author || 'Anonymous',
        sentence = meta.sentence,
        affected_node_ids = node_ids_from_diff(diff),
        affected_link_ids = link_ids_from_diff(diff),
        affected_nodes = _.filter(_.map(affected_node_ids, graph.find_node__by_id), null),
        affected_links = _.filter(_.map(affected_link_ids, graph.find_link__by_id), null);
        explanation = (sentence !== undefined && sentence.length > 0) ? sentence : explanation_from_diff(diff);

    new_div.text(creation_date + ' ' + author + ': ' + explanation);
    activity_element.prepend(new_div);
    new_div.on('click', function (event) {
        (event.shiftKey ? selection.invert_both : selection.select_both)
            (affected_nodes, affected_links);
    });
    // TODO - x button
    // TODO - format of text per activity (topo/attr)
    // TODO - user data (requires protocol update?)
}

incomingActivityBus.onValue(appendActivity);

return {
    init: init,
    incomingActivityBus: incomingActivityBus,
};

}); // close define
