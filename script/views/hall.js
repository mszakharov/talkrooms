// Hall
var Hall = {};

// Toggle room
(function() {

    var body = $('body');
    var hall = $('#hall');
    var room = $('#room');

    var isVisible;

    var dummy = hall.find('.talk-dummy');

    function toggleRoom(visible) {
        if (isVisible === visible) return;
        if (isVisible === undefined) {
            body.toggleClass('in-room', visible);
            hall.css('display', '');
        } else if (visible) {
            if (Room.promises) {
                Room.promises.push(showRoom());
            } else {
                showRoom();
            }
        } else {
            Hall.updateRooms();
            hideRoom();
        }
        isVisible = visible;
    }

    function showRoom() {
        hall.css('overflow', 'hidden');
        return dummy
            .css('margin-left', dummy.width())
            .show()
            .animate({'margin-left': 0}, 200)
            .queue(function(next) {
                body.addClass('in-room');
                next();
            })
            .promise();
    }

    function hideRoom() {
        var withSide = room.hasClass('with-side');
        dummy.css('margin-left', withSide ? 256 : 0).show();
        hall.css('overflow', 'hidden');
        body.removeClass('in-room');
        if (withSide) {
            room.removeClass('with-side');
        }
        hall.find('.hall-failed:visible').hide()
            .prev('.hall-action').show();
        dummy
            .animate({'margin-left': dummy.width()}, 200)
            .queue(function(next) {
                dummy.hide();
                hall.css('overflow', '');
                next();
            });
    }

    Room.toggle = toggleRoom;

})();

// Create
(function() {

    var section = $('.hall-create');

    function toggle(data) {
        var auth = Boolean(data.user_id);
        section.find('.hall-login').toggle(!auth);
        section.find('.hall-action').toggle(auth);
    }

    function failed() {
        section.find('.hall-action').hide();
        section.find('.hall-failed').show();
    }

    section.find('.hall-action .link').on('click', function() {
        Room.create().fail(failed);
    });

    Me.ready.done(toggle);

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

// My rooms
(function() {

    var container = $('.hall-columns');
    var card = container.find('.hall-rooms .hall-card');
    var more = card.find('.hall-more');

    var renderLink = new Template('<li><a href="/#{hash}">{topic}</a></li>');

    function renderLinks(rooms) {
        return '<ul>' + rooms.map(renderLink).join('') + '</ul>';
    }

    function updateList(data) {
        card.find('ul').remove();
        var rooms = data.recent_rooms || [];
        if (data.rooms) {
            rooms = mergeLists(rooms, data.rooms);
        }
        if (rooms.length > 15) {
            more.find('.link').text(moreRooms(rooms.length - 10));
            card.append(renderLinks(rooms.slice(0, 10)));
            card.append(more.show());
            card.append($(renderLinks(rooms.slice(10))).hide());
        } else if (rooms.length) {
            card.append(renderLinks(rooms));
            more.detach();
        }
        toggleRooms(rooms.length === 0);
    }

    function moreRooms(amount) {
        return String.decline(amount, 'Ещё %d комната', 'Ещё %d комнаты', 'Ещё %d комнат');
    }

    function toggleRooms(empty) {
        container.toggleClass('no-rooms', empty);
    }

    function mergeLists(recent, my) {
        var inRecent = {};
        for (var i = 0; i < recent.length; i++) {
            inRecent[recent[i].hash] = true;
        }
        var merged = recent.concat();
        for (var i = 0; i < my.length; i++) {
            if (!inRecent[my[i].hash]) {
                merged.push(my[i]);
            }
        }
        return merged;
    }

    more.find('.link').on('click', function() {
        more.hide().next('ul').show();
    });

    Hall.updateRooms = function() {
        Rest.sessions.create('me').done(updateList);
    };

    Me.ready.done(updateList);

})();

Me.ready.done(function() {
    $('.hall-columns').show();
});
