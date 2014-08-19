"use strict"

//CORE VARIABLES
var addednodes = [];

var vis;

var graphstate = "GRAPH";
var graphinterval = 0;

var ganttTimer = 0;

var boxedin = false;

var deliverables = [];

var boxedin, nodetext, linktext, link, links, node, nodes, circle;

var scrollValue = 0,
    zoomLevel = 0,
    zoomObject;

var force;

function myGraph(el) {

    this.update = function(){
        update();
    }

    function makeNewNode(spec) {
        return {
            'id': spec.id,
            'text': spec.text,
            'type': spec.type,
            'state': spec.state,
            'start': spec.start,
            'end': spec.end,
            'status': spec.status,
            'url': spec.url
        };
    }

    ///FUNCTIONS
    this.addNode = function(id, type, state) {
        var start = 0,
            end = 0;
        var status = "unknown";
        var text = id;
        id = id.toLowerCase();
        var node = findNode(id, null);
        if (node !== undefined) {
            console.log('addNode: node of same id exists: ' + id);
            //graph.editState(id, null, "temp");
        } else {
            var new_node = makeNewNode({
                "id": id,
                "text": text,
                "type": type,
                "state": state,
                "start": start,
                "end": end,
                "status": status
            });
            nodes.push(new_node);
            if (this.history !== undefined) {
                this.history.record_nodes([new_node]);
            }
        }
    }

    this.addNodeComplete = function(id, type, state, start, end, status) {
        // No history recorded - this is a helper for loading from files / constant graphs
        var text = id;
        id = id.toLowerCase();
        var node = findNode(id, null);
        if (node !== undefined) {
            graph.editState(id, null, "temp");
        } else {
            nodes.push(makeNewNode({
                "id": id,
                "text": text,
                "type": type,
                "state": state,
                "start": start,
                "end": end,
                "status": status
            }));

        }

    }

    this.removeNode = function(id, state) {
        var i = 0;
        id = id.toLowerCase();
        var n = findNode(id, state);
        while (i < links.length) {
            if ((links[i]['source'] === n) || (links[i]['target'] == n)) links.splice(i, 1);
            else i++;
        }
        var index = findNodeIndex(id, state);
        if (index !== undefined) {
            nodes.splice(index, 1);
        }
        if (this.history != undefined) {
            this.history.record_nodes_removal([id]);
        }
    }

    this.removeNodes = function(state) {
        var id = null;
        var ns = findNodes(null, state);
        for (var j = 0; j < ns.length; j++) {
            var n = ns[j];
            var i = 0;
            while (i < links.length) {
                if ((links[i]['source'] === n) || (links[i]['target'] == n)) links.splice(i, 1);
                else i++;
            }
            var index = findNodeIndex(id, state);
            if (index !== undefined) {
                nodes.splice(index, 1);
            }
        }
        if (ns.length > 0 && this.history !== undefined) {
            this.history.record_nodes_removal(ns.map(function(n) { return n.id; }));
        }
    }


    this.highlightNode = function(id, state) {
        var i = 0,
            j = 0;
        var n = findNode(id, state);
        var adjacentnode;
        $(".debug").html(n.state);

        //highlight node
        if (n !== undefined && n.state !== "chosen" && n.state !== "temp") {
            this.removeHighlight();
            n.state = "chosen";

            while (i < links.length) {
                if (links[i]['source'] === n) {
                    adjacentnode = findNode(links[i]['target'].id, null);
                    if (adjacentnode.state !== "temp") adjacentnode.state = "exit";
                    links[i]['state'] = "exit";

                    if(links[i]['target'].type==="chainlink"){
                        console.log("chain");
                        while (j < links.length) {
                            if(links[i]['target'].id===links[j]['target'].id && links[j]['target'].type==="chainlink" && links[j]['target'].state!=="temp"){
                                adjacentnode = findNode(links[j]['source'].id, null);
                                if (adjacentnode.state !== "temp") adjacentnode.state = "enter";
                                links[j]['state'] = "enter";
                            }
                            j++;
                        }
                    }
                    j=0;
                }
                if (links[i]['target'] === n) {
                    adjacentnode = findNode(links[i]['source'].id, null);
                    if (adjacentnode.state !== "temp") adjacentnode.state = "enter";
                    links[i]['state'] = "enter";
                }
                i++;
            }
        }
    }

    this.removeHighlight = function() {
        var k = 0;
        while (k < nodes.length) {
            if (nodes[k]['state'] === "enter" || nodes[k]['state'] === "exit" || nodes[k]['state'] === "chosen") {
                nodes[k]['state'] = "perm";
            }
            k++;
        }
        var j = 0;
        //highlight all connections
        while (j < links.length) {
            links[j]['state'] = "perm";
            j++;
        }
    }

    this.addLink = function(sourceId, targetId, name, state) {
        sourceId = sourceId && sourceId.toLowerCase();
        targetId = targetId && targetId.toLowerCase();
        var sourceNode = findNode(sourceId, null);
        var targetNode = findNode(targetId, null);
        var found = findLink(sourceId,targetId,name);
        
        if(name)if(name.replace(/ /g,"")==="and")state="temp";
        if(!found && ((sourceNode !== undefined) && (targetNode !== undefined))) {
            var link = {
                "source": sourceNode,
                "target": targetNode,
                "name": name,
                "state": state
            };
            links.push(link);
            if (this.history !== undefined) {
                this.history.record_links([link]);
            }
        }
    }

    this.editLink = function(sourceId, targetId, newname) {
        var link = findLink(sourceId, targetId, newname);
        if (link !== undefined) {
            link.name = newname;

        } else {}
    }

    this.editLinkTarget = function(sourceId, targetId, newTarget) {
        var link = findLink(sourceId, targetId, null);
        if (link !== undefined) {
            link.target = findNode(newTarget, null);

        } else {

        }
    }

    this.editName = function(id, type, newname) {
        var new_text = newname;
        id = id && id.toLowerCase();
        var new_id = newname.toLowerCase();
        var index = findNode(id, type);
        var index2 = findNode(new_id, type);
        var acceptReplace=true;

        if ((index !== undefined)) {
            if ((index2 !== undefined)) {
                acceptReplace = confirm(index2.id+" will replace "+index.id+", are you sure?");
                if(acceptReplace){
                    for (var i = 0; i < links.length; i++) {
                    if (links[i].source === index) {
                        links[i].source = index2;
                    }

                    if (links[i].target === index) {
                        links[i].target = index2;
                    }
                }
                graph.removeNode(index.id,null);
                }
            }else{
                index.id = new_id;
                index.text = new_text;
            }
        }
    }

    this.editDates = function(id, type, start, end) {
        var index = findNode(id, type);
        if ((index !== undefined)) {
            index.start = start;
            index.end = end;

        }
    }



    this.editType = function(id, state, newtype) {
        var index = findNode(id, state);
        if ((index !== undefined)) {
            index.type = newtype;
            update();
        }
    }

    this.editURL = function(id, state, url) {
        var index = findNode(id, state);
        if ((index === undefined)) return;
        index.url = url;
        update();
    }

    this.editState = function(id, state, newstate) {
        var index = findNode(id.toLowerCase(), state);
        if ((index !== undefined)) {
            index.state = newstate;
        }
    }

    this.findCoordinates = function(id, type) {
        var index = findNode(id, type);
        if ((index !== undefined)) {
            $('.typeselection').css('top', index.y - 90);
            $('.typeselection').css('left', index.x - 230);
        }
    }

    this.updateGraph = function() {

    }

    this.recenterZoom = function() {
        vis.attr("transform", "translate(0,0)scale(1)");
    }

    this.removeLinks = function(state) {
        var id = null;
        var ls = findLinks(state);
        for (var j = 0; j < ls.length; j++) {
            var l = ls[j];
            var i = 0;
            while (i < links.length) {
                if (links[i] === l) links.splice(i, 1);
                else i++;
            }
        }
    }

    var findLink = function(sourceId, targetId, name) {
        for (var i = 0; i < links.length; i++) {
            if (links[i].source.id === sourceId && links[i].target.id === targetId) {
                return links[i];
            }
        }
    }

    var findLinks = function(state) {
        var foundLinks = [];
        for (var i = 0; i < links.length; i++) {
            if (links[i].state == state) {
                foundLinks.push(links[i]);
            }
        }
        return foundLinks;
    }


    var findNode = function(id, state) {
        //id=id.toLowerCase();
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id || nodes[i].state === state)
                return nodes[i]
        };
    }

    var findNodes = function(id, state) {
        //id=id.toLowerCase();
        var foundNodes = [];
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id || nodes[i].state === state)
                foundNodes.push(nodes[i]);
        }
        return foundNodes;
    }

    var findNodeIndex = function(id, state) {
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id || nodes[i].state === state)
                return i
        };
    }



    ///GRAPH BUILDER
    var w = $(el).innerWidth(),
        h = $(el).innerHeight();

    var color = d3.scale.category20();

    //Zoom scale behavior in zoom.js
    zoomObject = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);

    vis = this.vis = d3.select(el).append("svg:svg")
        .attr("width", w * 5)
        .attr("height", h )
        .attr("pointer-events", "all")
        .append("g")
        .call(zoomObject)
        .append("g");


    function zoom() {
        if (graphstate === "GRAPH") vis.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        if (graphstate === "GANTT") vis.attr("transform", "translate(0,0)scale(1)");
    }

    var drag = d3.behavior.drag()
    .origin(function(d) { return d; })
    .on("dragstart", dragstarted)
    .on("drag", dragged)
    .on("dragend", dragended);

    function dragstarted(d) {
        d3.event.sourceEvent.stopPropagation();
        d3.select(this).classed("dragging", true);
        force.stop();
    }

    function dragged(d) {
        d3.select(this).attr("cx", d.x = d3.event.x).attr("cy", d.y = d3.event.y);
        tick();
    }

    function dragended(d) {
        d3.select(this).classed("dragging", false);
        d3.select(this).classed("fixed", true);
        d3.select(this).attr("dx", d3.event.x).attr("dy", d3.event.y);
        tick();
        force.resume();
    }

    function load_from_json(json) {
        var data = JSON.parse(json);
        if (data == null) {
            console.log('load callback: no data to load');
            return;
        }
        for(var i=0; i<data["nodes"].length; i++){
          var node=data.nodes[i];
          graph.addNodeComplete(node.id,node.type,"perm",new Date(node.start),new Date(node.end),node.status);
        }

        for(var j=0; j<data["links"].length; j++){
          var link=data.links[j];
          graph.addLink(link.source,link.target,link.name,"perm");
        }
        graph.recenterZoom();
        graph.update();
        graph.clear_history();
    }
    this.load_from_json = load_from_json;

    function save_to_json() {
        var d = {"nodes":[], "links":[]};
        console.log(nodes);
        for(var i = 0 ; i < nodes.length ; i++){
          var node = nodes[i];
          d['nodes'].push({
            "id":node.id,
            "type":node.type,
            "state":"perm",
            "start":node.start,
            "end":node.end,
            "status": node.status
          });
        }
        for(var j=0 ; j < links.length ; j++){
          var link = links[j];
          d['links'].push({
            "source":link.source.id,
            "target":link.target.id,
            "name":link.name
          });
        }
        return JSON.stringify(d);
    }
    this.save_to_json = save_to_json;

    function set_user(user) {
        this.user = user;
        this.history = new History(this.user);
        console.log('new user: ' + user);
    }
    this.set_user = set_user;

    function clear_history() {
        this.history.clear();
    }
    this.clear_history = clear_history;

    force = d3.layout.force()
        .distance(120)
        .gravity(0.12)
        .charge(-1800)
        .size([w, h])
        .start();

    nodes = force.nodes();
    links = force.links();

    var update = function() {

        vis.selectAll(".graph").remove();

        link = vis.selectAll(".link")
            .data(links);

        vis.append("rect")
            .attr("class", "overlay graph")
            .attr("width", $(el).innerWidth()*12)
            .attr("height", $(el).innerHeight()*12)
            .attr("x", -$(el).innerWidth()*5)
            .attr("y", -$(el).innerHeight()*5);
        $('.overlay').click(mousedown);

        link.enter().append("svg:defs").selectAll("marker")
            .data(["end"]) // Different link/path types can be defined here
            .enter().append("svg:marker") // This section adds in the arrows
            .attr("id", String)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 22)
            .attr("refY", -1.5)
            .attr("markerWidth", 4)
            .attr("markerHeight", 4)
            .attr("orient", "auto")
            .attr("class", "graph")
            .style("fill", function(d){if(d.state==="enter" || d.state==="exit") return "EDE275";else return "#aaa";})
            .append("svg:path")
            .attr("d", "M0,-5L10,0L0,5");

        link.enter().append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("class", function(d) {

                if (d.state === "enter") {
                    return "enterlink graph";
                } else if (d.state === "exit") {
                    return "exitlink graph";
                } else return "link graph";

            })
            .style("stroke-dasharray", function(d,i){if(d.name)if(d.name.replace(/ /g,"")=="and" && d.state==="temp")return"3, 3";else return "0,0";})
            .attr("marker-end", "url(#end)")
            .on("click", function(d, i) {
                //$('#textanalyser').val("node("+d.source.id+") -> "+d.name+" -> node("+d.target.id+")");
            });;


        linktext = vis.selectAll(".linklabel").data(links);
        linktext.enter()
            .append("text")
            .attr("class", "linklabel graph")
            .attr("text-anchor", "middle")
            .text(function(d) {

                if ( d.name)if(d.target.state === "temp" || d.source.state === "chosen" || d.target.state === "chosen") {
                    if (d.name.length < 25 || d.source.state === "chosen" || d.target.state === "chosen" || d.state==="temp") {
                        return d.name;
                    } else {
                        return d.name.substring(0, 14) + "...";
                    }
                } else {
                    return " ";
                }

            })
            .on("click", function(d, i) {
                if(d.state!=="temp")editLink(d, i);
            });

        link.exit().remove();




        node = vis.selectAll(".node")
            .data(nodes, function(d) {
                return d.id;
            });

        var nodeEnter = node.enter()
            .append("g").call(drag);


        nodetext = nodeEnter.insert("text")
            .attr("class", "nodetext graph")
            .attr("dx", 15)
            .attr("dy", ".30em")
            .text(function(d) {
                if (d.state === "temp") return d.text;
                else if (d.state === "chosen") {
                    return d.text;
                } else {
                    if (d.text.length < 28) return d.text;
                    else return d.text.substring(0, 25) + "...";
                }
            })
            .on("click", function(d, i) {
                if(d.state!=="temp"){
                    editNode(d, i);
                    showInfo(d, i);
                }
            });



        circle = nodeEnter.insert("circle")
            .attr("class", "circle graph")
            .attr("r", function(d) {
                return customSize(d.type) - 2;
            })
            .style("fill", function(d) {
                return customColor(d.type);
            })
            .style("stroke", function(d) {
                if (d.state === "chosen") return "#EDE275";
                if (d.state === "enter") return "#EDE275";
                if (d.type === "bubble") return "#101010";
                if (d.state === "exit")  return "#EDE275";
                if (d.type === "chainlink")  return "#AAA";

                return "#fff";

            })
            .style("stroke-width", function(d) {
                if (d.state === "temp" && d.type !== "empty" || d.state === "chosen") return "3px";
                else return "1.5px";
            })
            .style("box-shadow", function(d) {
                if (d.state === "temp") return "0 0 40px #FFFF8F";
                else return "0 0 0px #FFFF8F";
            })
            .on("click", function(d, i) {
                 if(d.state!=="temp")showInfo(d, i);
                else graph.removeHighlight();

                graph.update();
            });

        //if(graphstate==="GANTT"){
        nodeEnter.append("svg:image")
            .attr("class", "status graph")
            .attr('x', -7)
            .attr('y', -8)
            .attr('width', 15)
            .attr('height', 15)
            .attr("xlink:href", function(d) {
                switch (d.status) {
                    case "done":
                        return "images/check.png";
                        break;
                    case "current":
                        return "images/wait.png";
                        break;
                    case "waiting":
                        return "images/cross.png";
                        break;
                }
            })
            .on("click", function(d, i) {
                if(d.state!=="temp")showInfo(d, i);
            });
        //}

        node.exit().remove();

        //d3.select("body").on("mousedown", mousedown);



        force.on("tick", tick);



        //update deliverables
        deliverables = [];
        for (var i = 0; i < nodes.length; i++) {
            var current = nodes[i];
            if (current.type === "deliverable") {
                deliverables.push({
                    "id": nodes[i].id,
                    "startdate": nodes[i].start,
                    "enddate": nodes[i].end
                });
            }
            //Do something
        }


        force.nodes(nodes)
            .links(links)
            .start();

    }

    update();
}


