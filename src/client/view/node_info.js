define(['jquery', 'jquery-ui', 'util', 'view/helpers', 'view/internal', 'model/diff', 'model/types'],
function($, _unused_jquery_ui,  util,   view_helpers, internal,          model_diff,   model_types) {

var d = null,
    msg_node = $('.info-card-message'),
    graph,
    node,
    setup_done = false,
    info = $('.info'),
    form_element = $('#editbox'),
    delete_button = $('#edit-node-dialog__delete'),
    form = _.object(model_types.all_attributes.map(function (attr) {
            var element = edit_element_for_attribute(attr);

            util.assert(element !== undefined);
            return [attr, element];
        })),
    change_handlers = [],
    status_display = info.find('#displaystatus'),
    status = info.find('#editstatus');


function clean_url(candidate_url)
{
    if (candidate_url.length == 0) {
        return '';
    }
    if (candidate_url.search('://') != -1) {
        return candidate_url;
    }
    return 'https://' + candidate_url;
}

function _get_form_data() {
    var ret = _.object(_.keys(form),_.values(form).map(function (x) { return x.val(); }));

    ret.url = clean_url(ret.url);
    return ret;
}

function commit()
{
    graph.update_node(node, _get_form_data());
}

function textarea_resize(text, max)
{
    var height;
    text.style.height = 'auto';
    height = text.scrollHeight;
    if (max) {
        height = Math.min(max, height);
    }
    text.style.height = height + 'px';
}

function setup_change_handlers()
{
    disable_change_handlers();
    // auto save style handlers
    var streams = _.map(_.values(form), function (element) {
        return element.asEventStream('change input keyup');
    });
    var single = _.reduce(streams, function (stream_a, stream_b) { return stream_a.merge(stream_b); });
    change_handlers = [single.debounce(500).onValue(function () {
        commit();
    })];
}

function disable_change_handlers()
{
    _.each(change_handlers, function (unsub) { unsub(); });
    change_handlers = [];
}

/**
 * XXX
 * need to update fields if and only if there have been no new input events associated with them since commit.
 * do not look at contents because that will exist in the past too.
 *
 * see Bacon.awaiting.
 *
 * For now we just show a warning instead telling the user the dialog is not up to date.
 */
function setup_click_handlers()
{
    setup_change_handlers();
    if (setup_done) {
        return;
    }
    setup_done = true;
    form_element.on('keydown', function (e) {
        if (e.which == 13 && e.target !== delete_button[0]) {
            e.preventDefault();
        }
    });
    delete_button.on('click', function (e) {
        e.preventDefault();
        hide();
        if (confirm('delete node?')) {
            graph.nodes__delete([node.id]);
        }
    });
    $('#edit-node-dialog__save').on('click', function (e) {
        e.preventDefault();
        hide();
        commit();
    });
    // re-open dialog on node updates while it is open
    diffBusUnsubscribe = graph.diffBus.onValue(function (diff) {
        if (model_diff.is_topo_diff(diff) && _.contains(diff.node_id_set_rm, node.id)) {
            warning('!! node has been deleted !!');
            return;
        }
        if (model_diff.is_attr_diff(diff) || _.contains(_.keys(diff.id_to_node_map), node.id)) {
            warning('!! node has been changed !!');
            return;
        }
    });
}

function warning(string)
{
    msg_node.text(string);
}

function base_element_for_attribute(attr)
{
    return info.find('#' + attr);
}

function edit_element_for_attribute(attr)
{
    return info.find('#edit' + attr);
}

function update_textarea(textarea, value)
{
    textarea.val(value);
    textarea_resize(textarea[0], 150);
}

function show(_graph, d) {
    var visible_attributes = model_types.type_attributes(d.type).slice(0),
        hidden_attributes = _.difference(model_types.all_attributes, visible_attributes),
        visible_elements,
        hidden_elements;

    visible_elements = visible_attributes.map(base_element_for_attribute);
    hidden_elements = hidden_attributes.map(base_element_for_attribute);
    warning(''); // reset warning
    graph = _graph;
    node = d;
    util.assert(graph.find_node__by_id(d.id) != null);

    setup_click_handlers();

    internal.edit_tab.show('node');

    _.each(hidden_elements, function (element) { element.hide(); });
    _.each(visible_elements, function (element) { element.show(); });

    $('.info').attr('class', 'info');
    $('.info').addClass('type-' + d.type); // Add a class to distinguish types for css

    _.each(visible_attributes, function (attr) {
        var element = edit_element_for_attribute(attr);
            value = d[attr];

        switch (attr) {
        case 'enddate':
        case 'startdate':
            element.datepicker({
              inline: true,
              showOtherMonths: true,
              dayNamesMin: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            });
            break;
        case 'name':
        case 'description':
            update_textarea(element, value);
            break;
        case 'status':
            if (_.contains(rz_config.role_set, 'admin')) {
                status.val(d.status);
                status.show();
                status_display.hide();
            } else {
                status_display.text(d.status);
                status.hide();
                status_display.show();
            }
            break;
        }
        if (element.val !== undefined) {
            element.val(value);
        }
    });

}

function hide() {
    node_id = null;
    internal.edit_tab.hide();
}

return {
    show: show,
    hide: hide,
    isOpenProperty: internal.edit_tab.isOpenProperty,
};

});
