define(['jquery', 'Bacon'],
function($,        Bacon) {

var incomingActivityBus = new Bacon.Bus(),
    activity_element;

function init(graph_view)
{
    activity_element = $('<div class="activity-root-div"></div>');
    graph_view.append(activity_element);
}

function appendActivity(topo_diff_spec)
{
    var new_div = $('<div></div>');

    new_div.text('' + topo_diff_spec);
    activity_element.append(new_div);
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
