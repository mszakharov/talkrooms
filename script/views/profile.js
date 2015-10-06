// Profile
(function() {

    var popup = $.popup('#profile', function() {
        this.fadeIn(120);
    });

    function show(socket, target, edit) {
        var me = Room.isMy(socket);
        popup.find('.section').hide();
        Profile.socket = socket;
        Profile.target = target && $(target);
        Profile.trigger(edit ? 'edit' : 'show', socket, me);
        if (Profile.target) {
            var position = Profile.target.offset();
            Profile.position = {
                top: position.top - 16 - $window.scrollTop(),
                left: position.left > 40 ? position.left - 20 : 20
            };
            Profile.fit();
        }
        popup.show();
        if (socket.user_id && !socket.socket_id) {
            Rest.roles
                .get(Room.data.room_id, socket.user_id)
                .done(function(data) {
                    $.extend(socket, data);
                    preloadPhoto(socket);
                })
        } else {
            preloadPhoto(socket);
        }
    }

    function preloadPhoto(data) {
        if (data.photo) {
            var img = new Image();
            img.src = '/photos/' + data.photo;
            img.onload = function() {
                Profile.trigger('ready', data, img);
            };
        } else {
            Profile.trigger('ready', data);
        }
    }

    function hide() {
        Profile.target = null;
        Profile.socket = null;
        Profile.tole = null;
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
        fit: function() {
            var wh = $window.height();
            var ph = popup.height();
            popup.css({
                top: Math.min(this.position.top, wh - ph - 20),
                left: this.position.left
            });
        },
        edit: function(target) {
            if (target) {
                this.show(Room.socket, target, true);
            } else {
                popup.find('.section').hide();
                this.trigger('edit', Room.socket, true);
            }
        },
        show: show,
        hide: hide
    });

})();

/* Edit nickname and status */
(function() {

    var form = $('#profile-edit');
    var nickname = $('#my-nickname');
    var status = $('#my-status');

    function getValues() {
        var values = {};
        addChanged(values, nickname, 'nickname');
        addChanged(values, status, 'status');
        return values;
    }

    function addChanged(values, field, name) {
        var value = $.trim(field.val());
        if (value !== Profile.socket[name]) {
            if (value || name === 'status') values[name] = value;
        }
    }

    form.on('submit', function(event) {
        event.preventDefault();
        var values = getValues();
        if ($.isEmptyObject(values)) {
            Profile.hide();
        } else {
            Rest.sockets.update(Room.socket.socket_id, values).done(Profile.hide);
        }
    });

    Profile.on('edit', function() {
        nickname.val(Room.socket.nickname);
        status.val(Room.socket.status);
        form.show();
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

    var edit = section.find('.details-edit');
    edit.on('click', function() {
        Profile.edit();
    });

    var sendPrivate = section.find('.details-private');
    sendPrivate.on('click', function() {
        Room.replyPrivate(Profile.socket);
        Profile.hide();
    });

    var link = '<a href="$1" target="_blank">$2</a>';
    function renderLink(url) {
        var type = url.match(types)[1];
        return String.mix(link, url, titles[type]);
    }

    Profile.on('show', function(socket, me) {
        edit.toggle(me);
        sendPrivate.toggle((socket.user_id || socket.session_id) && !me);
        section.addClass('no-photo');
        section.find('.details-userpic').css('background-image', 'url(' + Userpics.getUrl(socket) + ')');
        section.find('.details-nickname').html(socket.nickname);
        var profileText;
        if (Room.socket.user_id) {
            profileText = socket.user_id ? 'загрузка профиля…' : 'без профиля';
        }
        section.find('.details-link').html(profileText || '&nbsp;');
        section.find('.details-photo').remove();
        section.show();
    });

    Profile.on('ready', function(data, photo) {
        if (section.is(':visible')) {
            if (data.profile_url && Room.socket.profile_url) {
                section.find('.details-link').html(renderLink(data.profile_url));
            }
            if (photo) {
                section.removeClass('no-photo');
                $(photo).addClass('details-photo').prependTo(section);
                Profile.fit();
            }
        }
    });

    Room.on('socket.nickname.updated', function(socket) {
        if (Profile.socket && socket.socket_id === Profile.socket.socket_id) {
            section.find('.details-nickname').html(socket.nickname);
        }
    });

})();

/* Moderate */
Room.loadForLevel(50, 'views/moderate.js');

/* Login and logout */
(function() {

    var login = $('#profile-login'),
        logout = $('#profile-logout');

    Profile.on('edit', function() {
        (Room.socket.user_id ? logout : login).show();
    });

})();
