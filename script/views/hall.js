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
        } else if (visible) {
            Room.promises.push(showRoom());
        } else {
            Hall.updateList();
            hideRoom();
        }
        isVisible = visible;
    }

    function showRoom() {
        hall.css('overflow', 'hidden');
        return dummy
            .css('right', -dummy.width())
            .show()
            .animate({right: 0}, 200)
            .queue(function(next) {
                body.addClass('in-room');
                next();
            })
            .promise();
    }

    function hideRoom() {
        body.removeClass('in-room');
        hall.css('overflow', 'hidden');
        dummy
            .css('right', 0)
            .show()
            .animate({right: -dummy.width()}, 200)
            .queue(function(next) {
                dummy.hide();
                hall.css('overflow', '');
                next();
            });
    }

    Room.toggle = toggleRoom;

})();

// My rooms
(function() {

    var list = $('#hall .rooms-list');

    function updateList(data) {
        console.log(data);
    }

    Hall.updateRooms = function() {
        Rest.sessions.create('me').done(updateList);
    };

    Me.ready.done(updateList);

})();
