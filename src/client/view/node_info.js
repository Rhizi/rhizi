define(['jquery', 'jquery-ui', 'util', 'view/helpers', 'view/internal', 'model/diff'],
function($, _unused_jquery_ui,  util,   view_helpers, internal,          model_diff) {

var d = null,
    msg_node = $('.info-card-message'),
    node,
    setup_done = false;


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
    return {
        name: $('.info #editformname').val(),
        type: $('.info #edittype').val(),
        url: clean_url($('.info #editurl').val()),
        status: $('.info #editstatus').val(),
        startdate: $("#editstartdate").val(),
        enddate: $("#editenddate").val(),
        description: $("#editdescription").val(),
    };
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

function setup_click_handlers(graph)
{
    if (setup_done) {
        return;
    }
    setup_done = true;
    $('#edit-node-dialog__delete').on('click', function (e) {
        e.preventDefault();
        hide();
        var topo_diff = model_diff.new_topo_diff({
                node_id_set_rm: [node.id]
            });
        graph.commit_and_tx_diff__topo(topo_diff);
        });
    $('#edit-node-dialog__save').on('click', function (e) {
        e.preventDefault();
        hide();
        graph.update_node(node, _get_form_data());
    });
    // re-open dialog on node updates while it is open
    diffBusUnsubscribe = graph.diffBus.onValue(function (diff) {
        if (model_diff.is_topo_diff(diff) && _.contains(diff.node_id_set_rm, node.id)) {
            warning('node has been deleted');
            return;
        }
        if (!model_diff.is_attr_diff(diff) || _.contains(_.keys(mode_diff.id_to_node_map), node.id)) {
            warning('node has been changed');
            return;
        }
        show(graph, node);
    });
}

function warning(string)
{
    msg_node.val(string);
}

function show(graph, d) {
    var info = $('.info'),
        f = false,
        t = true,
        visible = {
          "third-internship-proposal":  [t, t, t, t, f],
          "chainlink":                  [f, f, f, t, f],
          "skill":                      [f, f, f, t, t],
          "interest":                   [f, f, f, t, t],
          "_defaults":                  [f, f, f, t, t],
        },
        fields = ["#status", "#startdate", "#enddate", "#description", "#url"],
        flags = visible.hasOwnProperty(d.type) ? visible[d.type] : visible._defaults,
        i;

    util.assert(graph.find_node__by_id(d.id) != null);
    node = d;

    setup_click_handlers(graph);

    internal.edit_tab.show('node');

    for (i = 0 ; i < flags.length; ++i) {
        var elem = info.find(fields[i]);
        elem[flags[i] ? 'show' : 'hide']();
    }

    $('.info').attr('class', 'info');
    $('.info').addClass('type-' + d.type); // Add a class to distinguish types for css

    var name_textarea = $('.info').find('#editformname');
    name_textarea.val(d.name);
    textarea_resize(name_textarea[0], 150);

    $("#editenddate").datepicker({
      inline: true,
      showOtherMonths: true,
      dayNamesMin: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    });
    $("#editstartdate").datepicker({
      inline: true,
      showOtherMonths: true,
      dayNamesMin: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    });

    var description = $('#editdescription');
    description.val(d.description);
    textarea_resize(description[0], 150);
    $('#edittype').val(d.type);
    $('#editurl').val(d.url);
    $('#editstatus').val(d.status);

    if (d.type === "third-internship-proposal") {
      $('#editstartdate').val(d.startdate);
      $('#editenddate').val(d.enddate);
    }
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
