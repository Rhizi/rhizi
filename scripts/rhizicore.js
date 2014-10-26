"use strict"

define('rhizicore',
['jquery', 'd3', 'consts', 'signal', 'util', 'history', 'textanalysis'],
function($, d3, consts, signal, util, history, textanalysis) {
var History = history.History;
var addednodes = [];

var vis;

var graphstate = "GRAPH";
var graphinterval = 0;

var ganttTimer = 0;

var boxedin = false;

var deliverables = [];

var boxedin, nodetext, linktext, link, links, node, nodes, circle;

var scrollValue = 0,
    zoomObject;

var force;

function myGraph(el) {

    this.update = function(no_relayout) {
        update(no_relayout);
    }

    ///FUNCTIONS
    this.addNode = function(id, type, state) {
        var new_node = this.addNodeNoHistory(
            {id:id,
             name:id,
             type:type,
             state:state,
             start:0,
             end:0,
             status:"unknown"});
        if (new_node && this.history !== undefined) {
            this.history.record_nodes([new_node]);
        }
    }

    this.addNodeNoHistory = function(spec) {
        // No history recorded - this is a helper for loading from files / constant graphs
        var id = spec.id.toLowerCase();
        var node = findNode(id, null);
        var new_node = undefined;

        if (node === undefined) {
            new_node = {
                "id": id,
                "name": spec.name,
                "type": spec.type,
                "state": spec.state,
                "start": spec.start,
                "end": spec.end,
                "status": spec.status,
                'url': spec.url,
            };
            nodes.push(new_node);
        }
        return new_node;
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

    /* compareSubset:
     *  state: one of the optional states that defines a subgraph
     *  new_nodes: array of objects with id
     *  new_links: array of length two arrays [source_id, target_id]
     *  returns: true if current and new graph are homomorphic up to
     *  a single node id change. false otherwise
     */
    this.compareSubset = function(state, new_nodes, new_links) {
        // Note: the nodes include a state=='temp', type=='bubble' node
        // but it's ok since it exists both in new_nodes and in state_nodes
        var state_nodes = findNodes(null, state);
        var state_links = findLinks(state).map(function(link) {
            return [link.source.id, link.target.id];
        }).sort();
        var k;
        var changed_old_id = undefined, changed_new_id = undefined;
        var state_source, state_target, new_source, new_target;
        var changed_nodes;
        var verbose = false; // XXX should be global. should have only one global. sigh.
        var set_old_id, set_new_id;
        var new_id_to_name = {};

        new_nodes.map(function (f) {
            if (!f.name) {
                f.name = f.id;
            }
            f.id = f.id.toLowerCase();
            new_id_to_name[f.id] = f.name;
            if (verbose) {
                console.log('new_id_to_name ' + f.id + ' -> ' + new_id_to_name[f.id]);
            }
        });
        new_nodes.sort();
        new_links.sort();
        if (new_nodes.length != state_nodes.length || new_links.length != state_links.length) {
            if (verbose) {
                console.log('not same size');
            }
            return {graph_same: false};
        }
        changed_nodes = util.set_diff(util.set_from_array(state_nodes.map(function(d) { return d.id.toLowerCase(); })),
                                 util.set_from_array(new_nodes.map(function (f) { return f.id.toLowerCase(); })));
        // we allow any number of changed nodes as long as we it is 1 or 2 :)
        if (changed_nodes.a_b.length <= 2) {
            set_old_id = util.set_from_array(changed_nodes.a_b);
            set_new_id = util.set_from_array(changed_nodes.b_a);
        } else {
            if (verbose) {
                console.log('changed too many nodes');
                console.log(changed_nodes);
            }
            return {graph_same: false};
        }
        for (k = 0 ; k < state_links.length ; ++k) {
            state_source = state_links[k][0];
            state_target = state_links[k][1];
            new_source = new_links[k][0];
            new_target = new_links[k][1];
            if ((state_source != new_source &&
                 !(state_source in set_old_id && new_source in set_new_id))
                ||
               (state_target != new_target &&
                 !(state_target in set_old_id && new_target in set_new_id))) {
                if (verbose) {
                    console.log('not same link: ' +
                                state_source + '->' + state_target + ' != ' +
                                new_source + '->' + new_target);
                    console.log(set_old_id);
                    console.log(set_new_id);
                }
                return {graph_same: false};
            }
        }
        return {graph_same: true, old_id: changed_nodes.a_b, new_id: changed_nodes.b_a,
                new_name: changed_nodes.b_a.map(function (k) { return new_id_to_name[k]; })};
    }

    this.addLink = function(sourceId, targetId, name, state, drop_conjugator_links) {
        sourceId = sourceId && sourceId.toLowerCase();
        targetId = targetId && targetId.toLowerCase();
        var sourceNode = findNode(sourceId, null);
        var targetNode = findNode(targetId, null);
        var found = findLink(sourceId,targetId,name);

        if (drop_conjugator_links && name && (name.replace(/ /g,"") === "and")) {
            state = "temp";
        }
        if (sourceNode === undefined || targetNode === undefined) {
            return;
        }
        if (!found) {
            var link = {
                "source": sourceNode,
                "target": targetNode,
                "name": name,
                "state": state
            };
            links.push(link);
            signal.signal(consts.RECORD_LINKS, [[link]]);
        } else {
            found.name = name;
            found.state = state;
        }
    }

    this.editLink = function(sourceId, targetId, newname, newstate) {
        var link = findLink(sourceId, targetId, newname);
        if (link !== undefined) {
            link.name = newname;
            if (newstate !== undefined) {
                link.state = newstate;
            }
        }
    }

    this.editLinkTarget = function(sourceId, targetId, newTarget) {
        var link = findLink(sourceId, targetId, null);
        if (link !== undefined) {
            link.target = findNode(newTarget, null);

        } else {

        }
    }

    this.editName = function(id, type, newname) {
        var new_name = newname;
        id = id && id.toLowerCase();
        var new_id = newname.toLowerCase();
        var index2 = undefined;
        if (id != new_id) {
            index2 = findNode(new_id, type);
        }
        var index = findNode(id, type);
        var acceptReplace=true;

        if ((index !== undefined)) {
            if ((index2 !== undefined)) {
                acceptReplace = confirm('"' + index2.id + '" will replace "' + index.id + '", are you sure?');
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
                index.name = new_name;
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
            update(true);
        }
    }

    this.editURL = function(id, state, url) {
        var index = findNode(id, state);
        if ((index === undefined)) return;
        index.url = url;
        update(true);
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


    var hasNode = function(id, state) {
        var i;
        id = id.toLowerCase();
        for (i = 0 ; i < nodes.length; ++i) {
            if (nodes[i].id == id && nodes[i].state == state) {
                return true;
            }
        }
        return false;
    }
    this.hasNode = hasNode;

    var findNode = function(id, state) {
        id = id && id.toLowerCase();
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
        .attr("width", '100%')
        .attr("height", '100%')
        .attr("pointer-events", "all")
        .call(zoomObject)
        .append("g");

    // TODO: why do we need this huge overlay (hugeness also not constant)
    vis.append("rect")
        .attr("class", "overlay graph")
        .attr("width", $(el).innerWidth() * 12)
        .attr("height", $(el).innerHeight() * 12)
        .attr("x", -$(el).innerWidth() * 5)
        .attr("y", -$(el).innerHeight() * 5);
    $('.overlay').click(mousedown);

    // SVG rendering order is last rendered on top, so to make sure
    // all links are below the nodes we group them under a single g
    vis.append("g").attr("id", "link-group");

    function zoom() {
        if (graphstate === "GRAPH") {
            vis.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }
        if (graphstate === "GANTT") {
            vis.attr("transform", "translate(0,0)scale(1)");
        }
    }

    var drag = d3.behavior.drag()
    .origin(function(d) { return d; })
    .on("dragstart", dragstarted)
    .on("drag", dragged)
    .on("dragend", dragended);

    function dragstarted(d) {
        d3.event.sourceEvent.stopPropagation();
        d3.select(this).classed("dragging", true);
        d.dragstart = {clientX:d3.event.sourceEvent.clientX, clientY:d3.event.sourceEvent.clientY};
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
        if (d.dragstart.clientX - d3.event.sourceEvent.clientX != 0 ||
            d.dragstart.clientY - d3.event.sourceEvent.clientY != 0) {
            tick();
            force.resume();
        }
    }

    function clear() {
        nodes.length = 0;
        links.length = 0;
    }
    this.clear = clear;

    function empty() {
        return nodes.length == 0 && links.length == 0;
    }
    this.empty = empty;

    function load_from_json(json) {
        var data = JSON.parse(json);
        var i, node, link;

        clear();
        if (data == null) {
            console.log('load callback: no data to load');
            return;
        }
        for(i = 0; i < data["nodes"].length; i++){
          node = data.nodes[i];
          graph.addNodeNoHistory({id:node.id, name:node.name ? node.name : node.id,
                                  type:node.type,state:"perm",
                                  start:new Date(node.start),
                                  end:new Date(node.end),
                                  status:node.status,
                                  url:node.url,
                                 });
          textanalysis.autoSuggestAddName(node.id);
        }
        for(i = 0; i < data["links"].length; i++){
          link = data.links[i];
          graph.addLink(link.source,link.target,link.name,"perm");
        }
        graph.recenterZoom();
        graph.update(false);
        graph.clear_history();
    }
    this.load_from_json = load_from_json;

    function save_to_json() {
        var d = {"nodes":[], "links":[]};
        console.log(nodes);
        for(var i = 0 ; i < nodes.length ; i++){
          var node = nodes[i];
          d['nodes'].push({
            "id": node.id,
            "name": node.name,
            "type":node.type,
            "state":"perm",
            "start":node.start,
            "end":node.end,
            "status": node.status,
            "url": node.url,
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
        if (this.history !== undefined) {
            this.history.clear();
        }
    }
    this.clear_history = clear_history;

    force = d3.layout.force()
        .distance(120)
        .gravity(0.12)
        .charge(-1800)
        .size([w, h])
        .on("tick", tick)
        .start();

    nodes = force.nodes();
    links = force.links();

    var state_to_link_class = {
        enter:'enterlink graph',
        exit:'exitlink graph',
    };

    var update = function(no_relayout) {
        link = vis.select("#link-group").selectAll(".link")
            .data(links);

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
            .style("fill", function(d){
                if (d.state==="enter" || d.state==="exit") {
                    return "EDE275";
                } else {
                    return "#aaa";
                }
                })
            .append("svg:path")
            .attr("d", "M0,-5L10,0L0,5");

        link.enter().append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("class", function(d) {
                return state_to_link_class[d.state] || 'link graph';
            })
            .attr("marker-end", "url(#end)")
            .on("click", function(d, i) {
                //$('#textanalyser').val("node("+d.source.id+") -> "+d.name+" -> node("+d.target.id+")");
            });;
        link.style("stroke-dasharray", function(d,i){
            if(d.name && d.name.replace(/ /g,"")=="and" && d.state==="temp")
                return "3,3";
            else
                return "0,0";
            });

        link.exit().remove();

        linktext = vis.selectAll(".linklabel").data(links);
        linktext.enter()
            .append("text")
            .attr("class", "linklabel graph")
            .attr("text-anchor", "middle")
            .on("click", function(d, i) {
                if(d.state !== "temp") {
                    editLink(d, i);
                }
            });

        linktext
            .text(function(d) {
                var name = d.name || "";
                if (!(d.target.state === "temp" ||
                    d.source.state === "chosen" || d.target.state === "chosen")) {
                    return "";
                }
                if (name.length < 25 || d.source.state === "chosen" ||
                    d.target.state === "chosen" || d.state==="temp") {
                    return name;
                } else {
                    return name.substring(0, 14) + "...";
                }
            });

        linktext.exit().remove();

        node = vis.selectAll(".node")
            .data(nodes, function(d) {
                return d.id;
            });

        var nodeEnter = node.enter()
            .append("g").attr('class', 'node')
            .attr('visibility', 'hidden') // made visible on first tick
            .on("click", function(d, i) {
                if (d3.event.defaultPrevented) {
                    // drag happened, ignore click https://github.com/mbostock/d3/wiki/Drag-Behavior#on
                    return;
                }
                if(d.state!=="temp"){
                    editNode(d, i);
                    showInfo(d, i);
                }
            })
            .call(drag);

        nodetext = nodeEnter.insert("text")
            .attr("class", "nodetext graph")
            .attr("dx", 15)
            .attr("dy", ".30em");

        node.select('g.node text')
            .text(function(d) {
                if (!d.name) {
                    return "";
                }
                if (d.state === "temp" || d.state === 'chosen') {
                     return d.name;
                } else {
                    if (d.name.length < 28) {
                        return d.name;
                    } else {
                        return d.name.substring(0, 25) + "...";
                    }
                }
            });

        circle = nodeEnter.insert("circle");
        node.select('g.node circle')
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
                if (d3.event.defaultPrevented) {
                    // drag happened, ignore click https://github.com/mbostock/d3/wiki/Drag-Behavior#on
                    return;
                }
                d3.event.stopPropagation();
                if(d.state!=="temp") {
                     showInfo(d, i);
                } else {
                    graph.removeHighlight();
                }
                graph.update(true);
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
        if (no_relayout) {
            // XXX If we are stopped we need to update the text of the links at least,
            // and this is the simplest way
            tick();
        } else {
            force.alpha(0.1).start();
        }
    }

    update(false);
}


var graph = new myGraph(document.body);

var debug_print = function(message) {
    var element = $(".debug");
    if (element.length == 1) {
        element.html(message);
    } else {
        console.log(message);
    }
}

function check_for_nan(x) {
    if (Number.isNaN(x)) {
        console.log('nan problem');
        force.stop();
    }
    return Number.isNaN(x);
}

var newnodes=1;
function tick(e) {
    //console.log(e);
    //$(".debug").html(force.alpha());

    function transform(d) {
        if (graphstate === "GRAPH" || d.type === "deliverable") {
            if (check_for_nan(d.x) || check_for_nan(d.y)) {
                return;
            }
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
                } else {
                    d.x = window.innerWidth / 2 + (60+newnodes*20) * Math.cos(-Math.PI+Math.PI * 2 * (tempcounter-1) / newnodes+0.3);
                    d.y = window.innerHeight / 2 + (60+newnodes*20)  * Math.sin(-Math.PI+Math.PI * 2 * (tempcounter-1) / newnodes+0.3);
                }
                check_for_nan(d.x);
                check_for_nan(d.y);
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

    // After initial placement we can make the nodes visible.
    //links.attr('visibility', 'visible');
    node.attr('visibility', 'visible');
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
      graph.update(true);
      return false;
    });

    $("#deletenode").click(function() {
      if (confirm('This node and all its connections will be deleted, are you sure?')) {
        graph.removeNode(d.id, null);
        graph.update(false);
        document.querySelector('.info').style.visibility = "hidden";
      }
    });
  } else {
    graph.removeHighlight();
    $('.info').fadeOut(300);
  }
  graph.update(true);
}

function mousedown() {
    $('.editinfo').css('top', -100);
    $('.editinfo').css('left', 0);
    $('.editlinkinfo').css('top', -100);
    $('.editlinkinfo').css('left', 0);
    graph.removeHighlight();
    $('.info').fadeOut(300);
    graph.update(true);
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


$('#editform').keypress(function(e) {
    if (graph.history !== undefined) {
        graph.history.record_keystrokes(history.KEYSTROKE_WHERE_EDIT_NODE, [e.which]);
    }
    if (e.which == 13) {
        $('.editinfo').css('top', -100);
        $('.editinfo').css('left', 0);
        var element = $('#editname');
        var newname = element.val();
        var d = element.data().d;
        graph.editName(d.id, "xx", newname);
        graph.update(true);
        return false;
    }
});


function editNode(d, i) {
    var oldname = d.name;
    var element = $('#editname');
    $('.editinfo').css('top', d.y - 12);
    $('.editinfo').css('left', d.x + 18);
    element.val(oldname);
    element.data().d = d;
}

function editLink(d, i) {
    var dx = (d.source.x + d.target.x) / 2;
    var dy = (d.source.y + d.target.y) / 2;
    var oldname = d.name;
    $('.editlinkinfo').css('top', dy - 17);
    $('.editlinkinfo').css('left', dx - 18);
    $('#editlinkname').val(oldname);

    // TODO: handle escape as well to quit without changes (enter does submit)
    $('#editlinkform').submit(function() {
        graph.editLink(d.source.id, d.target.id, $('#editlinkname').val());
        $('.editlinkinfo').css('top', -100);
        $('.editlinkinfo').css('left', 0);
        graph.update(true);

        return false;
    });

    graph.update(true);
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

function expand(obj){
    if (!obj.savesize) {
        obj.savesize = obj.size;
    }
    obj.size = Math.max(obj.savesize, obj.value.length);
}
return {
    expand: expand,
    graph: graph,
    force: force,
}
}); /* close define call */
