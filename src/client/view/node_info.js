define(['jquery', 'jquery-ui', 'view/helpers', 'view/internal'],
function($, _unused_jquery_ui,  view_helpers, internal) {

var d = null,
    save_callback = function() {},
    delete_callback = function() {},
    keyup_callback = function() {};

function _get_form_data() {
    return {
        name: $('.info #editformname').val(),
        type: $('.info #edittype').val(),
        url: $('.info #editurl').val(),
        status: $('.info #editstatus').val(),
        startdate: $("#editstartdate").val(),
        enddate: $("#editenddate").val(),
        description: $("#editdescription").val(),
    };
}

function textarea_resize(text)
{
    text.style.height = 'auto';
    text.style.height = text.scrollHeight + 'px';
}

$('#edit-node-dialog__delete').click(function(e) {
    e.preventDefault();
    return delete_callback(e, _get_form_data());
});

$('#edit-node-dialog__save').click(function(e) {
    e.preventDefault();
    return save_callback(e, _get_form_data());
});
$('.info').keyup(function(e) {
    return keyup_callback(e, _get_form_data());
});

function show(d) {
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

    internal.edit_tab.show('node');

    for (i = 0 ; i < flags.length; ++i) {
        var elem = info.find(fields[i]);
        elem[flags[i] ? 'show' : 'hide']();
    }

    $('.info').attr('class', 'info');
    $('.info').addClass('type-' + d.type); // Add a class to distinguish types for css

    var name_textarea = $('.info').find('#editformname');
    name_textarea.val(d.name);
    textarea_resize(name_textarea[0]);

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

    $('#editdescription').val(d.description);
    $('#edittype').val(d.type);
    $('#editurl').val(d.url);
    $('#editstatus').val(d.status);

    if (d.type === "third-internship-proposal") {
      $('#editstartdate').val(d.start);
      $('#editenddate').val(d.end);
    }
}

function hide() {
    internal.edit_tab.hide();
}

function on_save(f) {
    save_callback = f;
}

function on_delete(f) {
    delete_callback = f;
}

function on_keyup(f) {
    keyup_callback = f;
}

return {
    show: show,
    hide: hide,
    isOpenProperty: internal.edit_tab.isOpenProperty,
    on_save: on_save,
    on_delete: on_delete,
    on_keyup: on_keyup,
};

});
