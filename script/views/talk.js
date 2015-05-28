/* Human date and time */
(function() {

    var day = 24 * 60 * 60 * 1000;
    var months = ' января, февраля, марта, апреля, мая, июня, июля, августа, сентября, октября, ноября, декабря'.split(',');
    var recent = ['сегодня', 'вчера', 'позавчера'];
    var tonight;

    Date.prototype.toHumanTime = function() {
        var m = this.getMinutes();
        return this.getHours() + (m < 10 ? ':0' : ':') + m;
    };

    Date.prototype.toHumanDate = function() {
        return this.getDate() + months[this.getMonth()];
    };

    Date.prototype.toSmartDate = function() {
        var ago = Math.floor((tonight - this) / day);
        return recent[ago] || this.toHumanDate();
    };

    function update() {
        tonight = (new Date).setHours(24, 0, 0, 0);
        $window.trigger('date.changed');
        setTimeout(update, tonight + 1000 - (new Date));
    }

    update();

})();

// Topic
(function() {

    var elem = $('#room .topic');

    Room.on('topic.updated', function(topic) {
        elem.html(topic);
    });

})();

// Talk
(function() {

    var lastMessage = {};
    var container = $('#talk .talk-messages');
    var render = $.template('#message-template');
    var counter = 0;

    function format(content) {
        return content
            .replace(/\n/g, '<br>')
            .replace(/\b(http[\/#?&%:.\-=+\w]+)/g, '<a href="$1" target="_blank">$1</a>');
    }

    function addMessage(data, single) {
        var created = new Date(data.created);
        data.date = created.toSmartDate();
        data.time = created.toHumanTime();
        data.content = format(data.content);
        if (data.date !== lastMessage.date) {
            renderDate(data.date).appendTo(container);
            if (single) {
                Room.trigger('dates.changed');
            }
        }
        lastMessage = data;
        return render(data).appendTo(container);
    }

    function renderDate(date) {
        return $('<div class="date"><span class="date-text">' + date + '</span></div>');
    }

    function scrollDown(offset) {
        var wh = $window.height();
        if (offset < $window.scrollTop() + wh) {
            $scrollWindow.stop(true).to($document.height() - wh);
        }
    }

    function clearOld(next) {
        var messages = container.find('.message');
        var scrolled = $window.scrollTop();
        var cut = messages.eq(50);
        if (cut.position().top < scrolled) {
            var height = $document.height();
            var dates = cut.prevAll('.date');
            messages.slice(0, 50).remove();
            dates.slice(1).remove();
            dates.eq(0).hide();
            $window.scrollTop(scrolled - (height - $document.height()));
            counter = messages.length - 50;
        }
        next();
    }

    container.on('click', '.nickname', function() {
        Room.replyTo($(this).text());
    });

    Room.loadRecent = function() {
        return Rest.messages
            .get({
                room_id: Room.data.room_id,
                order_by: {'-desc': 'message_id'}
            })
            .done(function(recent) {
                container.empty();
                recent.reverse().forEach(addMessage);
                container.find('.date').first().hide();
                $window.scrollTop($document.height() - $window.height() - 1);
                Room.trigger('dates.changed');
                counter = recent.length;
            });
    };

    Room.on('message.created', function(message) {
        if (message.message_id > lastMessage.message_id) {
            scrollDown(addMessage(message, true).offset().top);
            if (counter++ > 500) {
                $window.queue(clearOld);
            }
        }
    });

    $window.on('date.changed', function() {
        var date;
        container.find('.date').each(function() {
            var elem = $(this);
            var time = elem.next('.message').find('time').attr('datetime');
            date = (new Date(time)).toSmartDate();
            elem.find('.date-text').text(date);
        });
        Room.trigger('dates.changed');
        lastMessage.date = date;
    });

})();


// Sticky dates
(function() {

    var container = $('#talk .talk-messages');
    var header = $('#talk .talk-header');
    var value = header.find('.date-text');

    var dates = [];
    var min, max;
    var headerHeight;

    function update() {
        var active = dates.length > 1;
        headerHeight = header.height();
        dates = container.find('.date').map(getDate);
        toggle(window.pageYOffset);
        if (dates.length < 2 && active) {
            window.removeEventListener('scroll', check, false);
            window.removeEventListener('resize', update);
        }
        if (dates.length > 1 && !active) {
            window.addEventListener('scroll', check, false);
            window.addEventListener('resize', update);
        }
    }

    function getDate(i, node) {
        var elem = $(node);
        return {
            text: elem.find('.date-text').text(),
            offset: i ? elem.position().top - headerHeight + 6 : -Infinity
        };
    }

    function toggle(offset) {
        max = Infinity;
        for (var i = dates.length; i--;) {
            if (dates[i].offset <= offset) {
                value.text(dates[i].text);
                min = dates[i].offset;
                break;
            } else {
                max = dates[i].offset;
            }
        }
    }

    function check() {
        var offset = window.pageYOffset;
        if (offset < min || offset > max) {
            toggle(offset);
        }
    }

    Room.on('dates.changed', update);

})();


// Notifier
(function() {

    var title = document.title;
    var sound = $('#notifier').get(0);

    $window.on('blur', function() {
        title = document.title;
        active = true;
    });

    $window.on('focus', function() {
        document.title = title;
        active = false;
    });

    Room.on('message.created', function(message) {
        if (active) {
            document.title = '+ ' + title;
            sound.currentTime = 0;
            sound.play();
        }
    });

})();
