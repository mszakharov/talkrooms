// Profile
(function() {

    var sections = [];

    var popup = $.popup('#profile', function() {
        this.fadeIn(100);
    });

    function Section(selector, callback) {
        this.elem = $(selector);
        this.callback = callback;
    }

    Section.prototype.toggle = function(socket, me) {
        if (this.callback(socket, me)) {
            this.elem.show();
        } else {
            this.elem.hide();
        }
    };

    function isMySocket(socket) {
        var uid = Room.socket.user_id;
        return uid ? (socket.user_id === uid) : (Room.socket.socket_id === socket.socket_id);
    }

    function show(socket_id, target) {
        var socket = Room.users.get(Number(socket_id));
        var me = isMySocket(socket);
        sections.forEach(function(section) {
            section.toggle(socket, me);
        });
        if (target) {
            var position = $(target).position();
            Profile.position = {
                top: position.top - 10,
                left: position.left > 20 ? position.left : 20
            };
            Profile.fit();
        }
        if (socket.user_id) {
            Rest.roles.get(Room.data.room_id + '/' + socket.user_id).done(loaded);
        }
        Profile.socket = socket;
        popup.show();
    }

    function loaded(data) {
        Profile.trigger('loaded', data);
    }

    function hide() {
        Profile.socket = null;
        popup.hide();
    }

    function updateIndexes() {
        var nodes = popup.find('.section').get();
        for (var i = nodes.length; i--;) {
            nodes[i].style.zIndex = nodes.length - i;
        }
    }

    updateIndexes();

    window.Profile = Events.mixin({
        sections: sections,
        add: function(selector, toggle) {
            sections.push(new Section(selector, toggle));
        },
        fit: function() {
            var wh = $window.height();
            var ph = popup.height();
            popup.css({
                top: Math.min(this.position.top, wh - ph - 20),
                left: this.position.left
            });
        },
        show: show,
        hide: hide
    });

})();

/* Edit nickname */
(function() {

    var field = $('#my-nickname');

    $('#profile-edit').on('submit', function(event) {
        event.preventDefault();
        var value = $.trim(field.val());
        if (value) {
            Rest.sockets.update(Room.socket.socket_id, {nickname: value}).done(Profile.hide);
        }
    });

    Profile.add('#profile-edit', function(socket) {
        if (Room.socket.socket_id === socket.socket_id) {
            field.val('').focus();
            field.val(socket.nickname);
            return true;
        } else {
            return false;
        }
    });

})();

/* User details */
(function() {

    var section = $('#profile-details');

    var types = /(facebook|vk|ok)/;
    var titles = {
        facebook: 'Профиль в Фейсбуке',
        vk: 'Профиль Вконтакте',
        ok: 'Профиль в Одноклассниках'
    };

    var link = '<a href="$1" target="_blank">$2</a>';
    function renderLink(url) {
        var type = url.match(types)[1];
        return String.mix(link, url, titles[type]);
    }

    Profile.add(section, function(socket, me) {
        if (me) return false;
        section.find('.details-nickname').html(socket.nickname);
        section.find('.details-link').html(socket.profile_url ? '…' : 'Без авторизации');
        section.find('.details-photo').remove();
        return true;
    });

    Profile.on('loaded', function(data) {
        if (section.is(':visible')) {
            section.find('.details-link').html(renderLink(data.profile_url));
            if (data.photo) {
                $('<img/>')
                    .addClass('details-photo')
                    .attr('src', '/photos/' + data.photo)
                    .prependTo(section)
                    .on('load', function() {
                        Profile.fit();
                    });
                Profile.fit();
            }
        }
    });

    Room.on('socket.nickname.updated', function(socket) {
        if (socket.socket_id === Profile.socket.socket_id) {
            section.find('.details-nickname').html(socket.nickname);
        }
    });

})();

/* Ignore */
(function() {

    var myLevel = 0;
    var section = $('#profile-ignore');

    var ignoreOn = section.find('.ignore-on'),
        ignoreOff = section.find('.ignore-off');

    function toggleControls(socket) {
        if (socket.ignore) showOn(); else showOff();
    }

    function showOn() {
        ignoreOff.hide();
        ignoreOn.show();
    }

    function showOff() {
        ignoreOn.hide();
        ignoreOff.show();
    }

    function isCurrent(socket) {
        return socket.socket_id === Profile.socket.socket_id;
    }

    Room.on('role.updated', function(role) {
        myLevel = role ? role.level : 0;
    });

    Room.on('socket.ignore.updated', function(socket) {
        if (isCurrent(socket)) {
            if (socket.ignore && ignoreOff.is(':visible')) showOn();
            if (!socket.ignore && ignoreOn.is(':visible')) showOff();
        }
    });

    Profile.add(section, function(socket, me) {
        if (myLevel >= 50 && !me) {
            section.children().hide();
            if (!socket.user_id) {
                toggleControls(socket);
            }
            return true;
        } else {
            return false;
        }
    });

    Profile.on('loaded', function(data) {
        if (section.is(':hidden')) return;
        if (data.level >= myLevel) {
            section.find('.ignore-denied').show();
        } else {
            toggleControls(Profile.socket);
        }
        Profile.fit();
    });

    function setIgnore(value) {
        return Rest.sockets.update(Profile.socket.socket_id, {ignore: value});
    }

    ignoreOff.find('button').on('click', function() {
        setIgnore(true).done(showOn);
    });

    ignoreOn.find('button').on('click', function() {
        setIgnore(false).done(showOff);
    });

})();

/* Login and logout */
Profile.add('#profile-login', function(socket, me) {
    return me && !Room.socket.user_id;
});
Profile.add('#profile-logout', function(socket, me) {
    return me && Room.socket.user_id;
});