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
        return m1.nickname === m2.nickname;
    }

    function toggleIdem(elem) {
        var prev = elem.prev('.message');
        if (prev) {
            var n1 = prev.find('.nickname').text();
            var n2 = elem.find('.nickname').text();
            elem.toggleClass('idem', n1 === n2);
        } else {
            elem.removeClass('idem');
        }
    }

    function renderMessage(data, last) {
        extendMessage(data);
        var nodes = [];
        var elem = render(data);
        if (data.socket_id) {
            elem.attr('data-socket', data.socket_id);
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

    function clearBySocket(socket) {
        var ignored = container.find('.message[data-socket="' + socket.socket_id + '"]');
        var after = ignored.next('.message:not(.idem)');
        if (ignored.length) {
            $window.queue(function(next) {
                ignored.remove();
                after.each(function(i, node) {
                    toggleIdem($(node));
                });
                var dates = container.find('.date');
                var removed = dates.prev('.date').remove().length;
                if (dates.last().next('.message').length === 0) {
                    dates.last().remove();
                    removed++;
                }
                if (removed) {
                    Room.trigger('dates.changed');
                }
                if (lastMessage.socket_id == socket.socket_id) {
                    var last = container.find('.message').last();
                    lastMessage = {
                        message_id: Number(last.attr('data-id')),
                        socket_id: last.attr('data-socket'),
                        nickname: last.find('.nickname').text(),
                        date: container.find('.date-text').last().text()
                    };
                }
                next();
            });
        }
    }

    container.on('click', '.nickname', function() {
        Room.replyTo($(this).text());
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
                var nodes = renderMessages(recent.reverse());
                lastMessage = recent[recent.length - 1];
                container.append(nodes);
                container.find('.date').first().hide();
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

    Room.on('socket.ignore.updated', function(socket) {
        if (socket.ignore && !Room.socket.ignore) {
            clearBySocket(socket);
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

    $window.on('blur', function() {
        title = document.title;
    });

    $window.on('focus', function() {
        document.title = title;
    });

    Room.on('ready', function() {
        toggleSound(localStorage.getItem('sound_in_' + Room.data.room_id))
    });

    Room.on('talk.updated', function(message) {
        if (Room.idle) {
            document.title = '+ ' + title;
            if (soundEnabled) {
                sound.currentTime = 0;
                sound.play();
            }
        }
    });

})();

// Ignore sound
(function() {

    var whip = new Audio('/script/sound/whip.mp3');
    whip.volume = 0.15;

    Room.on('role.updated', function(role) {
        if (role && role.level >= 50) whip.volume = 0.5;
    });

    Room.on('socket.ignore.updated', function(socket) {
        if (socket.ignore && !Room.socket.ignore) {
            whip.currentTime = 0;
            whip.play();
        }
    });

})();

// Talkrooms vesrion
(function() {

    var notice;
    var version = 3;

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