var graph = new myGraph(document.body);

var newnodes=1;
function tick(e) {
    //console.log(e);
    //$(".debug").html(force.alpha());

    function transform(d) {
        if (graphstate === "GRAPH" || d.type === "deliverable") {
            if (d.state === "temp") {

                return "translate(" + d.x + "," + d.y + ")";
            } else {
                return "translate(" + d.x + "," + d.y + ")";
            }
        } else {
            return "translate(0,0)";
        }
        return "translate(" + d.x + "," + d.y + ")";
    }


    function getCentroid(selection) {
        var element = selection.node(),
            bbox = element.getBBox();
        return [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];
    }


    if (graphstate === "GANTT") {
        var k = 20 * e.alpha;
        var today = new Date();
        var missingcounter = 0;

        nodes.forEach(function(d, i) {


            if ((d.start === 0 || d.end === 0)) {
                d.x = 450 + missingcounter * 100;
                d.y = window.innerWidth / 2;
                if (missingcounter >= 6) {
                    d.x = 450 + (missingcounter - 6) * 100;
                    d.y = window.innerWidth / 2 + 50;
                }
                missingcounter++;
            } else {
                //var min= 150+graphinterval*Math.ceil(Math.abs(d.start.getTime() - today.getTime()) / (1000 * 3600 * 24)) - $('.gantbox').scrollLeft();
                //var max= 150+graphinterval*Math.ceil(Math.abs(d.end.getTime() - d.start.getTime()) / (1000 * 3600 * 24)) - $('.gantbox').scrollLeft();
                //d.x = min+Math.sin(today.getTime()/1000*Math.PI*2/10)*max;
                ganttTimer++;
                if (ganttTimer < 3000) {
                    d.x = 150 + graphinterval * Math.ceil(Math.abs(d.start.getTime() - today.getTime()) / (1000 * 3600 * 24)) * ganttTimer / 3000;
                    d.y = 150 + d.start.getHours() * 17;
                } else {
                    d.x = 150 + graphinterval * Math.ceil(Math.abs(d.start.getTime() - today.getTime()) / (1000 * 3600 * 24));
                    d.y = 150 + d.start.getHours() * 17;
                }
            }
            if (d.state === "chosen") {
                scrollValue = d.x;
            }

        });
    } else {
        /*nodes.forEach(function (d, i) {
          if(d.state==="chosen"){
          d.x=window.innerWidth/2;
          d.y=window.innerHeight/2;
        }
    });*/



        /*var k = 15 * e.alpha;
        var counter = 0;
        links.forEach(function(d, i) {
            counter++;

            d.source.x -= k;
            d.target.x += k;
            if (counter % 2 === 0) {
                d.source.y -= k / 3;
                d.target.y += k / 3;
            } else {

                d.source.y += k / 3;
                d.target.y -= k / 3;

            }
        });*/

        //circles animation
        var tempcounter = 0;
        var temptotal = 0;
        nodes.forEach(function(d, i) {
            if (d.state === "temp" && d.type!=="chainlink" && d.type!=="bubble") {
                temptotal++;
            }
        });
        if(temptotal!==newnodes){
                newnodes+=temptotal/15/(newnodes*newnodes);
        }
        if(newnodes>=temptotal){
            newnodes=temptotal;
        }
        if(newnodes<1)newnodes=1;
        nodes.forEach(function(d, i) {
            if (d.state === "temp") {
                tempcounter++;
                if(d.type==="chainlink" || d.type==="bubble"){
                     d.x = window.innerWidth / 2;
                     d.y = window.innerHeight / 2;
                }else{
                d.x = window.innerWidth / 2 + (60+newnodes*20) * Math.cos(-Math.PI+Math.PI * 2 * (tempcounter-1) / newnodes+0.3);
                d.y = window.innerHeight / 2 + (60+newnodes*20)  * Math.sin(-Math.PI+Math.PI * 2 * (tempcounter-1) / newnodes+0.3);
                }
            }
        });
    }


    if (boxedin) {
        circle.attr("cx", function(d) {
                return d.x = Math.max(14, Math.min(w - 14, d.x));
            })
            .attr("cy", function(d) {
                return d.y = Math.max(114, Math.min(h - 14, d.y));
            });

        nodetext.attr("transform", transform);
    } else {
        node.attr("transform", transform);
    }


    link.attr("d", function(d) {

        if (graphstate === "GRAPH") {
            var dx = d.target.x - d.source.x,
                dy = d.target.y - d.source.y,
                dr = Math.sqrt(dx * dx + dy * dy);
            return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
        } else if (graphstate === "GANTT") {
            if (d.state === "enter" || d.state === "exit") {
                var dx = d.target.x - d.source.x,
                    dy = d.target.y - d.source.y,
                    dr = Math.sqrt(dx * dx + dy * dy) * 5;
                return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
            } else {
                var dx = d.target.x - d.source.x,
                    dy = d.target.y - d.source.y,
                    dr = Math.sqrt(dx * dx + dy * dy) * 5;

                return "M" + 0 + "," + 0 + "A" + dr + "," + dr + " 0 0,1 " + 0 + "," + 0;
            }
        }

    });


    linktext.attr("transform", function(d) {
        if (graphstate === "GRAPH") {
            return "translate(" + (d.source.x + d.target.x) / 2 + "," + (d.source.y + d.target.y) / 2 + ")";
        } else {
            return "translate(0,0)";
        }
    });

}




