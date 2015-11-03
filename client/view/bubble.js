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
