/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

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
