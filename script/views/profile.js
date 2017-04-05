// Profile
(function() {

    var Profile = new Events();

    var $popup = $.popup('#profile');

    var $scroller = $popup.find('.popup-scroll');
    var $content = $popup.find('.popup-content');

    var $sections = $popup.find('.profile-section');

    var marginTop = 15;

    function getCenter(target) {
        var rect = target.getBoundingClientRect();
        return {
            top: Math.round((rect.top + rect.bottom) / 2),
            left: Math.round((rect.left + rect.right) / 2)
        };
    }

    function preloadPhoto(role) {
        if (role.photo) {
            var img = new Image();
            img.src = '/photos/' + role.photo;
            img.onload = function() {
                Profile.trigger('ready', role, img);
                Profile.fit();
            };
        } else {
            Profile.trigger('ready', role);
            Profile.fit();
        }
    }

    Profile.show = function(role, context, edit) {
        var me = Room.isMy(role);
        $sections.hide();
        Profile.role = role;
        Profile.socket = role;
        Profile.context = context;
        Profile.trigger(edit ? 'edit' : 'show', role, me);
        if (!context.nickname) {
            context.nickname = role.nickname;
        }
        if (context.target) {
            $.extend(context, getCenter(context.target[0] || context.target));
            $popup.css('left', Math.max(20, Profile.context.left - 160));
        }
        $popup.show();
        Profile.fit();
        if (role.message_id) {
            Rest.roles
                .get(role.role_id)
                .done(function(data) {
                    $.extend(role, data);
                    preloadPhoto(role);
                })
        } else {
            preloadPhoto(role);
        }
    };

    Profile.hide = function() {
        Profile.role = null;
        Profile.context = null;
        Profile.socket = null;
        $popup.hide();
    };

    Profile.fit = function() {
        if (!this.context.top) return;
        var wh = window.innerHeight;
        var ch = $content.height();
        var top = Math.min(this.context.top - 55, wh - ch - 25);
        if (top < 15) {
            $popup.css('top', 15);
            $scroller.height(wh - 20).scrollTop(15 - top);
        } else {
            $popup.css('top', top);
            $scroller.height('');
        }
    };

    Profile.edit = function(target) {
        if (target) {
            this.show(Room.myRole, {target: target}, true);
        } else {
            $sections.hide();
            this.trigger('edit', Room.myRole, true);
            this.fit();
        }
    };

    function updateRole(data) {
        $.extend(Profile.role, data);
        Profile.trigger('role.updated', data);
    }

    function updateByRole(data) {
        if (Profile.role && Profile.role.role_id === data.role_id) {
            updateRole(data);
        }
    }

    function updateByUser(data) {
        if (Profile.role && Profile.role.user_id === data.user_id) {
            if (data.photo) {
                $.extend(Profile.role, data);
                preloadPhoto(Profile.role);
            } else {
                updateRole(data);
            }
        }
    }

    $content.find('.profile-close').on('click', function() {
        Profile.hide();
    });

    Socket.on('role.nickname.updated', updateByRole);
    Socket.on('role.status.updated', updateByRole);

    Socket.on('user.photo.updated', updateByUser);
    Socket.on('user.userpic.updated', updateByUser);

    Room.on('leave', function() {
        Profile.hide();
    });

    window.Profile = Profile;

})();

/* Role details */
(function() {

    var $section = $('#profile-view');

    var $social = $section.find('.profile-social'),
        $photo = $section.find('.profile-photo'),
        $userpic = $section.find('.profile-userpic'),
        $nickname = $section.find('.profile-nickname'),
        $status = $section.find('.profile-status');

    var socialType = /facebook|vk|ok/;
    var socialTitles = {
        facebook: 'Профиль в Фейсбуке',
        vk: 'Профиль Вконтакте',
        ok: 'Профиль в Одноклассниках'
    };

    function matchTitle(url) {
        var match = url.match(socialType);
        if (match) {
            return socialTitles[match[0]];
        }
    }

    function formatStatus() {

    }

    function showRole(role) {
        $userpic.css('background-image', 'url(' + Userpics.getUrl(role) + ')').show();
        $nickname.text(role.nickname);
        if (role.status) {
            $status.html(Room.formatStatus(role.status)).show();
        } else {
            $status.hide().text('');
        }
        if (role.profile_url && Room.myRole.user_id) {
            $social.attr('href', role.profile_url);
            $social.attr('title', matchTitle(role.profile_url));
            $social.show();
        } else {
            $social.hide();
        }
    }

    Profile.on('show', function(role, isMy) {
        $photo.hide().text('');
        showRole(role);
        $section.show();
    });

    Profile.on('ready', function(role, photoElem) {
        showRole(role);
        if (photoElem) {
            photoElem.className = 'profile-photo-img';
            $userpic.hide();
            $photo.text('').append(photoElem).show();
        }
    });

    Profile.on('role.updated', function(role) {
        showRole(Profile.role);
    });

})();

