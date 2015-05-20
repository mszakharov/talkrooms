// jQuery document and window
var $document = $(document);
var $window = $(window);

// Decline number
String.decline = function(value, one, two, many) {
	var n = value % 10;
	var m = n > 4 || n === 0 || value % 100 - n === 10;
	var s = m ? many : (n === 1 ? one : two);
	return s.replace('%d', value);
};

// Simple string template
String.mix = function(template, value) {
    var values = arguments;
	return template.replace(/\$([1-9])/g, function(s, pos) {
		return values[pos];
	});
};

// Templates
function Template(source) {
    var quotes = ["'", "'"];
    var parts = source.replace(/\r|\n/g, ' ').split(/\{(.*?)\}/);
    for (var i = parts.length; i--;) {
        parts[i] = i % 2
          ? parts[i].replace(/\b([A-Za-z][\w.]*)/g, 'data.$1')
          : quotes.join(parts[i].replace(/([\'])/g, '\$1'));
    }
    return Function('data', 'return [' + parts.join() + '].join("");');
}
$.template = function(selector) {
    var process = Template($(selector).html());
    return function(data) {
        return $(process(data));
    };
};

// Queue
function Queue() {
    var items = [], current;
    function next() {
        if (current = items.shift()) current(next);
    }
    return function(callback) {
        items.push(callback);
        if (current === undefined) next();
    };
}

// Fake console
if (typeof console === 'undefined') {
    console = {log: $.noop, error: $.noop};
}

// Smooth window scrolling
$scrollWindow = $({}).extend({
    to: function(pos, dur) {
        var cur = this[0].winst = $window.scrollTop();
        return this.animate({winst: pos}, dur || Math.abs(pos - cur) / 5 + 200);
    }
});
$.Tween.propHooks.winst = {
    set: function(tween) {
        window.scrollTo(0, tween.now);
    }
};

// Popup
$.popup = function(selector, show, hide) {
    var self = $(selector);
    var elem = self.get(0);
    function clickout(event) {
        if (!event.button && elem !== event.target && !$.contains(elem, event.target)) self.hide();
    }
    function escape(event) {
        if (event.which === 27) self.hide();
    }
    function bind() {
        $document.on('click', clickout);
        $document.on('keydown', escape);
    }
    show = show || self.show;
    hide = hide || self.hide;
    self.show = function() {
        show.apply(self, arguments);
        setTimeout(bind, 0);
    };
    self.hide = function() {
        $document.off('click', clickout);
        $document.off('keydown', escape);
        hide.apply(self, arguments);
    };
    return self;
};
