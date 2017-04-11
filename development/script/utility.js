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

// Fake console
if (typeof console === 'undefined') {
    console = {log: $.noop, error: $.noop};
}

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

// Force reflow for transitions
$.fn.reflow = function() {
    for (var i = this.length; i--;) {
        this[i].offsetWidth;
    }
    return this;
};

// Auto-prefixed transitionend event
(function() {

    var style = document.createElement('div').style;

    function setAlias(original, alias) {
        $.event.special[original] = { bindType: alias };
    }

    if (!style.transition && style.WebkitTransition !== undefined) {
        setAlias('transitionend', 'webkitTransitionEnd');
        setAlias('animationend',  'webkitAnimationEnd');
    }

})();

// Require script
(function() {

    var random = '?' + Math.random().toString().substring(2, 8);

    var loaded = {};

    function loadScript(url) {
        loaded[url] = false;
        var script = document.createElement('script');
        document.head.appendChild(script);
        script.addEventListener('load', function() {
            loaded[url] = true;
        });
        script.async = true;
        script.src = '/script/' + url + random;
    }

    $.require = function(url) {
        if (loaded[url] === undefined) loadScript(url);
    };

})();

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
        if (this.raw.readyState) {
            this.raw.currentTime = 0;
            this.raw.play();
        }
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
    var elem = self.find('.popup-content').get(0) || self.get(0);
    function clickout(event) {
        if (!event.button && elem !== event.target && !$.contains(elem, event.target)) self.hide();
    }
    function escape(event) {
        if (event.which === 27 || event.keyCode === 27) self.hide();
    }
    show = show || self.show;
    hide = hide || self.hide;
    self.show = function() {
        document.addEventListener('touchstart', clickout, true);
        document.addEventListener('mousedown', clickout, true);
        document.addEventListener('keydown', escape, true);
        show.apply(self, arguments);
    };
    self.hide = function() {
        document.removeEventListener('touchstart', clickout, true);
        document.removeEventListener('mousedown', clickout, true);
        document.removeEventListener('keydown', escape, true);
        hide.apply(self, arguments);
    };
    return self;
};
