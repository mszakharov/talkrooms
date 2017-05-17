(function() {

    var toolbar = $('.header-toolbar'),
        icon = $('.toolbar-settings');

    var form = $.popup('#room-settings', function() {
        form.find('.error').remove();
        submit.prop('disabled', false);
        toggleControls(Rooms.selected);
        this.fadeIn(120);
        fitPopup();
    });

    var scroller = form.find('.popup-scroll');
    var content = form.find('.popup-content');

    function fitPopup() {
        var wh = window.innerHeight;
        var ch = content.height();
        if (ch > wh - 45) {
            form.css('top', 15);
            scroller.height(wh - 20).scrollTop(0);
        } else {
            form.css('top', '');
            scroller.height('');
        }
    }

    function toggleControls(room) {
        var myRole = room.myRole;
        var isCreator = myRole.level === 80;
        if (myRole.isAdmin) {
            setAdminValues(room.data, isCreator);
        }
        toggleAlarm(room.data.level === 0);
        showAlarm(Boolean(room.data.min_session_created));
        toggleRemove(room.data.level === 80);
        hash.parent().toggle(Boolean(isCreator && myRole.user_id));
        closed.toggle(isCreator);
    }

    function setAdminValues(data, isCreator) {
        form.find('.settings-login').toggle(!Me.authorized && isCreator);
        topic.val(data.topic);
        hash.val(data.hash).removeClass('invalid');
        searchable.prop('checked', data.searchable);
        watched.prop('checked', data.watched);
        levels.filter('[value="' + data.level + '"]').prop('checked', true);
        toggleSearchable(data.level < 20);
    }

    function validateHash(value, full) {
        if (/[^a-zA-Z\d\-+]/.test(value)) return false;
        if (full && value.length < 3) return false;
        if (value.length > 32) return false;
        return true;
    }

    var topic = $('#edit-room-topic');
    topic.on('change', function() {
        this.value = this.value.trim();
    });

    var hash = $('#edit-room-hash');
    hash.on('input', function() {
        hash.toggleClass('invalid', !validateHash(this.value));
    });
    hash.on('change', function() {
        var value = this.value.trim();
        var valid = validateHash(value, true);
        hash.toggleClass('invalid', !valid);
        this.value = value;
    });

    var searchable = $('#edit-room-searchable'),
        watched = $('#edit-room-watched');

    function toggleSearchable(visible) {
        searchable.closest('.section').toggle(visible);
    }

    var levels = form.find('.room-levels input');
    var closed = levels.filter('[value="80"]').closest('.checkbox');

    levels.on('click', function() {
        var level = Number(this.value);
        toggleAlarm(level === 0);
        toggleSearchable(level < 20);
        toggleRemove(level === 80);
    });

    var submit = form.find('button[type="submit"]');

    icon.on('click', function() {
        if (!toolbar.data('wasDragged')) form.show();
    });

    form.on('submit', function(event) {
        event.preventDefault();
        if (!Rooms.selected.myRole.isAdmin) {
            form.hide();
        } else if (!submit.prop('disabled')) {
            updateRoom(Rooms.selected);
        }
    });

    function filterChanged(current, data) {
        var empty = true;
        var changed = {};
        for (var key in data) {
            var value = data[key];
            if (value !== current[key]) {
                changed[key] = value;
                empty = false;
            }
        }
        if (!empty) {
            return changed;
        }
    }

    function updateRoom(room) {
        var data = filterChanged(room.data, {
            topic: topic.val(),
            hash: hash.val(),
            searchable: searchable.prop('checked') ? 1 : 0,
            watched: watched.prop('checked') ? 1 : 0,
            level: Number(levels.filter(':checked').attr('value') || Room.data.level)
        });
        if (!data) {
            form.hide();
        } else if (data.topic === '') {
            topic.val().focus();
        } else if (data.hash && !validateHash(data.hash, true)) {
            hash.focus();
        } else {
            submit.prop('disabled', true);
            Rest.rooms
                .update(room.data.hash, data)
                .always(function() {
                    submit.prop('disabled', false);
                })
                .done(function() {
                    form.hide();
                })
                .fail(showError);
        }
    }

    function showError(error) {
        if (error.status === 409) {
            var context = hash.parent();
            context.append('<p class="error">Увы, этот адрес уже занят, выберите другой</p>');
            hash.one('input', function() {
                context.find('.error').remove();
            });
        }
    }

    var alarmOff = form.find('.alarm-off');
    var alarmOn = form.find('.alarm-on');
    var alarmTime = alarmOn.find('.alarm-time');

    function toggleAlarm(visible) {
        alarmOff.parent().toggle(visible);
    }

    function getHumanTime(iso) {
        return iso ? 'с ' + (new Date(iso)).toHumanTime() : '';
    }

    function showAlarm(on) {
        alarmOff.toggle(!on);
        alarmOn.toggle(on);
        if (on) {
            alarmOn.find('.alarm-time').text(getHumanTime(Room.data.min_session_created));
        }
    }

    function showAlarmOn() {
        showAlarm(true);
    }

    function showAlarmOff() {
        showAlarm(false);
    }

    function setAlarm(on) {
        return Rest.rooms.update(Room.data.hash, {
            min_session_created: on
        });
    }

    alarmOff.find('.button').on('click', function() {
        setAlarm(true).done(showAlarmOn);
    });

    alarmOn.find('.alarm-cancel').on('click', function() {
        setAlarm(false).done(showAlarmOff);
    });

    var remove = content.find('.room-remove');
    remove.find('.link').on('click', function() {
        Rest.rooms.update(Room.data.hash, {deleted: true});
    });

    function toggleRemove(visible) {
        remove.toggle(visible && Room.myRole.level === 80);
    }

    function toggleSettings(room) {
        var me = room.myRole;
        console.log(me);
        var enabled = Boolean(me.isAdmin || (me.isModerator && room.data.level === 0));
        icon.toggle(enabled);
        if (!enabled) form.hide();
    }

    function toggleAdminSections() {
        var room = Rooms.selected;
        form.find('.admin-sections').toggle(room.myRole.isAdmin);
        if (room.myRole.isAdmin) {
            setAdminValues(room.data);
        }
    }

    Room.on('admin.changed', function() {
        toggleAdminSections();
        toggleSettings();
    });

    Room.on('room.min_session_created.updated', function() {
        if (Room.moderator) showAlarm(Boolean(Room.data.min_session_created));
    });

    Room.on('room.level.updated', function() {
        if (Room.moderator) toggleSettings();
    });

    Room.on('moderator.changed', toggleSettings);

    function hide() {
        form.hide();
    }

    Rooms.on('select', hide);

    toggleAdminSections();
    toggleSettings(Rooms.selected);

})();

// Restore deleted room
$('.entry-restore').on('click', function() {
    var hash = Room.data.hash;
    Rest.rooms
        .update(hash, {deleted: false})
        .done(function() {
            Room.enter(hash);
        })
        .fail(function() {
            Room.leave();
            Room.trigger('lost');
            alert('Восстановление уже невозможно');
        });
});
