/* Human date and time */
(function() {

    var day = 24 * 60 * 60 * 1000;
    var months = ' января, февраля, марта, апреля, мая, июня, июля, августа, сентября, октября, ноября, декабря'.split(',');
    var recent = ['Сегодня', 'Вчера', 'Позавчера'];
    var tonight = 0;
    var currentYear = (new Date).getFullYear();
    var timer;

    Date.prototype.toHumanTime = function() {
        var m = this.getMinutes();
        return this.getHours() + (m < 10 ? ':0' : ':') + m;
    };

    Date.prototype.toHumanDate = function() {
        var year = this.getFullYear();
        var text = this.getDate() + months[this.getMonth()];
        if (year !== currentYear) {
            text += ' ' + year;
        }
        return text;;
    };

    Date.prototype.toSmartDate = function() {
        return recent[this.daysAgo()] || this.toHumanDate();
    };

    Date.prototype.daysAgo = function() {
        return Math.floor((tonight - this.getTime()) / day);
    };

    function update() {
        var now = Date.now();
        if (now > tonight) {
            currentYear = (new Date).getFullYear();
            tonight = (new Date).setHours(24, 0, 0, 0) - 1;
            $window.trigger('date.changed');
        }
        clearTimeout(timer);
        timer = setTimeout(update, tonight - now + 1000);
    }

    // Reset timer after sleep mode
    Socket.on('connected', update);

    update();

})();

var Talk = {
    content: $('.talk-content')
};


// Talk overlay
(function() {

    var overlay = $('.talk-overlay'),
        sections = overlay.children();

    function showOverlay(section) {
        sections.hide();
        sections.filter(section).show();
        overlay.show();
        Talk.content.removeClass('talk-loading');
    }

    function hideOverlay() {
        overlay.fadeOut(150);
    }

    Rooms.on('explore', function() {
        overlay.hide(); // Show lists instantly
    });

    Rooms.on('select', function(room) {
        if (room.state !== 'ready') {
            Talk.content.addClass('talk-loading');
        }
    });

    Rooms.on('selected.ready', hideOverlay);

    Rooms.on('selected.denied', function(room) {
        if (room.state === 'locked') {
            showOverlay(room.myRole.come_in != null ? '.entry-wait' : '.entry-login');
        } else {
            showOverlay('.entry-' + room.state);
        }
    });

    Rooms.on('shuffle.failed', function() {
        showOverlay('.search-failed');
    });

    overlay.find('.entry-search').on('click', function() {
        Rooms.shuffle();
    });

    overlay.find('.search-failed-hall .link').on('click', function() {
        Rooms.trigger('explore');
    });

})();

