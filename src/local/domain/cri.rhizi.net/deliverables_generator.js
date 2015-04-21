var fs = require('fs');

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function deliverableTest() {
    links=[];
    nodes=[];
    var status = "unknown";
    var nodecounter = 150;

    var addLink = function (source, target, name) {
        links.push({source:source, target:target, name:name});
    };

    for (var i = 0; i < nodecounter; i++) {
        if (Math.random() > 0.7) status = "done";
        else if (Math.random() > 0.5) status = "current";
        else status = "waiting";
        var end = randomDate(new Date(), new Date("01/01/2018"));
        var start = randomDate(new Date(), end);
        nodes.push({id:"Task " + i, name: "Task " + i,
                   type:"deliverable", start:start, end:end,
                   status:'status'});
    }

    for (var i = 0; i < nodecounter; i++) {
        var endindex = Math.floor(Math.random() * nodecounter);
        var startindex = Math.floor(Math.random() * nodecounter);
        if (nodes[endindex].start > nodes[startindex].start && startindex !== endindex) {
            addLink("Task " + startindex, "Task " + endindex, "depends on", "perm");
        } else {
            addLink("Task " + endindex, "Task " + startindex, "depends on", "perm");
        }
    }

    return {nodes:nodes, links:links};
}

fs.writeFileSync('deliverables.json', JSON.stringify(deliverableTest()));
