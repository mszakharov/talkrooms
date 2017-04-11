// Toggle room
(function() {

    var html = $('html'),
        body = $('body'),
        hall = $('#hall'),
        room = $('#room');

    var isVisible;

    function toggleRoom(visible) {
        if (isVisible === visible) return;
        if (visible) {
            showRoom();
        } else {
            hideRoom();
        }
        isVisible = visible;
    }

    function showRoom() {
        html.addClass('in-room');
        body.addClass('in-room');
        hall.hide();
        room.show();
    }

    function hideRoom() {
        html.removeClass('in-room');
        body.removeClass('in-room');
        hall.find('.hall-failed:visible').hide()
            .prev('.hall-action').show();
        room.hide();
        hall.show();
    }

    var recent = $('.hall-recent'),
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

    Room.toggle = toggleRoom;

})();

// Create
(function() {

    var section = $('.hall-create');

    function failed() {
        section.find('.hall-action').hide();
        section.find('.hall-failed').show();
    }

    section.find('.hall-action .link').on('click', function() {
        Room.create().fail(failed);
    });

})();

// Shuffle
(function() {

    var section = $('.hall-shuffle');

    function failed() {
        section.find('.hall-action').hide();
        section.find('.hall-failed').show();
    }

    section.find('.hall-action .link').on('click', function() {
        Room.shuffle().fail(failed);
    });

})();


