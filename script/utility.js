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

// Readable duration
(function() {

    var minute = 1000 * 60,
        hour = minute * 60,
        day = hour * 24,
        month = day * 365.25 / 12;

    function decline(value, limit, one, two, many) {
        var round = Math.round(value);
        if (round <= limit) {
            return String.decline(round, one, two, many);
        }
    }

    Date.prototype.toHumanAgo = function() {
        var ago = Date.now() - this.getTime();
        return ago < minute ? 'меньше минуты' :
            decline(ago / minute, 59, '%d минуту', '%d минуты', '%d минут') ||
            decline(ago / hour, 23, '%d час', '%d часа', '%d часов') ||
            decline(ago / day, 29, '%d день', '%d дня', '%d дней') ||
            decline(ago / month, 12, '%d месяц', '%d месяца', '%d месяцев') || 'больше года';
    };

})();

// Sound
(function() {

    var supported = getSupported();

    function getSupported() {
        var audio = new Audio();
        if (audio.canPlayType) {
            if (canPlay(audio, 'audio/mpeg;')) return 'mp3';
            if (canPlay(audio, 'audio/ogg; codecs="vorbis"')) return 'ogg';
        }
    }

    function canPlay(audio, type) {
        return Boolean(audio.canPlayType(type).replace('no', ''));
    }

    function Sound(options) {
        this.raw = new Audio(supported && options[supported]);
        this.volume = options.volume || 1;
    }

    Sound.prototype.play = function(volume) {
        this.raw.volume = volume || this.volume;
        this.raw.currentTime = 0;
        this.raw.play();
    };

    window.Sound = Sound;

})();

// Smooth window scrolling
(function() {

    var scroller = $({});
    var interrupted;

    function setPosition(value) {
        if (!interrupted) {
            window.scrollTo(0, Math.round(value));
        }
    }

    function getDuration(a, b) {
        return 300 + Math.abs(a - b) * 7;
    }

    window.addEventListener('wheel', function() {
        interrupted = true;
    });

    $window.scrollTo = function(value, duration) {
        return this.queue(function(next) {
            var cur = $window.scrollTop();
            var pos = typeof value === 'function' ? value(cur) : value;
            if (pos !== undefined) {
                interrupted = false;
                scroller[0].position = cur;
                scroller.animate({position: pos}, {
                    complete: next,
                    duration: duration || getDuration(pos, cur),
                    step: setPosition
                });
            } else {
                next();
            }
        });
    };

})();

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
