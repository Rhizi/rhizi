define(['jquery', 'view/helpers'],
function($, view_helpers) {

function show(d) {
    $('.info').fadeIn(300);

    if (d.type === "deliverable") {
      $('.info').html('Name: ' + d.id + '<br/><form id="editbox"><label>Type:</label><select id="edittype"><option value="person">Person</option><option value="project">Project</option><option value="skill">Skill</option><option value="deliverable">Deliverable</option><option value="objective">Objective</option></select><br/><label>Status</label><select id="editstatus"><option value="waiting">Waiting</option><option value="current">Current</option><option value="done">Done</option></select><br/><label>Start date:</label><input id="editstartdate"/></br><label>End date:</label><input id="editenddate"/></br><button>Save</button><button id="deletenode">Delete</button></form>');
    } else if(d.type=== "chainlink"){
      $('.info').html('Name: ' + d.id + '<br/><form id="editbox"><button>Save</button><button id="deletenode">Delete</button></form>');
    }else{
      $('.info').html('Name: ' + d.id + '<br/><form id="editbox"><label>Type:</label><select id="edittype"><option value="person">Person</option><option value="project">Project</option><option value="skill">Skill</option><option value="deliverable">Deliverable</option><option value="objective">Objective</option></select><br/><label>URL:</label><input id="editurl"/><br/><button>Save</button><button id="deletenode">Delete</button></form>');
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

    if (d.type === "deliverable") {
      $('#editstartdate').val(d.start);
      $('#editenddate').val(d.end);
    }
}

function hide()
{
    $('.info').fadeOut(300);
}

function on_submit(f)
{
    $("#editbox").submit(f);
}

function on_delete(f)
{
    $("#deletenode").click(f);
}

return {
    show: show,
    hide: hide,
    on_submit: on_submit,
    on_delete: on_delete,
};

});
