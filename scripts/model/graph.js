"use strict"

define(['signal', 'consts', 'util', 'textanalysis'], function (
    signal, consts, util, textanalysis) {

function Graph(el) {

    var nodes = [],
        links = [];

    function id_generator_generator() {
        var id = 0;
        function get_next() {
            var next = id;
            id += 1;
            return next;
        }
        return get_next;
    }
    var id_generator = id_generator_generator();

    ///FUNCTIONS
    this.addNode = function(name, type, state) {
        var new_node = this._addNodeNoHistory(
            {name:name,
             type:type,
             state:state,
             start:0,
             end:0,
             status:"unknown"});
        if (new_node) {
            signal.signal(consts.APPLIED_GRAPH_DIFF, [{
                nodes: {add: [new_node]}}]);
        }
    }

    this._addNodeNoHistory = function(spec) {
        // No history recorded - this is a helper for loading from files / constant graphs
        var node;
        if (spec.id === undefined) {
            node = findNodeByName(spec.name, null);
        } else {
            if (spec.id !== undefined) {
                node = findNode(spec.id, null);
            }
        }
        if (node === undefined) {
            node = {
                "id": spec.id || id_generator(),
                "name": spec.name,
                "type": spec.type,
                "state": spec.state,
                "start": spec.start,
                "end": spec.end,
                "status": spec.status,
                'url': spec.url,
                'x': spec.x,
                'y': spec.y,
            };
            nodes.push(node);
        }
        return node;
    }

    this.removeNode = function(id, state) {
        var i = 0;
        var n = findNode(id, state);
        while (i < links.length) {
            if ((links[i]['source'] === n) || (links[i]['target'] == n)) links.splice(i, 1);
            else i++;
        }
        var index = findNodeIndex(id, state);
        if (index !== undefined) {
            nodes.splice(index, 1);
        }
        signal.signal(consts.APPLIED_GRAPH_DIFF, [{nodes: {removed: [id]}}]);
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
        if (ns.length > 0) {
            signal.signal(consts.APPLIED_GRAPH_DIFF, [{nodes: {removed: ns.map(function(n) { return n.id; })}}]);
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
     *  new_nodes: array of objects with name
     *  new_links: array of length two arrays [source_name, target_name]
     *  returns: true if current and new graph are homomorphic up to
     *  a single node id change. false otherwise
     */
    this.compareSubset = function(state, new_nodes, new_links) {
        // Note: the nodes include a state=='temp', type=='bubble' node
        // but it's ok since it exists both in new_nodes and in state_nodes
        var state_nodes = findNodes(null, state).filter(function (nd) {
            return nd.type !== 'bubble';
        });
        var state_links = findLinks(state).map(function(link) {
            return [link.source.name, link.target.name];
        }).sort();
        var k;
        var state_source, state_target, new_source, new_target;
        var changed_nodes;
        var verbose = false; // XXX should be global.
        var set_old_name, set_new_name;

        new_nodes.map(function (f) {
            if (!f.name) {
                console.log('missing name on node. node follows');
                console.log(f);
            }
        });
        new_nodes.sort();
        new_links.sort();
        if (new_nodes.length != state_nodes.length || new_links.length != state_links.length) {
            if (verbose) {
                console.log('not same size: new/old ' + new_nodes.length + ' / ' + state_nodes.length + '; ' +
                            new_links.length + ' / ' + state_links.length);
            }
            return {graph_same: false};
        }
        changed_nodes = util.set_diff(util.set_from_array(state_nodes.map(function(d) { return d.name; })),
                                 util.set_from_array(new_nodes.map(function (f) { return f.name; })));
        // we allow any number of changed nodes as long as we it is 1 or 2 :)
        if (changed_nodes.a_b.length > 2) {
            if (verbose) {
                console.log('changed too many nodes');
                console.log(changed_nodes);
            }
            return {graph_same: false};
        }
        set_old_name = util.set_from_array(changed_nodes.a_b);
        set_new_name = util.set_from_array(changed_nodes.b_a);
        for (k = 0 ; k < state_links.length ; ++k) {
            state_source = state_links[k][0];
            state_target = state_links[k][1];
            new_source = new_links[k][0];
            new_target = new_links[k][1];
            if ((state_source !== new_source &&
                 !(state_source in set_old_name && new_source in set_new_name))
                ||
               (state_target !== new_target &&
                 !(state_target in set_old_name && new_target in set_new_name))) {
                if (verbose) {
                    console.log('not same link: ' +
                                state_source + '->' + state_target + ' != ' +
                                new_source + '->' + new_target);
                    console.log('state_source === new_source: ' + String(state_source === new_source));
                    console.log('state_target === new_target: ' + String(state_target === new_target));
                    console.log(set_old_name);
                    console.log(set_new_name);
                }
                return {graph_same: false};
            }
        }
        return {graph_same: true, old_name: changed_nodes.a_b, new_name: changed_nodes.b_a};
    }

    this.addLinkByName = function(sourceName, targetName, name, state, drop_conjugator_links) {
        var sourceId = findNodeByName(sourceName, null).id;
        var targetId = findNodeByName(targetName, null).id;

        if (sourceId === undefined || targetId === undefined) {
            console.log('error: cannot add link between names : ' + sourceName + ', ' + targetName);
            return;
        }
        this.addLink(sourceId, targetId, name, state, drop_conjugator_links);
    }

    this.addLink = function(sourceId, targetId, name, state, drop_conjugator_links) {
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
            signal.signal(consts.APPLIED_GRAPH_DIFF, [{links: {add: [link]}}]);
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

    this.editNameByName = function(old_name, new_name) {
        var node = findNodeByName(old_name, null);

        if (node === undefined) {
            console.log('editNameByName: error: cannot find node with name ' + old_name);
            return;
        }
        return this.editName(node.id, new_name); // TODO: introduce Node class (yes Amir, I'm now down with that).
    }

    this.editName = function(id, new_name) {
        var index2 = findNodeByName(new_name, null);
        var index = findNode(id, null);
        var acceptReplace=true;

        if ((index !== undefined)) {
            if (index2 !== undefined) {
                acceptReplace = confirm('"' + index2.name + '" will replace "' + index.name + '", are you sure?');
                if (acceptReplace){
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
            } else {
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

    /**
     * editType:
     * @return true if type changed
     */
    this.editType = function(id, state, newtype) {
        var index = findNode(id, state);
        if ((index !== undefined)) {
            index.type = newtype;
        }
    }

    this.editURL = function(id, state, url) {
        var index = findNode(id, state);
        if ((index === undefined)) return;
        index.url = url;
    }

    this.editState = function(id, state, newstate) {
        var index = findNode(id, state);

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

    var hasNodeByName = function(name, state) {
        var i;

        for (i = 0 ; i < nodes.length; ++i) {
            if (nodes[i].name === name && nodes[i].state === state) {
                return true;
            }
        }
        return false;
    }
    this.hasNodeByName = hasNodeByName;

    var hasNode = function(id, state) {
        var i;

        for (i = 0 ; i < nodes.length; ++i) {
            if (nodes[i].id === id && nodes[i].state === state) {
                return true;
            }
        }
        return false;
    }
    this.hasNode = hasNode;

    var findNode = function(id, state) {
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id || nodes[i].state === state)
                return nodes[i]
        };
    }

    var findNodeByName = function(name, state) {
        for (var i = 0 ; i < nodes.length ; ++i) {
            if (nodes[i].name === name || nodes[i].state === state) {
                return nodes[i];
            }
        }
    }

    var findNodes = function(id, state) {
        //id=id.toLowerCase();
        var foundNodes = [];
        for (var i = 0; i < nodes.length; i++) {
            if ((id && nodes[i].id === id) || (state && nodes[i].state === state))
                foundNodes.push(nodes[i]);
        }
        return foundNodes;
    }

    var findNodeIndex = function(id, state) {
        for (var i = 0; i < nodes.length; i++) {
            if ((id && nodes[i].id === id) || (state && nodes[i].state === state))
                return i
        };
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
          this._addNodeNoHistory({id:node.id, name:node.name ? node.name : node.id,
                                 type:node.type,state:"perm",
                                 start:new Date(node.start),
                                 end:new Date(node.end),
                                 status:node.status,
                                 url:node.url,
                                 x: node.x,
                                 y: node.y,
                                });
          textanalysis.autoSuggestAddName(node.id);
        }
        for(i = 0; i < data["links"].length; i++){
          link = data.links[i];
          this.addLink(link.source, link.target, link.name, "perm");
        }
        this.clear_history();
    }
    this.load_from_json = load_from_json;

    function save_to_json() {
        var d = {"nodes":[], "links":[]};
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
            "x": node.x,
            "y": node.y,
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
        this.history = new History(this.user, $('svg g.zoom')[0]);
        console.log('new user: ' + user);
    }
    this.set_user = set_user;

    function clear_history() {
        if (this.history !== undefined) {
            this.history.clear();
        }
    }
    this.clear_history = clear_history;

    var get_nodes = function() { return nodes; };
    this.nodes = get_nodes;

    var get_links = function() { return links; };
    this.links = get_links;
};


    return Graph;
});