function deliverableTest() {
    links=[];
    nodes=[];
    var status = "unknown";
    var nodecounter = 150;
    for (var i = 0; i < nodecounter; i++) {
        if (Math.random() > 0.7) status = "done";
        else if (Math.random() > 0.5) status = "current";
        else status = "waiting";
        var end = randomDate(new Date(), new Date("01/01/2018"));
        var start = randomDate(new Date(), end);
        graph.addNodeComplete("Task " + i, "deliverable", "perm", start, end, status);
    }

    for (var i = 0; i < nodecounter; i++) {
        var endindex = Math.floor(Math.random() * nodecounter);
        var startindex = Math.floor(Math.random() * nodecounter);
        if (nodes[endindex].start > nodes[startindex].start && startindex !== endindex) {
            graph.addLink("Task " + startindex, "Task " + endindex, "depends on", "perm");
        } else {
            graph.addLink("Task " + endindex, "Task " + startindex, "depends on", "perm");
        }
    }

    function randomDate(start, end) {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }

    graph.update();
}


function showInfo(d, i) {
  if (d.state !== "chosen") {
    graph.highlightNode(d.id, null);
    $('.info').fadeIn(300);

    if (d.type === "deliverable") {
      $('.info').html('Name: ' + d.id + '<br/><form id="editbox"><label>Type:</label><select id="edittype"><option value="person">Person</option><option value="project">Project</option><option value="skill">Skill</option><option value="deliverable">Deliverable</option><option value="objective">Objective</option></select><br/><label>Status</label><select id="editstatus"><option value="waiting">Waiting</option><option value="current">Current</option><option value="done">Done</option></select><br/><label>Start date:</label><input id="editstartdate"/></br><label>End date:</label><input id="editenddate"/></br><button>Save</button><button id="deletenode">Delete</button></form>');
    } else if(d.type=== "chainlink"){
      $('.info').html('Name: ' + d.id + '<br/><form id="editbox"><button>Save</button><button id="deletenode">Delete</button></form>');
    }else{
      $('.info').html('Name: ' + d.id + '<br/><form id="editbox"><label>Type:</label><select id="edittype"><option value="person">Person</option><option value="project">Project</option><option value="skill">Skill</option><option value="deliverable">Deliverable</option><option value="objective">Objective</option></select><br/><label>URL:</label><input id="editurl"/><br/><button>Save</button><button id="deletenode">Delete</button></form>');
    }


    $('.info').css("border-color", customColor(d.type));

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

    $("#editbox").submit(function() {
      if (d.type === "deliverable") {
        graph.editDates(d.id, null, new Date($("#editstartdate").val()), new Date($("#editenddate").val()));
      }
      graph.editType(d.id,d.type,$('#edittype').val());
      graph.editURL(d.id, d.type, $('#editurl').val());
      graph.update();
      return false;
    });

    $("#deletenode").click(function() {
      if (confirm('This node and all its connections will be deleted, are you sure?')) {
        graph.removeNode(d.id, null);
      }

      graph.update();
    });
  } else {
    graph.removeHighlight();
    $('.info').fadeOut(300);
  }
  graph.update();
}

