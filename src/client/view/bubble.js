define(["jquery", "Bacon"],
function ($,       Bacon)
{
function Bubble(raw_parent, radius) {
    var xmlns = "http://www.w3.org/2000/svg";
    var g = document.createElementNS(xmlns, 'g');
    var circle = document.createElementNS(xmlns, 'circle');

    var setTransformToCenter = function (elem) {
        var width = $(document.body).innerWidth(),
            height = $(document.body).innerHeight(),
            bx = width / 2,
            by = height / 2;
        console.log("setting bubble at " + bx + ", " + by);
        elem.setAttribute('transform', 'translate(' + bx + ',' + by + ')');
    }

    g.appendChild(circle);
    raw_parent.appendChild(g);
    setTransformToCenter(g);
    circle.className.baseVal = 'circle bubble';
    circle.id = 'bubble';

    d3.select('#bubble').attr('stroke-width', 10)
                        .attr('filter', 'url(#f_blur__creation-circle)')

    // reset bubble on radius change and window resize
    Bacon.combineWith(function (r, _) { return r; }, radius, $(window).asEventStream('resize').toProperty(0)).onValue(
        function (r) {
            setTransformToCenter(g);
            circle.setAttribute("r", r);
        });
}
return {
    Bubble:Bubble
}
});