// Actions
(function() {

    var $section = $('#profile-view');

    var $actions = $section.find('.profile-actions'),
        $ignore  = $section.find('.profile-ignore'),
        $ignored = $section.find('.profile-ignored');
        $edit    = $section.find('.profile-edit-button');

    var ignoreDisabled = false;
    var $ignoreIcon = $actions.find('.profile-ignore-icon');

    var ignoreTitles = [
        'У модераторов нет личного игнора',
        'Скрыть во всех комнатах…'
    ];

    function toggleIgnored(ignored) {
        $actions.toggle(!ignored);
        $ignored.toggle(ignored);
        $ignore.hide();
    }

    function showIgnored() {
        toggleIgnored(true);
    }

    function showActions() {
        toggleIgnored(false);
    }

    function updateIgnores(action, role) {
        var ignores = {};
        if (role.user_id) {
            ignores[action + '_user_id'] = role.user_id;
        } else {
            ignores[action + '_session_id'] = role.session_id;
        }
        return Rest.sessions.update('me', {ignores: ignores});
    }

    function isIgnored() {
        return Room.ignores ? Room.ignores(Profile.role) : false;
    }

    $actions.find('.profile-private').on('click', function() {
        Room.replyPrivate(Profile.role);
        Profile.hide();
    });

    $ignoreIcon.on('click', function() {
        if (ignoreDisabled) return false;
        $actions.hide();
        $ignore.find('.nickname').text(Profile.role.nickname);
        $ignore.show();
        Profile.fit();
    });

    $ignore.find('button').on('click', function() {
        updateIgnores('add', Profile.role).then(showIgnored);
    });

    $ignored.find('.profile-ignored-cancel').on('click', function() {
        updateIgnores('delete', Profile.role).then(showActions);
    });

    $edit.on('click', function() {
        Profile.edit();
    });

    Room.on('moderator.changed', function(isModerator) {
        ignoreDisabled = isModerator;
        $ignoreIcon.toggleClass('profile-ignore-disabled', ignoreDisabled);
        $ignoreIcon.attr('title', ignoreTitles[ignoreDisabled ? 0 : 1]);
        if (Profile.socket) {
            toggleIgnored(!isModerator && isIgnored());
        }
    });

    Room.on('user.ignores.updated', function() {
        if (Profile.role) {
            toggleIgnored(isIgnored());
        }
    });

    Profile.on('show', function(role, isMy) {
        toggleIgnored(isMy ? false : isIgnored());
        if (isMy) {
            toggleIgnored(false);
            $actions.hide();
        }
        $edit.toggle(isMy);
    });

})();

/* Edit nickname and status */
(function() {

    var form = $('#profile-edit');
    var nickname = $('#my-nickname');
    var status = $('#my-status');

    var photo = form.find('.my-photo');
    var login = /(facebook|vk|ok)/;

    var roomUrl = /http\S+talkrooms.ru\/(#[\w\-+]+)/;

    function getValues() {
        var values = {};
        addChanged(values, nickname, 'nickname');
        addChanged(values, status, 'status');
        if (values.status) {
            values.status = values.status.replace(roomUrl, '$1');
        }
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
            Rest.roles.update(Room.myRole.role_id, values).done(Profile.hide);
        }
    });

    Profile.on('edit', function() {
        var data = Room.myRole;
        nickname.val(data.nickname);
        status.val(data.status);
        if (data.profile_url) {
            photo.find('a').attr('href', '/api/login/' + data.profile_url.match(login)[1]);
            photo.css('background-image', data.photo ? String.mix('url("/photos/$1")', data.photo) : '');
            photo.show();
        } else {
            photo.hide();
        }
        form.show();
    });

})();

/* Login and logout */
(function() {

    var login = $('#profile-login'),
        logout = $('#profile-logout');

    Profile.on('edit', function() {
        (Room.myRole.user_id ? logout : login).show();
    });

})();
