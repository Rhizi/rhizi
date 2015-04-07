define(['jquery', 'jquery-ui', 'util', 'consts', 'view/helpers', 'model/diff', 'model/types', 'model/graph', 'messages'],
function($, _unused_jquery_ui,  util,   consts,   view_helpers,   model_diff,   model_types,  graph,          messages) {

"strict"

// constants
var DEBOUNCE_TIME = 500; // milliseconds

// aliases
var is_node = graph.is_node;

// variables
var msg_node = $('.info-card-message'),
    setup_done = false,
    info = $('#info'),
    info_container = $('.info-container'),
    form_element = $('#editbox'),
    delete_button = $('#edit-dialog__delete'),
    form = _.object(model_types.all_attributes.map(function (attr) {
            var element = edit_element_for_attribute(attr);

            if (element.length == 0) {
                element = form_add_element(attr, 'textarea');
            }
            return [attr, element];
        })),
    change_handlers = [],
    status_display = info.find('#displaystatus'),
    status = info.find('#editstatus'),
    diffBusUnsubscribe,
    outside_change = false,
    visible_attributes,
    item,
    graph,
    edited_attributes;

/**
 *  Adds the div with the label, return the edit child
 */
function form_add_element(attr, value_element_type)
{
    var div = $('<div></div>'),
        label = $('<label></label>'),
        value = $('<' + value_element_type + '></' + value_element_type + '>'),
        delete_button = form_element.find('#info-container__bottom-btn-bar');

    div.attr('id', attr);
    label.addClass('info-card-attr');
    label.text(model_types.attribute_titles[attr] + ':');
    value.addClass('info-card-attr-val');
    value.attr('id', 'edit' + attr);
    div.append(label);
    div.append(value);
    div.insertBefore(delete_button);
    return value;
}

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
    ret = _.pick(ret, _.keys(edited_attributes));
    return ret;
}

function update_item(item, new_data)
{
    if (is_node(item)) {
        graph.update_node(item, new_data);
    } else {
        graph.update_link(item, new_data);
    }
}

function get_item_from_graph()
{
    return is_node(item) ? graph.find_node__by_id(item.id) : graph.find_link__by_id(item.id);
}

function no_change()
{
    return _.isEqual(_.pick(get_item_from_graph(), _.keys(edited_attributes)), _get_form_data());
}

function commit()
{
    if (item === null || outside_change || no_change()) {
        return;
    }
    update_item(item, _get_form_data());
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
    // auto save after DEBOUNCE_TIME inactivity
    var streams = _.map(_.values(form), function (element) {
        return element.asEventStream('change input keyup');
    });
    streams.forEach(function (stream) {
        stream.onValue(function (e) {
            edited_attributes[e.target.id.slice(4)] = 1;
        });
    });
    var single = _.reduce(streams, function (stream_a, stream_b) { return stream_a.merge(stream_b); });
    change_handlers = [single.debounce(DEBOUNCE_TIME).onValue(function () {
        commit();
    })];
}

function disable_change_handlers()
{
    _.each(change_handlers, function (unsub) { unsub(); });
    change_handlers = [];
}

function delete_item()
{
    if (is_node(item)) {
        graph.nodes__delete([item.id]);
    } else {
        graph.links__delete([item.id]);
    }
}

/**
 * XXX
 * need to update fields iff there have been no new input events associated with them since commit.
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
        if (e.which == consts.VK_ENTER && e.target !== delete_button[0]) {
            e.preventDefault();
        }
    });
    delete_button.on('click', function (e) {
        e.preventDefault();
        if (confirm(messages.delete_items_message([item]))) {
            delete_item(item);
        }
        hide();
    });
    $('#edit-dialog__save').on('click', function (e) {
        e.preventDefault();
        commit();
        hide();
    });

    // warn user if the item has been changed while open
    diffBusUnsubscribe = graph.diffBus.onValue(function (diff) {
        var removed_set = is_node(item) ? diff.node_id_set_rm : diff.link_id_set_rm,
            changed_set = is_node(item) ? diff.id_to_node_map : diff.id_to_link_map;
            
        if (model_diff.is_topo_diff(diff) && _.contains(removed_set, item.id)) {
            warning('!! item has been deleted !!');
            return;
        }
        if (model_diff.is_attr_diff(diff) && _.contains(_.keys(changed_set), item.id)) {
            var changed = changed_set[item.id]['__attr_write'],
                changed_keys = _.keys(changed),
                form_subset = _.pick(_get_form_data(), changed_keys);

            if (!_.isEqual(form_subset, changed)) {
                warning('!! item has been changed !!');
                outside_change = true;
            }
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

function show(_graph, new_item, new_visible_attributes)
{
    var hidden_attributes,
        visible_elements,
        hidden_elements,
        max_height;

    visible_attributes = new_visible_attributes || model_types.type_attributes(new_item.type).slice(0);
    hidden_attributes = _.difference(model_types.all_attributes, visible_attributes),
    visible_elements = visible_attributes.map(base_element_for_attribute);
    hidden_elements = hidden_attributes.map(base_element_for_attribute);
    warning(''); // reset warning
    graph = _graph;
    item = new_item;
    util.assert(get_item_from_graph() != null);

    setup_click_handlers();

    _.each(hidden_elements, function (element) { element.hide(); });
    _.each(visible_elements, function (element) { element.show(); });

    info.attr('class', 'info');
    info.addClass('type-' + item.type); // Add a class to distinguish types for css

    // hack - should be able to set max-height via css percentage, no?
    max_height = $(document.body).innerHeight() - $('.info')[0].getBoundingClientRect().top * 2;
    info_container[0].style['max-height'] = String(max_height) + 'px';

    info_container.show();
    _.each(visible_attributes, function (attr) {
        var element = edit_element_for_attribute(attr);
            value = item[attr];

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
                status.val(item.status);
                status.show();
                status_display.hide();
            } else {
                status_display.text(item.status);
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

function init() {
    item = null;
    outside_change = false;
    graph = undefined;
    visible_attributes = [];
    edited_attributes = {};
}

function hide(do_commit) {
    do_commit = do_commit === undefined || true;
    if (do_commit) {
        commit();
    }
    if (diffBusUnsubscribe) {
        diffBusUnsubscribe();
    }
    init();
    info_container.hide();
}

function first_time_init() {
    // setup the special type select box based on the domain.
    var root = info.find('#edittype');

    model_types.nodetypes.forEach(function (nodetype) {
        root.append($('<option value="' + nodetype + '">' + util.capitalize(nodetype) + '</option>'));
    });
}

first_time_init();
init();

return {
    show: show,
    hide: hide,
};

});
