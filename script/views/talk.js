/* Human date and time */
(function() {

    var day = 24 * 60 * 60 * 1000;
    var months = ' января, февраля, марта, апреля, мая, июня, июля, августа, сентября, октября, ноября, декабря'.split(',');
    var recent = ['сегодня', 'вчера', 'позавчера'];
    var tonight = 0;
    var timer;

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
        var now = new Date();
        if (now > tonight) {
            tonight = now.setHours(24, 0, 0, 0);
            $window.trigger('date.changed');
        }
        var dayRest = tonight - new Date();
        clearTimeout(timer);
        timer = setTimeout(update, dayRest + 1000);
    }

    // Reset timer after sleep mode
    Room.on('connected', update);

    update();

})();

// Entry overlay
(function() {

    var overlay = $('.room-entry');

    Room.on('ready', function() {
        overlay.fadeOut(150);
    });

    Room.on('leave', function() {
        overlay.children().hide();
        overlay.show();
    });

    Room.on('lost', function() {
        overlay.find('.entry-failed').show();
    });

})();

// Header
(function() {

    var topic = $('#room .topic');

    function showTopic() {
        topic.html(Room.data.topic);
    }

    Room.on('enter', showTopic);
    Room.on('room.topic.updated', showTopic);

})();

var Talk = {
    container: $('#talk .talk-messages')
};

// Format content
Talk.format = function(content) {
    return content
        .replace(/\n/g, '<br>')
        .replace(/(^|\s)_(\W|\W+\S)_/g, '$1<em>$2</em>')
        .replace(/^\*\s*([^*]+)\s*\*$/, '<em>$1</em>')
        .replace(/(^|\W)\*([^\s*]|[^\s*].*?\S)\*/g, '$1<em>$2</em>')
        .replace(/\b(http\S+[^.,)?!\s])/g, '<a href="$1" target="_blank">$1</a>');
};