// Format content
Talk.format = function(content) {
    var s = content;
    if (~s.indexOf('*')) {
        s = s.replace(/^\*\s*([^*]+)\s*\*$/, '<em>$1</em>');
        s = s.replace(/(^|\W)\*([^\s*]|[^\s*].*?\S)\*/g, '$1<em>$2</em>');
    }
    if (~s.indexOf('_')) {
        s = s.replace(/(^|\s)_(\W|\W+\S)_/g, '$1<em>$2</em>');
    }
    if (~s.indexOf('http')) {
        s = s.replace(/\bhttp\S+talkrooms.ru\/(#[\w\-+]+)\b/g, '$1')
        s = s.replace(/\b(http\S+[^.,)?!\s])/g, '<a href="$1" target="_blank">$1</a>')
    }
    if (~s.indexOf('#')) {
        s = s.replace(/(^|\s)(#[\w\-+]+)\b/g, '$1<a href="/$2">$2</a>');
    }
    if (~s.indexOf('~~')) {
        s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
    }
    return s.replace(/\n/g, '<br>');
};

// Dates
(function() {

    var dates = [];
    var index = {};

    function Day(str) {
        this.date = new Date(str);
        this.title = this.date.toSmartDate();
        this.node = $('<div class="date"><span class="date-text">' + this.title + '</span></div>')[0];
    }

    function createDay(str) {
        var day = new Day(str);
        index[str] = day;
        dates.push(day);
        return day;
    }

    function updateTitle(day) {
        var title = day.date.toSmartDate();
        if (title !== day.title) {
            $(day.node).find('.date-text').text(title);
            day.title = title;
        }
    }

    Talk.getDate = function(str) {
        return index[str] || createDay(str);
    };

    // Update dates after midnight
    $window.on('date.changed', function() {
        dates.forEach(updateTitle);
        Talk.reflowDates();
    });

})();


// Messages
(function() {

    var renderSpeech = $.template('#speech-template'),
        renderRecipient = $.template('#recipient-template'),
        renderMessage = $.template('#message-template');

    var edit = $('<span class="msg-edit" title="Редактировать сообщение"></span>')[0];

    function Message(data) {
        var created = new Date(data.created);
        var message = renderMessage({
            message_id: data.message_id,
            created: data.created,
            content: Talk.format(data.content) || '…',
            time: created.toHumanTime(),
        });
        if (data.isMy) {
            if (created.daysAgo() < 2) {
                message.find('.msg-text').append(edit.cloneNode(true));
            }
        } else if (data.mentionsMe) {
            message.addClass('with-my-name');
        }
        this.timestamp = created.getTime();
        this.date = created.toDateString();
        this.node = message[0];
        this.data = data;
    }

    Message.prototype.appendTo = function(parent, previous) {
        if (oneSpeech(previous, this)) {
            previous.node.parentNode.appendChild(this.node);
        } else {
            if (this.date !== previous.date) {
                parent.appendChild(Talk.getDate(this.date).node);
            }
            appendSpeech(this.data, parent).appendChild(this.node);
        }
        return this;
    };


    // Begin new speech after 3 hours
    var speechGap = 3600000 * 3;

    function oneSpeech(a, b) {
        return a.date === b.date &&
            b.timestamp - a.timestamp < speechGap &&
            oneContext(a.data, b.data);
    }

    function oneContext(a, b) {
        return a.role_id === b.role_id &&
            a.nickname === b.nickname &&
            a.recipient_role_id == b.recipient_role_id;
    }

    function appendSpeech(data, parent) {
        var speech = renderSpeech({
            role_id: data.role_id,
            nickname: data.nickname,
            userpicUrl: Userpics.getUrl(data)
        });
        var node = speech[0];
        var recipient_id = data.recipient_role_id;
        if (recipient_id) {
            var recipient = renderRecipient({
                role_id: recipient_id,
                nickname: recipient_id === Room.myRole.role_id ? 'я' : data.recipient_nickname
            });
            speech.find('.speech-author').append(recipient);
            speech.addClass('personal');
        }
        parent.appendChild(node);
        return node;
    }

    function renderFragment(messages, after) {
        var previous = after || {};
        var fragment = document.createDocumentFragment();
        for (var i = 0; i < messages.length; i++) {
            previous = messages[i].appendTo(fragment, previous);
        }
        return fragment;
    }


    // Section constructor
    function Section(selector, capacity) {
        this.container = $(selector)[0];
        this.capacity = capacity;
        this.messages = [];
    }

    Section.prototype.reset = function(messages) {
        this.messages = messages;
        this.container.textContent = '';
        if (messages.length) {
            var fragment = renderFragment(messages);
            this.container.appendChild(fragment);
        }
    };

    Section.prototype.prepend = function(messages) {
        var fragment = renderFragment(messages);
        this.messages = messages.concat(this.messages);
        this.container.insertBefore(fragment, this.container.firstChild);
        this.join(messages.length);
    };

    Section.prototype.append = function(messages) {
        var fragment = renderFragment(messages, this.messages[this.messages.length - 1]);
        this.messages = this.messages.concat(messages);
        this.container.appendChild(fragment);
    };

    Section.prototype.join = function(index) {
        var m1 = this.messages[index - 1];
        var m2 = this.messages[index];
        if (m1 && m2 && oneSpeech(m1, m2)) {
            $(m2.node.parentNode).detach().find('.message').appendTo(m1.node.parentNode);
        }
    };

    Section.prototype.shift = function() {
        var index = this.messages.length - this.capacity;
        if (index > 0) {
            var cut = $(this.messages[index].node);
            cut.prevAll('.message').detach();
            cut.parent().prevAll().detach();
            var removed = this.messages.splice(0, index);
            this.restoreFirstDate();
            return removed;
        }
    };

    Section.prototype.pop = function() {
        var count = this.messages.length - this.capacity;
        if (count > 0) {
            var cut = $(this.messages[this.capacity - 1].node);
            cut.nextAll('.message').detach();
            cut.parent().nextAll().detach();
            return this.messages.splice(this.capacity);
        }
    };

    Section.prototype.remove = function(index) {
        var node = this.messages[index].node;
        var speech = node.parentNode;
        this.messages.splice(index, 1);
        if (speech.childElementCount < 3) {
            speech.parentNode.removeChild(speech);
            if (index && index < this.messages.length) {
                this.join(index);
            }
        } else {
            speech.removeChild(node);
        }
    };

    Section.prototype.setIgnore = function(values, isVisible) {
        var messages = this.messages;
        for (var i = messages.length; i--;) {
            var data = messages[i].data;
            if (values[data.message_id]) {
                data.ignore = values[data.message_id];
                if (!isVisible(data)) {
                    this.remove(i);
                }
            }
        }
    };

    Section.prototype.restoreFirstDate = function() {
        var first = this.messages[0];
        if (first) {
            var date = Talk.getDate(first.date).node;
            if (!date.parentNode) {
                this.container.insertBefore(date, first.node.parentNode);
            }
        }
    };

    Talk.createMessage = function(data) {
        var room = Rooms.selected;
        data.isMy = room.isMy(data);
        if (!data.isMy && data.mentions) {
            data.mentionsMe = room.mentionsMe(data.mentions);
        }
        return new Message(data);
    };

    Talk.Section = Section;

})();

// Sections
(function() {

    var myRole;

    var previous = $('.talk-previous'),
        recent = $('.talk-recent'),
        next = $('.talk-next');

    var archive = new Talk.Section('.talk-archive', 380),
        current = new Talk.Section('.talk-current', 500);

    // Leave a margin to push new messages
    current.overflow = 20;

    current.reduceCapacity = function(reduced) {
        this.capacity = reduced ? 80 : 500;
    };

    current.setLast = function(message) {
        this.last = message || lastOf(this.messages) || {data: {message_id: 0}};
    };

    current.vacant = function() {
        return this.capacity - this.messages.length;
    };

    function lastOf(items) {
        return items[items.length - 1];
    }

    function isVisible(data) {
        return Rooms.selected.isVisible(data);
    }

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

    function loadBefore(message) {
        return getMessages({
            message_id: {'<': message.data.message_id}
        });
    }

    function loadAfter(message) {
        return getMessages({
            message_id: {'>': message.data.message_id},
            order_by: {'-asc': 'message_id'}
        });
    }

    function loadAfterDate(date) {
        return getMessages({
            created: {'>': date.toISOString()},
            order_by: {'-asc': 'message_id'}
        });
    }

    function togglePrevious(messages) {
        previous.toggle(messages.length === 150);
        return messages.reverse();
    }

    function useIgnores(messages) {
        return myRole.isModerator ? messages : messages.filter(notAnnoying);
    }

    function notAnnoying(message) {
        return !Me.isHidden(message);
    }

    function showRecent(messages) {
        toggleArchive(false);
        archive.reset([]);
        current.reset(messages.map(Talk.createMessage));
        current.setLast();
        Talk.scrollDown();
        Talk.content.removeClass('talk-loading');
        Talk.reflowDates();
    }

    function updateSections(action, data, anchor) {
        var offset = anchor.getBoundingClientRect().top;
        action(data);
        Talk.reflowDates();
        Talk.restoreOffset(anchor, offset);
    }

    function trimCurrent(next) {
        var cut = current.messages[-current.vacant()];
        var offset = cut ? cut.node.getBoundingClientRect().top : 0;
        if (archive.messages.length === 0 && offset > 0) {
            current.reduceCapacity(true);
            archive.reset(current.shift().slice(0, archive.capacity));
            toggleArchive(true);
        } else {
            current.shift();
        }
        if (offset < 0) {
            Talk.restoreOffset(cut.node, offset);
        }
        Talk.reflowDates();
        next();
    }

    function cleanDates() {
        Talk.content
            .find('.date')
            .filter(function(i, elem) {
                return $(elem).next('.speech').length === 0;
            })
            .detach();
        current.restoreFirstDate();
    }

    Talk.loadRecent = function() {
        return getMessages()
            .then(togglePrevious)
            .then(useIgnores)
            .done(showRecent);
    };

    Talk.updateIgnore = function(ignore) {
        var content = Talk.content.get(0);
        var offset = content.scrollHeight - content.scrollTop;
        archive.setIgnore(ignore, isVisible);
        current.setIgnore(ignore, isVisible);
        current.setLast();
        cleanDates();
        Talk.reflowDates();
        content.scrollTop = content.scrollHeight - offset;
    };

    function findLast(messages, callback) {
        for (var i = messages.length; i--;) {
            if (callback(messages[i])) return messages[i];
        }
    }

    Talk.find = function(callback) {
        return findLast(current.messages, callback) || findLast(archive.messages, callback)
    };

    Talk.getData = function(callback) {
        var message = this.find(callback);
        if (message) {
            return message.data;
        }
    };

    // Стираем сообщения последней комнаты,
    // чтобы не видеть их при загрузке следующей
    Rooms.on('explore', function() {
        Talk.reset();
    });

    // То же самое, если комната недоступна
    Rooms.on('selected.denied', function() {
        Talk.reset();
    });

    Rooms.on('select', function() {
        Talk.content.addClass('talk-loading');
    });

    Rooms.on('selected.ready', function(room) {
        myRole = room.myRole;
        Talk.forMeOnly = room.forMeOnly || false;
        Talk.loadRecent();
    });

    Talk.reset = function() {
        archive.reset([]);
        current.reset([]);
    };

    Talk.appendMessage = function(data) {
        if (data.message_id > current.last.data.message_id) {
            var message = Talk.createMessage(data);
            var lastSpeech = current.last.node && current.last.node.parentNode;
            Talk.fixScroll();
            message.appendTo(current.container, current.last);
            current.messages.push(message);
            if (message.date !== current.last.date) {
                Talk.reflowDates();
            }
            current.setLast(message);
            if (current.messages.length > current.capacity + current.overflow) {
                Talk.scrollQueue(trimCurrent);
            }
            if (message.node.parentNode === lastSpeech) {
                Talk.scrollFurther(message.node);
            } else if (lastSpeech) {
                Talk.scrollFurther(lastSpeech.nextSibling);
            }
            return true;
        }
    };

    Talk.updateMessage = function(data) {
        var updated = Talk.find(function(message) {
            return data.message_id === message.data.message_id;
        });
        if (updated) {
            var text = $(updated.node).find('.msg-text');
            var edit = text.find('.msg-edit').detach();
            text.html(Talk.format(data.content) || '…').append(edit);
            updated.data.content = data.content;
            Talk.reflowDates(); // because of new message height
        }
    };

    function toggleArchive(visible) {
        $(archive.container).toggle(visible);
        $(current.container).toggleClass('talk-splitted', visible);
        next.toggle(visible);
        recent.toggle(visible);
    }

    function showPrevious(data) {
        var messages = data.map(Talk.createMessage);
        if (archive.messages.length) {
            archive.prepend(messages);
            archive.pop();
            current.restoreFirstDate();
        } else if (messages.length > current.vacant()) {
            current.reduceCapacity(true);
            archive.reset(messages.concat(current.shift()).slice(0, archive.capacity));
            toggleArchive(true);
        } else {
            current.prepend(messages);
        }
        Talk.reflowDates();
    }

    function showMoreRecent(data) {
        var messages = [];
        var addAfter = lastOf(archive.messages).data.message_id;
        if (addAfter >= data[0].message_id) {
            messages = messages.concat(archive.messages);
        }
        for (var i = 0; i < data.length; i++) {
            var item = data[i];
            if (item.message_id > addAfter) {
                messages.push(Talk.createMessage(item));
            }
        }
        mergeSections(messages);
    }

    function showNext(data) {
        var addBefore = current.messages[0].data.message_id;
        if (addBefore <= lastOf(data).message_id) {
            var messages = archive.messages.concat();
            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                if (item.message_id < addBefore) {
                    messages.push(Talk.createMessage(item));
                }
            }
            mergeSections(messages);
        } else {
            archive.append(data.map(Talk.createMessage));
            if (archive.shift()) {
                previous.show();
            }
        }
    }

    function replaceArchive(data) {
        archive.reset([]);
        current.reduceCapacity(true);
        current.shift();
        showNext(data);
        if (archive.messages.length) {
            toggleArchive(true);
        }
        Talk.reflowDates();
    }

    function mergeSections(messages) {
        current.reduceCapacity(false);
        var vacant = current.vacant();
        if (messages.length > vacant) {
            messages = messages.slice(-vacant);
            previous.toggle(true);
        }
        toggleArchive(false);
        archive.reset([]);
        current.prepend(messages);
    }

    var loading;

    function loaded() {
        loading.removeClass('talk-loading');
        loading = null;
    }

    function initNavigation(elem, load) {
        elem.find('.talk-load').on('click', function() {
            if (!loading) {
                loading = elem.addClass('talk-loading');
                load().always(loaded);
            }
        });
    }

    function getFirstMessage() {
        return (archive.messages.length ? archive : current).messages[0];
    }

    initNavigation(previous, function() {
        var first = getFirstMessage();
        var offset = first.node.getBoundingClientRect().top;
        return loadBefore(first)
            .then(togglePrevious)
            .then(useIgnores)
            .done(function(data) {
                showPrevious(data);
                Talk.restoreOffset(first.node, offset);
                Talk.scrollAbove();
            });
    });

    initNavigation(next, function() {
        var last = lastOf(archive.messages);
        return loadAfter(last)
            .then(useIgnores)
            .done(function(data) {
                updateSections(showNext, data, last.node);
            });
    });

    initNavigation(recent, function() {
        var first = current.messages[0];
        current.reduceCapacity(false);
        return loadBefore(first)
            .then(togglePrevious)
            .then(useIgnores)
            .done(function(data) {
                updateSections(showMoreRecent, data, first.node);
            });
    });

    // Datepicker
    var datepicker = $.Datepicker('#datepicker', function(date) {
        if (loading) return false;
        loading = Talk.content.addClass('talk-loading');
        loadAfterDate(date)
            .then(useIgnores)
            .done(replaceArchive)
            .done(function() {
                if (date.getTime() < Date.parse(Room.data.created)) {
                    previous.hide();
                }
            })
            .always(loaded);
    });

    var dpControl = $('.header-date-text');

    dpControl.on('click', function(event) {
        var df = new Date(Room.data.created);
        var dc = new Date(getFirstMessage().timestamp);
        var dl = new Date();
        datepicker.setRange(df, dl);
        datepicker.show(dc, dpControl, event.originalEvent.forwardedTouchEvent);
    });

    // Remove obsolete edit icons
    $window.on('date.changed', function() {
        var room = Rooms.selected;
        var editAfter = (new Date).setHours(0, 0, 0, 0) - (24 * 60 * 60 * 1000);
        current.messages.forEach(function(message) {
            if (room.isMy(message.data) && message.timestamp < editAfter) {
                $(message.node).find('.msg-edit').detach();
            };
        });
    });

})();

// Update ignored messages
(function() {

    var timer;
    var ignore = {};

    function setIgnore() {
        clearTimeout(timer);
        Talk.scrollQueue(function(next) {
            Talk.updateIgnore(ignore);
            ignore = {};
            next();
        });
    }

    Rooms.pipe('message.ignore.updated', function(room, data) {
        if (room === Rooms.selected) {
            ignore[data.message_id] = data.ignore;
            timer = setTimeout(setIgnore, 50);
        }
    });

})();

// Apply ignores
Socket.on('me.ignores.updated', function() {
    Talk.loadRecent();
});

// User actions
(function() {

    var content = Talk.content;

    function parseRecipient(context) {
        var elem = $(context).find('.speech-recipient');
        return {
            role_id: Number(elem.attr('data-role')),
            nickname: elem.find('.recipient-nickname').text()
        };
    }

    function getMessageData(speech) {
        return Talk.getData(function(message) {
            return message.node.parentNode === speech;
        });
    }

    function getRole(elem) {
        var role_id = Number(elem.getAttribute('data-role'));
        var role = role_id && Rooms.selected.rolesOnline.get(role_id);
        return role || getMessageData(elem.parentNode);
    }

    function replyPersonal(elem) {
        var role = getRole(elem);
        if (Rooms.selected.isMy(role)) {
            Room.replyPrivate(parseRecipient(elem));
        } else {
            Room.replyPrivate(role);
        }
    }

    function getMention(elem) {
        return {
            role_id: Number(elem.parentNode.getAttribute('data-role')),
            nickname: elem.textContent
        };
    }

    content.on('click', '.userpic', function(event) {
        event.stopPropagation();
        var role = getRole(this.parentNode);
        Profile.show(role, {
            nickname: $(this).next('.nickname').text(),
            target: this,
            inTalk: true
        });
    });

    content.on('click', '.nickname', function() {
        var speech = $(this).closest('.speech');
        if (speech.hasClass('personal')) {
            replyPersonal(this.parentNode);
        } else {
            Room.replyTo(getMention(this));
        }
    });

    content.on('click', '.speech-recipient', function() {
        replyPersonal(this.parentNode);
    });

    content.on('click', '.msg-edit', function() {
        Room.edit($(this).closest('.message'));
    });

    Room.editLast = function() {
        var icons = content.find('.msg-edit');
        if (icons.length) {
            Room.edit(icons.last().closest('.message'));
        }
    };

})();

// Sticky dates
(function() {

    var content = Talk.content.get(0);
    var value = $('.header-date-text');

    var dates = [];
    var min, max;

    function getTop(node) {
        return node.getBoundingClientRect().top
    }

    function updateDates(node) {
        var offset = getTop(content) - content.scrollTop - 6;
        dates = Talk.content.find('.date').map(function(i, node) {
            return {
                text: $(node).find('.date-text').text(),
                offset: i ? getTop(node) - offset : -Infinity
            };
        });
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
        var offset = content.scrollTop;
        if (offset < min || offset > max) {
            toggle(offset);
        }
    }

    Talk.reflowDates = function() {
        var active = dates.length > 1;
        updateDates();
        if (dates.length) {
            toggle(content.scrollTop);
        } else {
            value.text('Сегодня');
        }
        if (dates.length < 2 && active) {
            content.removeEventListener('scroll', check, false);
            window.removeEventListener('resize', updateDates);
        }
        if (dates.length > 1 && !active) {
            content.addEventListener('scroll', check, false);
            window.addEventListener('resize', updateDates);
        }
    };

})();

// Filter messages for me
(function() {

    var toolbar = $('.header-toolbar'),
        control = $('.filter-my');

    Rooms.on('selected.ready', function(room) {
        control.toggleClass('filter-my-selected', room.forMeOnly === true);
    });

    control.on('click', function() {
        if (toolbar.data('wasDragged')) return;
        var room = Rooms.selected;
        room.forMeOnly = !room.forMeOnly;
        Talk.forMeOnly = room.forMeOnly;
        control.toggleClass('filter-my-selected', Talk.forMeOnly);
        Talk.content.addClass('talk-loading');
        Talk.loadRecent();
    });

})();

// Notifications switch
(function() {

    var toolbar = $('.header-toolbar'),
        control = $('.toolbar-sound');

    if (!Rooms.soundEnabled) {
        control.hide();
        return false;
    }

    Rooms.on('selected.ready', function(room) {
        control.toggleClass('toolbar-sound-on', room.soundOn);
    });

    control.on('click', function() {
        if (toolbar.data('wasDragged')) return;
        var room = Rooms.selected;
        room.toggleSound();
        control.toggleClass('toolbar-sound-on', room.soundOn);
    });

})();

// Talk scrolling
(function() {

    var content = Talk.content.get(0);

    var scroller = $({}),
        interrupted,
        scrolling;

    function setPosition(value) {
        content.scrollTop = Math.round(value);
    }

    function getDuration(a, b) {
        return 300 + Math.abs(a - b) * 7;
    }

    function getMaxScroll() {
        return content.scrollHeight - content.offsetHeight - 1;
    }

    function isNear(element) {
        var et = element.getBoundingClientRect().top;
        var cb = content.getBoundingClientRect().bottom;
        return et - cb < 10;
    }

    function stopScrolling() {
        if (scrolling) {
            interrupted = true;
            scroller.stop(true);
            scrollEnd();
            interrupted = false;
        }
    }

    function scrollEnd() {
        scrolling = false;
        Talk.content.dequeue();
    }

    content.addEventListener('wheel', stopScrolling);
    content.addEventListener('touchstart', stopScrolling);

    Talk.scrollBy = function(shift) {
        content.scrollTop += shift;
    };

    Talk.restoreOffset = function(node, offset) {
        content.scrollTop += node.getBoundingClientRect().top - offset;
    };

    Talk.fixScroll = function() {
        if (!scrolling && content.scrollTop > getMaxScroll()) content.scrollTop--;
    };

    Talk.scrollQueue = function(callback) {
        this.content.queue(callback);
    };

    Talk.scrollAbove = function() {
        var cur = content.scrollTop;
        var pos = Math.max(0, cur - 150);
        scroller[0].position = cur;
        scroller.delay(150);
        scroller.animate({position: pos}, {
            duration: 400,
            step: setPosition
        });
    };

    Talk.scrollFurther = function(node) {
        this.content.queue(function(next) {
            var cur = content.scrollTop;
            var pos = getMaxScroll();
            if (pos > cur && !interrupted && node.parentNode && isNear(node)) {
                scrolling = true;
                scroller[0].position = cur;
                scroller.animate({position: pos}, {
                    complete: scrollEnd,
                    duration: getDuration(cur, pos),
                    step: setPosition
                });
            } else {
                next();
            }
        });
    };

    Talk.scrollDown = function() {
        content.scrollTop = getMaxScroll();
    };

})();