function mousedown() {
    $('.editinfo').css('top', -100);
    $('.editinfo').css('left', 0);
    $('.editlinkinfo').css('top', -100);
    $('.editlinkinfo').css('left', 0);
    graph.removeHighlight();
    $('.info').fadeOut(300);
    graph.update();
}

function AddedUnique(newnode) {
    truth = true;
    for (var p = 0; p < addednodes.length; p++) {
        if (addednodes[p] === newnode) {
            truth = false;
        }
    }
    return truth;
}



function editNode(d, i) {
    var oldname = d.id;
    $('.editinfo').css('top', d.y - 12);
    $('.editinfo').css('left', d.x + 18);
    $('#editname').val(oldname);

    $('#editform').keypress(function(e) {
        if (graph.history !== undefined) {
            graph.history.record_keystrokes(KEYSTROKE_WHERE_EDIT_NODE, [e.which]);
        }
     if (e.which == 13) {
        $('.editinfo').css('top', -100);
        $('.editinfo').css('left', 0);
        graph.editName(oldname, "xx", $('#editname').val());


        graph.update();

        return false;
    }

    });

      graph.update();

}

function editLink(d, i) {
    var dx = (d.source.x + d.target.x) / 2;
    var dy = (d.source.y + d.target.y) / 2;
    var oldname = d.name;
    $('.editlinkinfo').css('top', dy - 17);
    $('.editlinkinfo').css('left', dx - 18);
    $('#editlinkname').val(oldname);

    $('#editlinkform').submit(function() {
        graph.editLink(d.source.id, d.target.id, $('#editlinkname').val());
        $('.editlinkinfo').css('top', -100);
        $('.editlinkinfo').css('left', 0);
        graph.update();

        return false;
    });

    graph.update();

}


function customColor(type) {
    var color;
    switch (type) {
        case "person":
            color = '#FCB924';
            break;
        case "project":
            color = '#009DDC';
            break;
        case "skill":
            color = '#62BB47';
            break;
        case "deliverable":
            color = '#202020';
            break;
        case "objective":
            color = '#933E99';
            break;
        case "empty":
            color = "#080808";
            break;
        case "chainlink":
            color = "#fff";
            break;
        case "bubble":
            color = "rgba(0,0,0,0.2)";
            break;
    }
    return color;
}

function customSize(type) {
    var size;
    switch (type) {
        case "person":
            size = 12;
            break;
        case "project":
            size = 12;
            break;
        case "skill":
            size = 12;
            break;
        case "deliverable":
            size = 12;
            break;
        case "objective":
            size = 12;
            break;
        case "empty":
            size = 9;
            break;
        case "chainlink":
            size = 8;
            break;
        case "bubble":
            size = 180;
            break;
    }
    return size;
}