// Find my nickname
(function() {

    var myNickname;

    function escapeRegExp(string){
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function updateNickname() {
        myNickname = new RegExp('(?:^|, )' + escapeRegExp(Room.socket.nickname) + ', ');
    }

    Room.on('enter', updateNickname);
    Room.on('my.nickname.updated', updateNickname);

    Talk.isForMe = function(content) {
        return myNickname.test(content);
    };

})();

// Messages composer
(function() {

    var renderSpeech = $.template('#speech-template');
    var renderMessage = $.template('#message-template');

    function extendMessage(data) {
        var created = new Date(data.created);
        data.date = created.toSmartDate();
        data.time = created.toHumanTime();
        data.timestamp = created.getTime();
        data.content = Talk.format(data.content) || '…';
        return data;
    }

    function createSpeech(data) {
        data.userpicUrl = Userpics.getUrl(data);
        var elem = renderSpeech(data);
        if (data.session_id) {
            elem.attr('data-session', data.session_id);
        }
        if (data.user_id) {
            elem.attr('data-user', data.user_id);
        }
        if (data.recipient_nickname) {
            elem.addClass('personal');
            elem.find('.speech-author').append(renderRecipient(data));
        }
        elem.append(createMessage(data));
        return elem;
    }

    var edit = $('<span class="msg-edit" title="Редактировать сообщение"></span>')[0];

    function createMessage(data) {
        var elem = renderMessage(data);
        if (Room.isMy(data)) {
            if (data.date === 'сегодня' || data.date === 'вчера') {
                elem.find('.msg-text').append(edit.cloneNode(true));
            }
        } else if (Talk.isForMe(data.content)) {
            elem.addClass('with-my-name');
        }
        return elem;
    }

    function renderRecipient(message) {
        var nickname = message.recipient_nickname;
        if (nickname === Room.socket.nickname) nickname = 'я';
        return $('<span></span>')
            .addClass('speech-recipient')
            .attr('data-session', message.recipient_session_id)
            .attr('data-user', message.recipient_id)
            .html('&rarr; <span class="recipient-nickname">' + nickname + '</span>');
    }

    function renderDate(date) {
        return $('<div class="date"><span class="date-text">' + date + '</span></div>');
    }

    var interruption = 1000 * 60 * 60 * 3;

    function inRow(m1, m2) {
        return m1.date === m2.date &&
            m1.nickname === m2.nickname &&
            m1.recipient_nickname == m2.recipient_nickname &&
            m2.timestamp - m1.timestamp < interruption;
    }

    function Composer(output) {
        this.output = output;
    }

    Composer.prototype.push = function(content, date) {
        if (date !== this.date) {
            this.output(renderDate(date), true);
            this.date = date;
        }
        this.output(content);
        return content;
    };

    Composer.prototype.append = function(message) {
        extendMessage(message);
        if (this.speech && inRow(this.last, message)) {
            this.speech.append(createMessage(message));
        } else {
            var speech = createSpeech(message);
            this.push(speech, message.date);
            this.speech = speech;
        }
        this.last = message;
    };

    Talk.Composer = Composer;

})();

// Remove messages
(function() {

    var container = Talk.container;

    function clearDates() {
        var dates = container.find('.date');
        var waste = dates.prev('.date');
        if (dates.last().next().length === 0) {
            waste = waste.add(dates.last());
        }
        if (waste.length) {
            dates.not(waste).eq(0).hide();
            waste.remove();
            Room.trigger('dates.changed');
        }
    }

    Talk.removeMessages = function(messages) {
        var speeches = messages.parent();
        var lastChanged = speeches.last().next().length === 0;
        messages.remove();
        speeches.not(':has(.message)').remove();
        clearDates();
        if (lastChanged) {
            Talk.updateLast();
        }
    };

})();

// Remove ignored messages
(function() {

    var container = Talk.container;

    var timer;
    var nodes = [];

    function clearIgnored() {
        clearTimeout(timer);
        $window.queue(function(next) {
            Talk.removeMessages($(nodes));
            nodes = [];
            next();
        });
    }

    function removeMessage(id) {
        var message = container.find('.message[data-id="' + id + '"]');
        if (message.length) {
            clearTimeout(timer);
            nodes.push(message[0]);
            timer = setTimeout(clearIgnored, 50);
        }
    }

    Room.on('message.ignore.updated', function(data) {
        if (data.ignore && !Room.socket.ignored) {
            removeMessage(data.message_id);
        }
    });

})();

// Load messages
(function() {

    var container = Talk.container;
    var previous = container.find('.talk-previous');

    function getMessages(conditions) {
        var options = {
            room_id: Room.data.room_id,
            order_by: {'-desc': 'message_id'},
            for_me: Talk.forMeOnly ? 1 : 0
        };
        if (conditions) {
            $.extend(options, conditions);
        }
        return Rest.messages.get(options);
    }

    function sliceRecent(messages) {
        if (messages.length < 150) {
            previous.hide();
        } else {
            previous.show();
            messages = messages.slice(0, 100);
        }
        if (Room.ignores) {
            messages = messages.filter(notAnnoying);
        }
        return messages.reverse();
    }

    function notAnnoying(message) {
        return !Room.ignores(message);
    }

    function showRecent(messages) {
        previous.detach();
        container.empty().append(previous);
        if (messages.length) {
            container.append(renderMessages(messages));
        }
        container.find('.date').first().hide();
        container.show();
        $window.scrollTop($document.height() - $window.height() - 1);
        Room.trigger('dates.changed');
        Talk.updateLast();
        Talk.length = messages.length;
    }

    function renderMessages(messages) {
        var nodes = [];
        var composer = new Talk.Composer(function(content) {
            nodes.push(content[0]);
        });
        messages.forEach(function(message) {
            composer.append(message);
        });
        return nodes;
    }

    function mergeDatesBefore(speech) {
        var dates = speech.prevAll('.date');
        if (dates[0].innerHTML === dates[1].innerHTML) {
            dates.eq(0).remove();
        } else {
            dates.eq(0).show();
        }
        dates.last().hide();
        Room.trigger('dates.changed');
    }

    Talk.loadRecent = function() {
        return getMessages()
            .then(sliceRecent)
            .done(showRecent);
    };

    Room.on('enter', function() {
        Talk.length = 0;
        Talk.forMeOnly = false;
        Room.promises.push(Talk.loadRecent());
    });

    previous.on('click', function() {
        if (previous.hasClass('loading')) return;
        var oldFirst = container.find('.message').eq(0);
        var offset = oldFirst.offset().top - $window.scrollTop();
        previous.addClass('loading');
        getMessages({
            message_id: {'<': Number(oldFirst.attr('data-id'))},
        })
            .then(sliceRecent)
            .done(function(messages) {
                previous.after(renderMessages(messages));
                previous.removeClass('loading');
                mergeDatesBefore(oldFirst.closest('.speech'));
                var pos = oldFirst.offset().top - offset;
                $window.scrollTop(pos).delay(150).scrollTo(pos - 150, 400);
                Talk.length += messages.length;
            })
            .fail(function() {
                previous.removeClass('loading');
            });
    });

    Talk.forMeOnly = true;

})();

// Show created messages
(function() {

    var container = Talk.container;

    var composer = new Talk.Composer(function(content, isDate) {
        Talk.container.append(content);
        if (isDate) {
            if (!composer.last.message_id) content.hide();
            Room.trigger('dates.changed');
        }
    });

    function updateLast(message) {
        var created = message.find('time').attr('datetime');
        var speech = message.closest('.speech');
        var date = new Date(created);
        var last = {
            message_id: Number(message.attr('data-id')),
            nickname: speech.find('.nickname').text(),
            date: date.toSmartDate(),
            timestamp: date.getTime(),
            created: created
        };
        if (speech.hasClass('personal')) {
            last.recipient_nickname = speech.find('.recipient-nickname').text();
        }
        composer.speech = speech;
        composer.date = last.date;
        composer.last = last;
    }

    function isForMe(data) {
        return data.recipient_nickname || Room.isMy(data) || Talk.isForMe(data.content);
    }

    function removeOld(next) {
        var messages = container.find('.message');
        var scrolled = $window.scrollTop();
        var cut = messages.eq(50);
        if (cut.position().top < scrolled) {
            var height = $document.height();
            Talk.removeMessages(messages.slice(0, 50));
            Talk.container.find('.talk-previous').show();
            $window.scrollTop(scrolled - (height - $document.height()));
            Talk.length = messages.length - 50;
        }
        next();
    }

    Room.on('message.created', function(message) {
        if (message.ignore && !Room.socket.ignored) return false;
        if (Room.ignores && Room.ignores(message)) return false;
        if (message.message_id > composer.last.message_id) {
            if (!Talk.forMeOnly || isForMe(message)) {
                composer.append(message);
                Room.trigger('talk.updated');
                if (Talk.length++ > 1000) {
                    $window.queue(removeOld);
                }
                Talk.scrollDown(composer.speech[0].lastChild);
            }
        }
    });

    $window.on('date.changed', function() {
        var last = composer.last;
        if (last && last.created) {
            last.date = (new Date(last.created)).toSmartDate();
            composer.date = last.date;
        }
    });

    Talk.updateLast = function() {
        var message = this.container.find('.message').last();
        if (message.length) {
            updateLast(message);
        } else {
            composer.last = {message_id: 0};
        }
    };

})();

// Update message
(function() {

    function setContent(elem, content) {
        var edit = elem.find('.msg-edit').detach();
        var text = elem.find('.msg-text').html(Talk.format(content) || '…');
        if (edit.length) {
            text.append(edit);
        }
    }

    Room.on('message.content.updated', function(message) {
        var elem = Talk.container.find('.message[data-id="' + message.message_id + '"]');
        if (elem.length) {
            setContent(elem, message.content);
        }
    });

    Talk.setContent = setContent;

})();

// Apply ignores
Room.on('user.ignores.updated', function() {
    Talk.loadRecent();
});

// User actions
(function() {

    var container = Talk.container;

    function parseSocket(speech) {
        var data = {
            nickname: speech.find('.nickname').text(),
            session_id: Number(speech.attr('data-session')),
            user_id: Number(speech.attr('data-user'))
        };
        if (data.user_id) {
            var userpicUrl = speech.find('.userpic').css('background-image');
            data.userpic = userpicUrl.match(/\d+\.png(\?\d+)?/)[0];
        }
        return data;
    }

    function parseRecipient(speech) {
        var elem = speech.find('.speech-recipient');
        return {
            user_id: Number(elem.attr('data-user')),
            session_id: Number(elem.attr('data-session')),
            nickname: elem.find('.recipient-nickname').text()
        };
    }

    function getSocket(speech) {
        var session_id = Number(speech.attr('data-session'));
        var socket = session_id && Room.users.findSession(session_id)[0];
        return socket || parseSocket(speech);
    }

    function replyPersonal(speech) {
        var socket = getSocket(speech);
        if (Room.isMy(socket)) {
            Room.replyPrivate(parseRecipient(speech));
        } else {
            Room.replyPrivate(socket);
        }
    }

    container.on('click', '.userpic', function(event) {
        event.stopPropagation();
        var userpic = $(this);
        var data = getSocket(userpic.closest('.speech'));
        Profile.show(data, userpic);
    });

    container.on('click', '.nickname', function() {
        var elem = $(this);
        var speech = elem.closest('.speech');
        var nickname = elem.text();
        if (speech.hasClass('personal')) {
            replyPersonal(speech);
        } else if (nickname !== Room.socket.nickname) {
            Room.replyTo(nickname);
        } else {
            Room.replyTo();
        }
    });

    container.on('click', '.speech-recipient', function() {
        replyPersonal($(this).closest('.speech'));
    });

    container.on('click', '.msg-edit', function() {
        Room.edit($(this).closest('.message'));
    });

    Room.editLast = function() {
        var icons = Talk.container.find('.msg-edit');
        if (icons.length) {
            Room.edit(icons.last().closest('.message'));
        }
    };

})();

// Scroll talk
(function() {

    var iOS = /ip(od|ad|hone)/i.test(navigator.platform);
    function isKeyboardOpened(dh) {
        var st = $window.scrollTop();
        var wh = $window.height();
        return st + wh - dh > 10;
    }

    function scrollDown(node) {
        if (iOS) {
            var dh = $document.height();
            if (isKeyboardOpened(dh)) {
                $window.scrollTop(dh);
                return false;
            }
        }
        $window.scrollTo(function(now) {
            var height = $window.height();
            var offset = $(node).offset().top;
            if (offset < now + height + 20) {
                var pos = $document.height() - height;
                if (pos > now) {
                    return pos;
                }
            }
        });
    }

    Talk.scrollDown = scrollDown;

})();

// Update dates after midnight
$window.on('date.changed', function() {
    Talk.container.find('.date').each(function() {
        var elem = $(this);
        var time = elem.next('.speech').find('time').attr('datetime');
        if (time) {
            var date = (new Date(time)).toSmartDate();
            elem.find('.date-text').text(date);
        }
    });
    Room.trigger('dates.changed');
});

// Remove obsolete edit icons
$window.on('date.changed', function() {
    Talk.container
        .find('.msg-edit')
        .not(function(index, node) {
            var time = $(node).closest('.message').find('time').attr('datetime');
            var date = (new Date(time)).toSmartDate();
            return date === 'вчера' || date === 'сегодня';
        })
        .remove();
});

// Sticky dates
(function() {

    var container = Talk.container;
    var header = $('#talk .talk-header');
    var value = header.find('.date-text');

    var dates = [];
    var min, max;
    var headerHeight;

    function update() {
        var active = dates.length > 1;
        headerHeight = header.height();
        dates = container.find('.date').map(getDate);
        if (dates.length) {
            toggle(window.pageYOffset);
        } else {
            value.text('сегодня');
        }
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

// Window title
(function() {

    var mainTitle = document.title;
    var mark = String.fromCharCode(9733);

    Room.on('enter', function() {
        document.title = Room.data.topic;
    });

    Room.on('leave', function() {
        document.title = mainTitle;
    });

    Room.on('lost', function() {
        document.title = 'Комната не найдена';
    });

    $window.on('focus', function() {
        if (Room.data) document.title = Room.data.topic;
    });

    Room.on('room.topic.updated', function() {
        if (!Room.idle) document.title = Room.data.topic;
    });

    Room.on('talk.updated', function() {
        if (Room.idle) {
            document.title = mark + ' ' + Room.data.topic;
        }
    });

})();

// Filter messages for me
(function() {

    var control = $('#talk .toggle-for-me');

    Room.on('enter', function() {
        control.removeClass('enabled');
    });

    control.on('click', function() {
        Talk.forMeOnly = !Talk.forMeOnly;
        control.toggleClass('enabled', Talk.forMeOnly);
        Talk.loadRecent();
    });

})();

// Notifier
(function() {

    var sound;
    var soundEnabled;

    var icon = $('#talk .notifications');

    function isMobile() {
        return /android|blackberry|iphone|ipad|ipod|mini|mobile/i.test(navigator.userAgent);
    }

    function toggleSound(enabled) {
        if (enabled === soundEnabled) return;
        if (enabled) {
            if (!sound) sound = new Sound({
                mp3: '/script/sound/message.mp3',
                ogg: '/script/sound/message.ogg'
            });
            Room.on('talk.updated', notify);
            icon.addClass('enabled');
        } else {
            Room.off('talk.updated', notify);
            icon.removeClass('enabled');
        }
        soundEnabled = enabled;
    }

    function notify() {
        if (Room.idle) sound.play();
    }

    if (isMobile()) {
        icon.hide();
        return false;
    }

    Room.on('ready', function() {
        var stored = localStorage.getItem('sound_in_' + Room.data.room_id);
        toggleSound(Boolean(stored));
    });

    icon.on('click', function() {
        toggleSound(!soundEnabled);
        if (soundEnabled) {
            localStorage.setItem('sound_in_' + Room.data.room_id, 1);
        } else {
            localStorage.removeItem('sound_in_' + Room.data.room_id);
        }
    });

})();

// Disconnect
(function() {

    var talk = $('#talk');

    function restore() {
        talk.removeClass('disconnected');
    }

    Room.on('disconnected', function() {
        talk.addClass('disconnected');
    });

    Room.on('connected', restore);
    Room.on('enter', restore);

})();

// Talkrooms vesrion
(function() {

    var notice;
    var version = 22;

    function showNotice(description) {
        notice = $('<div class="updated-notice"></div>')
            .append('<div class="updated-title">Вышло обновление Talkrooms. Пожалуйста, <span class="updated-reload">обновите страницу</span>, чтобы сбросить кэш браузера.</div>')
            .append('<div class="updated-text">' + description + '</div>');
        notice.find('.updated-reload').on('click', function() {
            location.reload(true);
        });
        notice.appendTo('body')
            .css('top', -notice.outerHeight() - 20)
            .animate({top: 0}, 300);
    }

    Room.on('talkrooms', function(data) {
        if (data.version > version && !notice) showNotice(data.whatsnew);
    });

})();
