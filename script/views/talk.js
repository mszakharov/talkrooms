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
        return recent[this.daysAgo()] || this.toHumanDate();
    };

    Date.prototype.daysAgo = function() {
        return Math.floor((tonight - this.getTime()) / day);
    };

    function update() {
        var now = Date.now();
        if (now > tonight) {
            tonight = (new Date).setHours(24, 0, 0, 0) - 1;
            $window.trigger('date.changed');
        }
        clearTimeout(timer);
        timer = setTimeout(update, tonight - now + 1000);
    }

    // Reset timer after sleep mode
    Room.on('connected', update);

    update();

})();

// Entry overlay
(function() {

    var overlay = $('.room-entry');
    var sections = overlay.children();

    function showSection(selector) {
        sections.hide();
        overlay.find(selector).show();
        overlay.show();
    }

    Room.on('ready', function() {
        overlay.fadeOut(150);
    });

    Room.on('leave', function() {
        sections.hide();
        overlay.show();
    });

    Room.on('lost', function() {
        showSection('.entry-lost');
    });

    Room.on('locked', function(wait) {
        showSection(wait ? '.entry-wait' : '.entry-login');
    });

    Room.on('closed', function(wait) {
        showSection('.entry-closed');
    });

    Room.on('deleted', function() {
        overlay.find('.entry-deleted h6').text('Комната «' + Room.data.topic + '» удалена');
        showSection('.entry-deleted');
    });

    Room.on('error', function(text) {
        var hint = overlay.find('.entry-error .hint');
        if (text) {
            hint.html(text).show();
        } else {
            hint.empty().hide();
        }
        showSection('.entry-error');
    });

    var back = overlay.find('.entry-back');

    function shuffleRoom() {
        Room.shuffle().fail(shuffleFailed);
    }

    function shuffleFailed() {
        back.toggle(Boolean(Room.socket));
        showSection('.search-failed');
    }

    back.find('.link').on('click', function() {
        overlay.hide();
    });

    overlay.find('.entry-search').on('click', shuffleRoom);

    $('.room-shuffle').on('click', shuffleRoom);

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
        s = s.replace(/(^|\s)(#[\w\-+]+)\b/g, '$1<a href="/$2" target="_blank">$2</a>');
    }
    return s.replace(/\n/g, '<br>');
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
            $(day.node).find('date-text').text(title);
            day.title = title;
        }
    }

    Talk.getDate = function(str) {
        return index[str] || createDay(str);
    };

    // Update dates after midnight
    $window.on('date.changed', function() {
        dates.forEach(updateTitle);
        Room.trigger('dates.changed');
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
        if (Room.socket.role_id === data.role_id) {
            if (created.daysAgo() < 2) {
                message.find('.msg-text').append(edit.cloneNode(true));
            }
        } else if (!data.recipient_role_id && Talk.isForMe(data.content)) {
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
                nickname: recipient_id === Room.socket.role_id ? 'я' : data.recipient_nickname
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
        if (oneSpeech(m1, m2)) {
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
        return new Message(data);
    };

    Talk.Section = Section;

})();

// Sections
(function() {

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
        if (Room.isMy(data)) {
            return true;
        }
        if (Room.ignores && Room.ignores(data)) {
            return false;
        }
        if (data.ignore && !Room.socket.ignored) {
            return false;
        }
        if (Talk.forMeOnly) {
            return data.recipient_nickname || Talk.isForMe(data.content);
        }
        return true;
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

    function togglePrevious(messages) {
        previous.toggle(messages.length === 150);
        return messages.reverse();
    }

    function useIgnores(messages) {
        return Room.ignores ? messages.filter(notAnnoying) : messages;
    }

    function notAnnoying(message) {
        return !Room.ignores(message);
    }

    function showRecent(messages) {
        toggleArchive(false);
        archive.reset([]);
        current.reset(messages.map(Talk.createMessage));
        current.setLast();
        $window.scrollTop($document.height() - $window.height() - 1);
        Room.trigger('dates.changed');
    }

    function updateSections(action, data, anchor) {
        var offset = anchor.getBoundingClientRect().top;
        action(data);
        Room.trigger('dates.changed');
        $window.scrollTop($(anchor).offset().top - offset);
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
            $window.scrollTop($(cut.node).offset().top - offset);
        }
        Room.trigger('dates.changed');
        next();
    }

    function cleanDates() {
        Talk.container
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
        var offset = $document.height() - $window.scrollTop();
        archive.setIgnore(ignore, isVisible);
        current.setIgnore(ignore, isVisible);
        current.setLast();
        cleanDates();
        Room.trigger('dates.changed');
        $window.scrollTop($document.height() - offset);
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

    Room.on('enter', function() {
        Talk.forMeOnly = false;
        Room.promises.push(Talk.loadRecent());
    });

    Room.on('message.created', function(data) {
        if (isVisible(data) && data.message_id > current.last.data.message_id) {
            var message = Talk.createMessage(data);
            message.appendTo(current.container, current.last);
            current.messages.push(message);
            if (message.date !==  current.last.date) {
                Room.trigger('dates.changed');
            }
            current.setLast(message);
            if (current.messages.length > current.capacity + current.overflow) {
                $window.queue(trimCurrent);
            }
            Talk.scrollDown(message.node);
            Room.trigger('talk.updated');
        }
    });

    Room.on('message.content.updated', function(data) {
        var updated = Talk.find(function(message) {
            return data.message_id === message.data.message_id;
        });
        if (updated) {
            var text = $(updated.node).find('.msg-text');
            var edit = text.find('.msg-edit').detach();
            text.html(Talk.format(data.content) || '…').append(edit);
            updated.data.content = data.content;
            Room.trigger('dates.changed'); // because of new message height
        }
    });

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
        Room.trigger('dates.changed');
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
            archive.shift();
        }
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
        loading.removeClass('loading');
        loading = null;
    }

    function initNavigation(elem, load) {
        elem.find('.talk-load').on('click', function() {
            if (!loading) {
                loading = elem.addClass('loading');
                load().always(loaded);
            }
        });
    }

    initNavigation(previous, function() {
        var first = (archive.messages.length ? archive : current).messages[0];
        var offset = first.node.getBoundingClientRect().top;
        return loadBefore(first)
            .then(togglePrevious)
            .then(useIgnores)
            .done(function(data) {
                showPrevious(data);
                $window.scrollTop($(first.node).offset().top - offset);
                $window.delay(150).scrollTo(function(now) {
                    return now - 150;
                }, 400);
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

    // Remove obsolete edit icons
    $window.on('date.changed', function() {
        var editAfter = (new Date).setHours(0, 0, 0, 0) - (24 * 60 * 60 * 1000);
        current.messages.forEach(function(message) {
            if (Room.isMy(message.data) && message.timestamp < editAfter) {
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
        $window.queue(function(next) {
            Talk.updateIgnore(ignore);
            ignore = {};
            next();
        });
    }

    Room.on('message.ignore.updated', function(data) {
        ignore[data.message_id] = data.ignore;
        timer = setTimeout(setIgnore, 50);
    });

})();

// Apply ignores
Room.on('user.ignores.updated', function() {
    Talk.loadRecent();
});

// User actions
(function() {

    var container = Talk.container;

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
        var role = role_id && Room.users.get(role_id);
        return role || getMessageData(elem.parentNode);
    }

    function replyPersonal(elem) {
        var role = getRole(elem);
        if (Room.isMy(role)) {
            Room.replyPrivate(parseRecipient(elem));
        } else {
            Room.replyPrivate(role);
        }
    }

    container.on('click', '.userpic', function(event) {
        event.stopPropagation();
        var role = getRole(this.parentNode);
        Profile.show(role, this);
    });

    container.on('click', '.nickname', function() {
        var speech = $(this).closest('.speech');
        if (speech.hasClass('personal')) {
            replyPersonal(this.parentNode);
        } else {
            var nickname = this.textContent;
            if (nickname !== Room.socket.nickname) {
                Room.replyTo(nickname);
            } else {
                Room.replyTo();
            }
        }
    });

    container.on('click', '.speech-recipient', function() {
        replyPersonal(this.parentNode);
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
