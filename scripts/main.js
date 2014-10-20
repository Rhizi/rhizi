define('main', ['rhizicore', 'textanalysis.ui', 'buttons', 'history', 'drag_n_drop', 'robot'],
function(RZ, textanalysis_ui, buttons, history, drag_n_drop, robot) {
return {
main: function() {
    console.log('Rhizi main started');
    drag_n_drop.init();
    $('#editname').onkeyup = function() { RZ.expand(this); };
    $('#editlinkname').onkeyup = function() { RZ.expand(this); };
    $('#textanalyser').onkeyup = function() { RZ.expand(this); };

    textanalysis_ui.main();
}};
});
