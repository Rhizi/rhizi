define(['jquery', 'view/helpers', 'view/internal'],
function($, view_helpers, internal) {

function show(d) {
    var editURL = '';

    internal.edit_tab.show('node');

    if (d.type === "third-internship-proposal") {
      $('.info').html('Name: ' + d.name + '<br/><form id="editbox"><label>Type:</label><select id="edittype"><option value="person">Person</option><option value="club">Club</option><option value="skill">Skill</option><option value="interest">Interest</option><option value="third-internship-proposal">Third-internship-proposal</option><option value="internship">Internship</option></select><br/><label>Status</label><select id="editstatus"><option value="waiting">Waiting</option><option value="approved">Approved</option><option value="notapproved">Not Approved</option></select><br/><label>Start date:</label><input id="editstartdate"/></br><label>End date:</label><input id="editenddate"/></br><button>Save</button><button id="deletenode">Delete</button></form>');
    } else if(d.type=== "chainlink"){
      $('.info').html('Name: ' + d.name + '<br/><form id="editbox"><button>Save</button><button id="deletenode">Delete</button></form>');
    }else{
      if (d.type !== 'skill' && d.type !== 'interest') {
        editURL = '<label>URL:</label><input id="editurl"/>'
      }
      $('.info').html('Name: ' + d.name + '<br/><form id="editbox"><label>Type:</label><select id="edittype"><option value="person">Person</option><option value="club">Club</option><option value="skill">Skill</option><option value="interest">Interest</option><option value="third-internship-proposal">Third-internship-proposal</option><option value="internship">Internship</option></select><br/>' + editURL + '<br/><button>Save</button><button id="deletenode">Delete</button></form>');
    }

    $('.info').css("border-color", view_helpers.customColor(d.type));

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
