define(['textanalysis.ui', 'buttons', 'history', 'drag_n_drop', 'robot'],
function(textanalysis_ui, buttons, history, drag_n_drop, robot) {

    function expand(obj){
        if (!obj.savesize) {
            obj.savesize = obj.size;
        }
        obj.size = Math.max(obj.savesize, obj.value.length);
    }

    this.main = function() {
        console.log('Rhizi main started');
        drag_n_drop.init();
        $('#editname').onkeyup = function() { expand(this); };
        $('#editlinkname').onkeyup = function() { expand(this); };
        $('#textanalyser').onkeyup = function() { expand(this); };

        textanalysis_ui.main();
    }
    
    return {
        main: main };
    }
);
