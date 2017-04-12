// Ranks
(function() {

    var $section = $('.moder-ranks'),
        $inputs = $section.find('input');

    var $guest = $('#rank-guest'),
        $admin = $('#rank-admin').closest('.rank');

    var $guestButtons = $('.moder-guest'),
        $rankButton = $('.moder-rank');

    function isSubordinate(user) {
        var myLevel = Room.myRole.level;
        return Boolean(myLevel && (!user.level || myLevel > user.level));
    }

    function findInput(level) {
        return level > 20 ? $inputs.filter('[value="' + level + '"]') : $guest;
    }

    function getGuestLevel(role) {
        return Math.max(role.user_id ? 10 : 0, Room.data.level);
    }

    $inputs.on('click', function() {
        var level = this.value ? Number(this.value) : getGuestLevel(Profile.role);
        if (level !== Profile.role.level) {
            Profile.send({level: level});
        } else {
            Profile.trigger('moderated', this.value ? 'rank' : 'guest');
            Profile.fit();
        }
    });

    $rankButton.on('click', function() {
        if (Room.admin) {
            Profile.trigger('moderated', 'ranks');
            Profile.fit();
        }
    });

    Profile.on('moderated', function(state) {
        if (state === 'ranks') {
            findInput(Profile.role.level).prop('checked', true);
            $section.show();
        } else {
            $section.hide();
        }
    });

    function toggleAdminRank() {
        $admin.toggle(Room.myRole.level === 80);
    }

    function toggleButtons(isAdmin) {
        $rankButton.toggleClass('moder-rank-editable', isAdmin);
        $guestButtons.toggleClass('moder-guest-editable', isAdmin);
    }

    Room.on('enter', toggleAdminRank);

    Room.on('admin.changed', toggleButtons);

    toggleButtons(Room.admin);
    toggleAdminRank();

})();

