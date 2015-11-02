(function() {

    var icon = $('.room-settings-icon');
    var form = $.popup('#room-settings', function() {
        form.find('.error').remove();
        if (Room.admin) {
            topic.val(Room.data.topic);
            hash.val(Room.data.hash).removeClass('invalid');
            searchable.prop('checked', Room.data.searchable);
            levels.filter('[value="' + Room.data.level + '"]').prop('checked', true);
            toggleAlarm(Room.data.level === 0);
        }
        showAlarm(Boolean(Room.data.min_session_created));
        submit.prop('disabled', false);
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

    var searchable = $('#edit-room-searchable');

    var levels = form.find('.room-levels input');

    levels.on('click', function() {
        toggleAlarm(this.value === '0');
    });

    var submit = form.find('button[type="submit"]');

    icon.on('click', function() {
        form.show();
    });

    form.on('submit', function(event) {
        event.preventDefault();
        if (!Room.admin) {
            form.hide();
        } else if (!submit.prop('disabled')) {
            updateRoom();
        }
    });

    function filterChanged(data) {
        var empty = true;
        var changed = {};
        for (var key in data) {
            var value = data[key];
            if (value !== Room.data[key]) {
                changed[key] = value;
                empty = false;
            }
        }
        if (!empty) {
            return changed;
        }
    }

    function updateRoom() {
        var data = filterChanged({
            topic: topic.val(),
            hash: hash.val(),
            searchable: searchable.prop('checked') ? 1 : 0,
            level: Number(form[0]['room-level'].value)
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
                .update(Room.data.hash, data)
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

    function toggleSettings() {
        var enabled = Boolean(Room.admin || (Room.moderator && Room.data.level === 0));
        icon.toggle(enabled);
        if (!enabled) form.hide();
    }

    function toggleAdminSections() {
        form.find('.admin-sections').toggle(Room.admin === true);
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

    Room.on('leave', function() {
        form.hide();
    });

    toggleAdminSections();
    toggleSettings();

})();
