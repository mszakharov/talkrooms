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
    var fail = overlay.find('.entry-fail');

    Room.on('ready', function() {
        overlay.fadeOut(150);
    });

    Room.on('leave', function() {
        fail.hide().empty();
        overlay.show();
    });

    Room.on('lost', function() {
        fail.html('Комната #' + Room.hash + ' не найдена').show();
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

// Talk
(function() {

    var lastMessage = {};
    var container = $('#talk .talk-messages');
    var previous = container.find('.talk-previous');
    var render = $.template('#message-template');
    var counter = 0;

    function format(content) {
        return content
            .replace(/\n/g, '<br>')
            .replace(/\b(http[\/#?&%:.\-=+\w]+)/g, '<a href="$1" target="_blank">$1</a>');
    }

    function extendMessage(data) {
        var created = new Date(data.created);
        data.date = created.toSmartDate();
        data.time = created.toHumanTime();
        data.content = format(data.content);
        data.userpicUrl = Userpics.getUrl(data);
        return data;
    }

    function sameAuthor(m1, m2) {
        return m1.nickname === m2.nickname && m1.recipient_nickname === m2.recipient_nickname;
    }

    function getNicknames(message) {
        var recipient = message.find('.recipient-nickname');
        return {
            nickname: message.find('.nickname').text(),
            recipient_nickname: recipient.length ? recipient.text() : null
        };
    }

    function toggleIdem(elem) {
        var prev = elem.prev('.message');
        if (prev) {
            var m1 = getNicknames(prev);
            var m2 = getNicknames(elem);
            elem.toggleClass('idem', sameAuthor(m1, m2));
        } else {
            elem.removeClass('idem');
        }
    }

    function renderRecipient(message) {
        var nickname = message.recipient_nickname;
        if (nickname === Room.socket.nickname) nickname = 'я';
        return $('<span></span>')
            .addClass('msg-recipient')
            .attr('data-session', message.recipient_session_id)
            .attr('data-user', message.recipient_id)
            .html('&rarr; <span class="recipient-nickname">' + nickname + '</span>');
    }

    function renderMessage(data, last) {
        extendMessage(data);
        var nodes = [];
        var elem = render(data);
        if (data.session_id) {
            elem.attr('data-session', data.session_id);
        }
        if (data.user_id) {
            elem.find('.msg-author').attr('data-id', data.user_id);
        }
        if (data.recipient_nickname) {
            elem.find('.msg-author').append(renderRecipient(data));
            elem.addClass('private');
        }
        if (data.date !== last.date) {
            nodes.push(renderDate(data.date)[0]);
        } else if (sameAuthor(data, last)) {
            elem.addClass('idem');
        }
        nodes.push(elem[0]);
        return nodes;
    }

    function renderMessages(messages) {
        var last = {};
        var nodes = [];
        messages.forEach(function(message) {
            nodes.push.apply(nodes, renderMessage(message, last));
            last = message;
        });
        return nodes;
    }

    function renderDate(date) {
        return $('<div class="date"><span class="date-text">' + date + '</span></div>');
    }

    var scrolledIdle = 0;

    $window.on('focus', function() {
        scrolledIdle = 0;
    });

    function scrollDown(offset) {
        var wh = $window.height();
        var st = $window.scrollTop();
        if (scrolledIdle < wh / 2 && offset < st + wh) {
            var pos = $document.height() - wh;
            if (Room.idle) {
                scrolledIdle += pos - st;
            }
            $scrollWindow.stop(true).to(pos);
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
            messages.eq(50).removeClass('idem');
            dates.slice(1).remove();
            dates.eq(0).hide();
            previous.show();
            $window.scrollTop(scrolled - (height - $document.height()));
            counter = messages.length - 50;
        }
        next();
    }

    function clearMessages(messages) {
        var wasLast = messages.last().next().length === 0;
        var after = messages.next('.message:not(.idem)');
        messages.remove();
        after.each(function(i, node) {
            toggleIdem($(node));
        });
        clearDates();
        if (wasLast) {
            var last = container.find('.message').last();
            lastMessage = $.extend(getNicknames(last), {
                message_id: Number(last.attr('data-id')),
                socket_id: last.attr('data-socket'),
                date: container.find('.date-text').last().text()
            });
        }
    }

    function clearDates() {
        var dates = container.find('.date');
        var waste = dates.prev('.date');
        if (dates.last().next().length === 0) {
            waste = waste.add(dates.last());
        }
        if (waste.length) {
            waste.remove();
            Room.trigger('dates.changed');
        }
    }

    function getSocket(message) {
        var session_id = Number(message.attr('data-session'));
        var socket = session_id && Room.users.findSession(session_id)[0];
        return socket || parseSocket(message);
    }

    function parseSocket(message) {
        var data = {
            session_id: Number(message.attr('data-session')),
            nickname: message.find('.nickname').text(),
            user_id: Number(message.find('.msg-author').attr('data-id'))
        };
        if (data.user_id) {
            var userpicUrl = message.find('.userpic').css('background-image');
            data.userpic = userpicUrl.match(/\d+\.png(\?\d+)?/)[0];
        }
        return data;
    }

    function parseRecipient(elem) {
        return {
            user_id: Number(elem.attr('data-user')),
            session_id: Number(elem.attr('data-session')),
            nickname: elem.find('.recipient-nickname').text()
        };
    }

    function replyPrivate(message) {
        var socket = getSocket(message);
        if (Room.isMy(socket)) {
            Room.replyPrivate(socket);
        } else {
            var recipient = message.find('.msg-recipient');
            Room.replyPrivate(parseRecipient(recipient));
        }
    }

    container.on('click', '.msg-recipient', function() {
        var data = parseRecipient($(this));
        if (!Room.isMy(data)) {
            Room.replyPrivate(data);
        } else {
            var message = $(this).closest('.message');
            Room.replyPrivate(getSocket(message));
        }
    });

    container.on('click', '.nickname', function() {
        var target = $(this);
        var nickname = target.text();
        var message = target.closest('.message');
        if (message.hasClass('private')) {
            replyPrivate(message);
        } else if (nickname !== Room.socket.nickname) {
            Room.replyTo(nickname);
        } else {
            Room.replyTo();
        }
    });

    container.on('click', '.userpic', function(event) {
        event.stopPropagation();
        var userpic = $(this);
        var message = userpic.closest('.message');
        Profile.show(getSocket(message), userpic);
    });

    function loadRecent() {
        return Rest.messages
            .get({
                room_id: Room.data.room_id,
                order_by: {'-desc': 'message_id'}
            })
            .done(function(recent) {
                previous.detach();
                container.empty().append(previous);
                if (recent.length === 80) {
                    recent = recent.slice(0, 50);
                    previous.show();
                } else {
                    previous.hide();
                }
                if (recent.length) {
                    var nodes = renderMessages(recent.reverse());
                    lastMessage = recent[recent.length - 1];
                    container.append(nodes);
                } else {
                    lastMessage = {message_id: 0, date: 'сегодня'};
                    container.append(renderDate('сегодня'));
                }
                container.find('.date').first().hide();
                container.show();
                $window.scrollTop($document.height() - $window.height() - 1);
                Room.trigger('dates.changed');
                counter = recent.length;
            });
    };

    previous.on('click', function() {
        if (previous.hasClass('loading')) return;
        var oldFirst = container.find('.message').eq(0);
        var offset = oldFirst.next().offset().top - $window.scrollTop();
        previous.addClass('loading');
        Rest.messages
            .get({
                room_id: Room.data.room_id,
                order_by: {'-desc': 'message_id'},
                message_id: {'<': Number(oldFirst.attr('data-id'))}
            })
            .done(function(messages) {
                if (messages.length === 80) {
                    messages = messages.slice(0, 50);
                    previous.show();
                } else {
                    previous.hide();
                }
                var nodes = renderMessages(messages.reverse());
                previous.after(nodes);
                var prevDates = oldFirst.prevAll('.date');
                if (prevDates.eq(0).html() === prevDates.eq(1).html()) {
                    prevDates.eq(0).remove();
                } else {
                    prevDates.eq(0).show();
                }
                toggleIdem(oldFirst);
                container.find('.date').first().hide();
                Room.trigger('dates.changed');
                var pos = oldFirst.next().offset().top - offset;
                $window.scrollTop(pos);
                $scrollWindow.delay(150).to(pos - 150);
                counter += messages.length;
                previous.removeClass('loading');
            })
            .fail(function() {
                previous.removeClass('loading');
            });
    });

    Room.on('enter', function() {
        Room.promises.push(loadRecent());
    });

    Room.on('leave', function() {
        container.hide();
    });

    Room.on('message.created', function(message) {
        if (message.ignore && !Room.socket.ignore) return false;
        if (message.message_id > lastMessage.message_id) {
            var nodes = renderMessage(message, lastMessage);
            lastMessage = message;
            container.append(nodes);
            scrollDown($(nodes).offset().top);
            if (nodes.length > 1) {
                Room.trigger('dates.changed');
            }
            if (counter++ > 1000) {
                $window.queue(clearOld);
            }
            Room.trigger('talk.updated');
        }
    });

    var ignoredTimer;
    var ignoredNodes = [];

    function clearIgnored() {
        $window.queue(function(next) {
            clearMessages($(ignoredNodes));
            ignoredNodes = [];
            next();
        });
    }

    Room.on('message.ignore.updated', function(data) {
        if (data.ignore && !Room.socket.ignore) {
            clearTimeout(ignoredTimer);
            var selector = '.message[data-id="' + data.message_id + '"]';
            var message = container.find(selector);
            if (message.length) {
                ignoredNodes.push(container.find(selector)[0]);
                ignoredTimer = setTimeout(clearIgnored, 50);
            }
        }
    });

    $window.on('date.changed', function() {
        var date;
        container.find('.date').each(function() {
            var elem = $(this);
            var time = elem.next('.message').find('time').attr('datetime');
            if (time) {
                date = (new Date(time)).toSmartDate();
                elem.find('.date-text').text(date);
            }
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

// Window title
(function() {

    var mainTitle = document.title;

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
            document.title = '+ ' + Room.data.topic;
        }
    });

})();

// Settings
(function() {

    function checkLevel(socket) {
        if (socket.level && socket.level >= 70) {
            $.getScript('/script/views/settings.js').done(loaded);
        }
    }

    function loaded() {
        Room.off('enter', checkLevel);
    }

    Room.on('enter', checkLevel);

})();

// Notifier
(function() {

    var sound = $('#notifier').get(0);

    var icon = $('#talk .notifications');
    icon.on('click', function() {
        toggleSound(!soundEnabled);
    });

    var soundEnabled;
    function toggleSound(enabled) {
        soundEnabled = Boolean(enabled);
        if (soundEnabled) {
            icon[0].classList.add('enabled');
            localStorage.setItem('sound_in_' + Room.data.room_id, 1);
        } else {
            icon[0].classList.remove('enabled');
            localStorage.removeItem('sound_in_' + Room.data.room_id);
        }
    }

    Room.on('ready', function() {
        toggleSound(localStorage.getItem('sound_in_' + Room.data.room_id))
    });

    Room.on('talk.updated', function() {
        if (Room.idle && soundEnabled) {
            sound.currentTime = 0;
            sound.play();
        }
    });

})();

// Talkrooms vesrion
(function() {

    var notice;
    var version = 7;

    function showNotice() {
        notice = $('<div class="updated-notice"><div class="updated-text">Вышло обновление Talkrooms. Пожалуйста, <span class="updated-reload">обновите страницу</span>, чтобы сбросить кэш браузера.</div></div>')
        notice.find('.updated-reload').on('click', function() {
            location.reload(true);
        });
        notice.appendTo('body')
            .css('top', -notice.height() - 20)
            .animate({top: 0}, 300);
    }

    Room.on('talkrooms', function(data) {
        if (data.version > version && !notice) showNotice();
    });

})();
