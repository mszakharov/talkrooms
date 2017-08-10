// Settings popup
(function() {

    var Settings = {};

    var toolbar = $('.header-toolbar'),
        icon = $('.toolbar-settings');

    var popup = $.popup('#room-settings', function() {
        this.fadeIn(120);
        fitPopup();
    });

    var scroller = popup.find('.popup-scroll');
    var content = popup.find('.popup-content');

    function fitPopup() {
        var wh = window.innerHeight;
        var ch = content.height();
        if (ch > wh - 45) {
            popup.css('top', 15);
            scroller.height(wh - 20).scrollTop(0);
        } else {
            popup.css('top', '');
            scroller.height('');
        }
    }

    function hidePopup() {
        popup.hide();
    }

    icon.on('click', function() {
        if (!toolbar.data('wasDragged')) popup.show();
    });

    Rooms.on('select', hidePopup);
    Rooms.on('explore', hidePopup);

    Settings.hide = function() {
        popup.hide();
    };

    Settings.find = function(selector) {
        return content.find(selector);
    };

    window.Settings = Settings;

})();

// New message sound
(function() {

    var sound,
        soundEnabled;

    var $sound = $('#unread-sound');

    // Disable sound on mobile devices because of audio limitations
    if (/android|blackberry|iphone|ipad|ipod|mini|mobile/i.test(navigator.userAgent)) {
        $sound.closest('.settings-section').hide();
        return false;
    }

    function toggleSound(enabled) {
        if (enabled === soundEnabled) return;
        if (enabled) {
            if (!sound) sound = new Sound({
                mp3: '/script/sound/message.mp3',
                ogg: '/script/sound/message.ogg'
            });
            //Room.on('talk.updated', notify);
            $sound.prop('checked', true);
        } else {
            //Room.off('talk.updated', notify);
            $sound.prop('checked', false);
        }
        soundEnabled = enabled;
    }

    function notify() {
        if (Room.idle) sound.play();
    }

    Rooms.on('select', function(room) {
        if (room.data.room_id) {
            var stored = localStorage.getItem('sound_in_' + room.data.room_id);
            toggleSound(Boolean(stored));
        }
    });

    $sound.on('click', function() {
        toggleSound(this.checked);
        if (soundEnabled) {
            localStorage.setItem('sound_in_' + Room.data.room_id, 1);
        } else {
            localStorage.removeItem('sound_in_' + Room.data.room_id);
        }
    });

})();
