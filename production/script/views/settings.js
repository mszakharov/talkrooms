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

// Unread messages
(function() {

    var $options = $('#settings-subscription').find('input[name="unread-notification"]');

    $options.on('click', function() {
        var room = Rooms.selected;
        var key = 'filter_unread_in_' + room.data.room_id;
        if (this.value === 'me') {
            localStorage.setItem(key, 1);
            room.filterUnread = true;
        } else {
            localStorage.removeItem(key);
            room.filterUnread = false;
        }
    });

    Rooms.on('selected.ready', function(room) {
        $options.eq(room.filterUnread ? 1 : 0).prop('checked', true);
    });

    Rooms.on('subscribed', function(room) {
        var stored = localStorage.getItem('filter_unread_in_' + room.data.room_id);
        room.filterUnread = Boolean(stored);
    });

})();

// New message sound
(function() {

    var sound;

    var $sound = $('#unread-sound');

    // Disable sound on mobile devices because of audio limitations
    if (/android|blackberry|iphone|ipad|ipod|mini|mobile/i.test(navigator.userAgent)) {
        $sound.closest('.settings-section').hide();
        return false;
    }

    function loadSound(enabled) {
        if (!sound) sound = new Sound({
            mp3: '/script/sound/message.mp3',
            ogg: '/script/sound/message.ogg'
        });
    }

    Rooms.on('selected.ready', function(room) {
        $sound.prop('checked', room.soundEnabled);
    });

    Rooms.on('subscribed', function(room) {
        var stored = localStorage.setItem('sound_in_' + room.data.room_id, 1);
        room.soundEnabled = Boolean(stored);
        if (room.soundEnabled) {
            loadSound();
        }
    });

    Rooms.on('notification', function(room) {
        if (room.soundEnabled && Rooms.idle) {
            sound.play();
        }
    });

    $sound.on('click', function() {
        var room = Rooms.selected;
        room.soundEnabled = this.checked;
        if (this.checked) {
            loadSound();
            localStorage.setItem('sound_in_' + room.data.room_id, 1);
            sound.play(); // Sound demo
        } else {
            localStorage.removeItem('sound_in_' + room.data.room_id);
        }
    });

})();
