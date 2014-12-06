define(['jquery', 'jquery-ui', 'view/helpers', 'view/internal'],
function($, _unused_jquery_ui,  view_helpers, internal) {

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
        fields = ["status", "startdate", "enddate", "desc", "url"],
        flags = visible.hasOwnProperty(d.type) ? visible[d.type] : visible._defaults,
        i;
    
    internal.edit_tab.show('node');

    for (i = 0 ; i < flags.length; ++i) {
        if (flags[i]) {
            info.find(fields[i]).show();
        } else {
            info.find(fields[i]).hide();
        }
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

function on_submit(f)
{
    internal.edit_tab.get('node', "#editbox").submit(f);
}

function on_delete(f)
{
    internal.edit_tab.get('node', "#deletenode").click(f);
}

return {
    show: show,
    hide: hide,
    on_submit: on_submit,
    on_delete: on_delete,
};

});
