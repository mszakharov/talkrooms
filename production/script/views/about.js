// Toggle rooms
(function() {

    var html = $('html'),
        body = $('body'),
        $about = $('#about'),
        $rooms = $('#rooms');

    var isVisible;

    function toggleRooms(visible) {
        if (isVisible === visible) return;
        if (visible) {
            showRooms();
        } else {
            hideRooms();
        }
        isVisible = visible;
    }

    function showRooms() {
        html.addClass('in-rooms');
        body.addClass('in-rooms');
        $about.hide();
        $rooms.show();
    }

    function hideRooms() {
        html.removeClass('in-rooms');
        body.removeClass('in-rooms');
        $about.find('.about-failed:visible').hide()
            .prev('.about-action').show();
        $rooms.hide();
        $about.show();
    }

    var recent = $('.about-recent'),
        renderLink = new Template('<li data-hash="{hash}"><a href="/#{hash}">{topic}</a></li>');

    function showRecent() {
        var rooms = Me.recent_rooms;
        if (rooms && rooms.length) {
            recent.empty().append( renderRecent(rooms.slice(0, 3)) ).show();
        }
    }

    function renderRecent(rooms) {
        var list = $('<ul></ul>');
        for (var i = 0; i < rooms.length; i++) {
            list.append(renderLink(rooms[i]));
        }
        return list;
    }

    Me.ready.done(showRecent);

    Rooms.on('explore', function() {
        toggleRooms(true);
    });

    Rooms.on('select', function() {
        toggleRooms(true);
    });

    Rooms.on('leave', function() {
        toggleRooms(false);
    });

})();

// Create
(function() {

    var section = $('.about-create');

    function failed() {
        section.find('.about-action').hide();
        section.find('.about-failed').show();
    }

    section.find('.about-action .link').on('click', function() {
        Rooms.create().fail(failed);
    });

})();

// Shuffle
(function() {

    var section = $('.about-shuffle');

    function failed() {
        section.find('.about-action').hide();
        section.find('.about-failed').show();
    }

    section.find('.about-action .link').on('click', function() {
        Rooms.shuffle().fail(failed);
    });

})();


