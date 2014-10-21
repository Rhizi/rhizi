var base = require('./base');

var data = [
["#a hello there #b", ["a", "b"], [["a", "b", "hello there"]],
["#a hello there2 #ba", ["a", "ba"], ["a", "ba", "hello there2"]]],
["#c and #d like #e", ["c", "d", "e"], [["c", "e", "like"], ["d", "e", "like"]]],
["#f and #g and #h are cool", ["f", "g", "h", "are cool"], [["f", "are cool", ""], ["g", "are cool", ""], ["h", "are cool", ""]]], // the are should be a label actually, but harder to do.
["#i likes #j and #k", ["i", "j", "k"], ["i", "j", "likes"], ["i", "k", "likes"]],
["#q likes #r but doesn't like #l", ["q", "r", "l"], []],
];
/*
#t and #u like #v
#w #x #y
sometimes #z and #ab aren't friends
I like to work with #a
*/

base.run_tests({
    done: function (errors, window) {
        debugger;
        var analyzeSentence = window.require('textanalysis.ui').analyzeSentence;
        console.log(process.argv);
        if (process.argv.length >= 2) {
            analyzeSentence(process.argv.slice(2).join(" "), true);
            base.dump_graphviz(window.require('rhizicore').force);
        } else {
            for (var k in data) {
                var sentence = data[k][0];
                var expected_nodes = data[k][1];
                var expected_links = data[k][2];
                analyzeSentence(sentence, true);
                // TODO - compare graphs
            }
        }
        process.exit();
    }
});
