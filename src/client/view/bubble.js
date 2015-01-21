define(["jquery", "Bacon"], function ($, Bacon) {
function Bubble(raw_parent, radius) {
    var xmlns = "http://www.w3.org/2000/svg";
    var g = document.createElementNS(xmlns, 'g');
    var circle = document.createElementNS(xmlns, 'circle');

    var setTransformToCenter = function (elem) {
        var width = $(document.body).innerWidth();
        var height = $(document.body).innerHeight();

        elem.setAttribute('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');
    }

    g.appendChild(circle);
    raw_parent.appendChild(g);
    setTransformToCenter(g);
    circle.className.baseVal = 'circle bubble';
    circle.id = 'bubble';

    radius.onValue(function (r) {
        setTransformToCenter(g);
        circle.setAttribute("r", r);
    })
}
return {
    Bubble:Bubble
}
});
