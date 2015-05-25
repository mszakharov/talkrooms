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

    function format(content) {
        return content
            .replace(/\n/g, '<br>')
            .replace(/\b(http[\/#?&%:.\-=+\w]+)/g, '<a href="$1" target="_blank">$1</a>');
    }

    function addMessage(data) {
        var created = new Date(data.created);
        data.date = created.toSmartDate();
        data.time = created.toHumanTime();
        data.content = format(data.content);
        if (data.date !== lastMessage.date) {
            renderDate(data.date).appendTo(container);
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
            });
    };

    Room.on('message.created', function(message) {
        if (message.message_id > lastMessage.message_id) {
            scrollDown(addMessage(message).offset().top);
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
        lastMessage.date = date;
    });

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
