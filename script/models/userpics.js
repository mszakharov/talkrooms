// Userpics composer
(function() {

    var ctx = document.createElement('canvas').getContext('2d');
    ctx.canvas.width = 80;
    ctx.canvas.height = 80;

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.lineCap = 'square';

    function Hash(str) {
        var hval = 0x811c9dc5;
        for (var i = 0; i < str.length; i++) {
            hval ^= str.charCodeAt(i);
            hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
        }
        this.value = hval >>> 0;
    }

    Hash.prototype.slice = function(start, length) {
        return this.value << start >>> 32 - length;
    }

    var COLORS = [
        ["#d15a4f", "#e0b9b5", 9, 4, 13],
        ["#d6744a", "#e2b8a5", 9, 4, 14],
        ["#efa653", "#e2c29c", 10, 5, 15],
        ["#e5bb49", "#dbcba0", 10, 6, 15],
        ["#a4ad3c", "#c5c99f", 11, 6, 0],
        ["#75ad45", "#b2c6a1", 12, 7, 2],
        ["#5db255", "#a5c4a2", 13, 8, 4],
        ["#45ad6b", "#a1c4ad", 14, 9, 5],
        ["#45ad9c", "#9fc4be", 15, 10, 6],
        ["#469ac4", "#a3c0ce", 1, 12, 7],
        ["#5c83d1", "#afbdd8", 3, 12, 8],
        ["#7c75d1", "#b6b3d8", 4, 13, 9],
        ["#996dc4", "#c6b3d8", 5, 14, 10],
        ["#b569bc", "#d1b3d3", 6, 15, 11],
        ["#c466a4", "#ddb8d1", 7, 1, 12],
        ["#d15c7f", "#e5bcc8", 8, 3, 12]
    ];

    function getColors(hash) {
        var color = COLORS[hash.slice(0, 7) % 16];
        var shade = hash.slice(7, 1);
        var aux1 = hash.slice(8, 2);
        var aux2 = hash.slice(10, 4) % 3;
        return [
            color[shade],
            getAuxColor(color, aux1, shade),
            getAuxColor(color, aux2 !== aux1 ? aux2 : 3, shade)
        ];
    }

    function getAuxColor(color, index, shade) {
        return (index ? COLORS[color[1 + index]] : color)[1 - shade];
    }

    function fillTo(y, color) {
        ctx.lineTo(80, y);
        ctx.lineTo(0, y);
        ctx.fillStyle = color;
        ctx.fill();
    }

    function singleCurve(y1, y2) {
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.bezierCurveTo(20, y2, 60, y2, 80, y1);
    }

    function doubleCurve(y, dy) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(10, y + dy, 30, y + dy, 40, y);
        ctx.bezierCurveTo(50, y - dy, 70, y - dy, 80, y);
    }

    function drawEyes(top, offset, radius) {
        ctx.beginPath();
        ctx.arc(40 - offset, top, radius, 0, Math.PI * 2);
        ctx.arc(40 + offset, top, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
    }

    function drawMiddleHair(top, bend, color) {
        var y1 = top - bend / 2;
        var y2 = top + bend / 2;
        singleCurve(y1, y2);
        fillTo(0, color);
        singleCurve(y1, y2);
        ctx.stroke();
    }

    function drawSideHair(top, amp, color) {
        doubleCurve(top, amp);
        fillTo(0, color);
        doubleCurve(top, amp);
        ctx.stroke();
    }

    function drawMouth(top, bend, color) {
        var y1 = top - bend / 2;
        var y2 = top + bend / 2;
        singleCurve(y1, y2);
        fillTo(80, color);
        singleCurve(y1, y2);
        ctx.stroke();
    }

    function createUserpic(id) {

        var hash = new Hash((id + id * Math.PI % 1).toString(36));
        var colors = getColors(hash);

        ctx.fillStyle = colors[0];
        ctx.fillRect(0, 0, 80, 80);

        var et = hash.slice(16, 1) * 4 + 22;
        var eo = hash.slice(17, 1) * 4 + 14;
        var er = hash.slice(18, 1) * 2 + 6;
        drawEyes(et, eo, er);

        var hs = hash.slice(20, 1);
        if (hash.slice(24, 1)) {
            drawMiddleHair(et - 3, hs ? 2 : -1, colors[1]);
        } else {
            drawSideHair(et - 6, hs ? 6 : -6, colors[1]);
        }

        var mt = hash.slice(24, 1) * 8 + 54;
        var mb = hash.slice(25, 2) * 3 || -2;
        drawMouth(mt, mb, colors[2]);

        return ctx.canvas.toDataURL();

    }

    var cached = {};

    window.Userpics = {

        create: createUserpic,

        getUrl: function(data) {
            if (data.userpic) return '/userpics/' + data.userpic;
            var id = data.session_id || data.user_id;
            return cached[id] || (cached[id] = createUserpic(id));
        }

    };

})();
