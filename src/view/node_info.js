define(['jquery', 'jquery-ui', 'view/helpers', 'view/internal'],
function($, _unused_jquery_ui,  view_helpers, internal) {

var d = null,
    submit_callback = null,
    delete_callback = null;

function _get_form() {
    return {
        name: $('.info #editformname').val(),
        type: $('.info #edittype').val(),
        url: $('.info #editurl').val(),
        status: $('.info #editstatus').val(),
        startdate: $("#editstartdate").val(),
        enddate: $("#editenddate").val(),
    };
}

//internal.edit_tab.get('node', "#editbox").submit(function(e) {
//    if (submit_callback) {
//        return submit_callback(e, _get_form_data());
//    }
//    console.log('bug: edit tab submit called with no callback set');
//    e.preventDefault();
//})

//internal.edit_tab.get('node', "#deletenode").click(function(e) {
//    if (delete_callback) {
//        return delete_callback(e, _get_form_data());
//    }
//    console.log('bug: edit tab delete called with no callback set');
//    e.preventDefault();
//});

function show(d) {
    var info = $('.info'),
        f = false,
        t = true,
        visible = {
          "third-internship-proposal":  [t, t, t, f, f],
          "chainlink":                  [f, f, f, f, f],
          "skill":                      [f, f, f, f, t],
          "interest":                   [f, f, f, f, t],
          "_defaults":                  [f, f, f, f, t],
        },
        fields = ["#status", "#startdate", "#enddate", "#desc", "#url"],
        flags = visible.hasOwnProperty(d.type) ? visible[d.type] : visible._defaults,
        i;
    
    internal.edit_tab.show('node');

    for (i = 0 ; i < flags.length; ++i) {
        var elem = info.find(fields[i]);
        elem[flags[i] ? 'show' : 'hide']();
    }

    $('.info').attr('class', 'info');
    $('.info').addClass('type-' + d.type); // Add a class to distinguish types for css

    $('.info').find('#editformname').val(d.name);
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

    $('#editdescription').val(d.type);

    $('#edittype').val(d.type);

    $('#editurl').val(d.url);

    $('#editstatus').val(d.status);

    if (d.type === "third-internship-proposal") {
      $('#editstartdate').val(d.start);
      $('#editenddate').val(d.end);
    }
}

function hide()
{
    internal.edit_tab.hide();
}

function on_save(f) {
    $('#edit-node-dialog__save').click(function(e) {
            return f(e, _get_form_data());
    });
}

function on_delete(f) {
    $('#edit-node-dialog__delete').click(function(e) {
        return f(e, _get_form_data());
    });
}

function on_keyup(f) {
    $('.info').keyup(function(e) {
        return f(e, _get_form_data());
    });
}

return {
    show: show,
    hide: hide,
    on_submit: on_submit,
    on_delete: on_delete,
};

});
