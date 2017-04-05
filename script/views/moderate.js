// Requests list
(function() {

    var requests = new Collection({
        index: 'role_id',
        order: 'nickname'
    });

    function getRequests() {
        if (Room.moderator && Room.data.level !== 80) {
            return Rest.roles.get({room_id: Room.data.room_id, come_in: true}).done(reset);
        } else {
            requests.raw = [];
            apply();
        }
    }

    function reset(data) {
        requests.raw = data;
        requests.raw.forEach(setUserpicUrl);
        requests.sort();
        apply();
    }

    function setUserpicUrl(request) {
        request.userpicUrl = Userpics.getUrl(request);
    }

    function apply() {
        Room.trigger('requests.updated', requests.raw);
    }

    function addRequest(request) {
        if (!requests.get(request.request_id)) {
            setUserpicUrl(request);
            requests.add(request);
            apply();
        }
    }

    function toggleRequest(role) {
        if (role.come_in) {
            addRequest(role);
        } else {
            requests.remove(role.role_id);
            apply();
        }
    }

    function toggleList(on) {
        var mode = on ? 'on' : 'off';
        Room[mode]('enter', getRequests);
        Room[mode]('role.come_in.updated', toggleRequest);
        if (on) {
            Room.requests = requests;
            getRequests();
        } else {
            Room.requests = null;
            Room.trigger('requests.updated', []);
        }
    }

    Room.on('moderator.changed', toggleList);

    toggleList(Room.moderator);

})();

// Update current role
Profile.send = function(data) {
	var role = this.role;
	if (role) {
		return Rest.roles.update(role.role_id, data);
	}
};

// Whip sound
(function() {

    var whippedByMe;

    var whipSound = new Sound({
        mp3: '/script/sound/whip.mp3',
        ogg: '/script/sound/whip.ogg'
    });

    function playWhip(role) {
        if (role.ignored) {
	        console.log(whippedByMe);
            if (role.role_id === whippedByMe) {
                whippedByMe = null;
            } else {
                whipSound.play(0.25);
            }
        }
    }

    function toggleEvent(toggle) {
		Socket[toggle ? 'on' : 'off']('role.ignored.updated', playWhip);
    }

    Profile.whip = function() {
	    whippedByMe = Profile.role.role_id;
		whipSound.play(0.5);
    };

    Room.on('moderator.changed', function(isModerator) {
		toggleEvent(isModerator);
    });

	toggleEvent(Room.moderator);

})();

// Moderate section
(function() {

	var $section = $('#profile-moderate');

	var MODERATOR = 50;

	function updateRole(data) {
		if (Profile.role && Profile.role.role_id === data.role_id) {
			var role = $.extend(Profile.role, data);
			Profile.trigger('moderated', getState(role));
            Profile.fit();
		}
	}

	function getState(role) {
		if (role.level >= MODERATOR) {
			return 'rank';
		}
        if (role.level < Room.data.level) {
	        return role.come_in === 0 ? 'banished' : 'request';
		}
		if (role.ignored) {
			return 'ignored';
		}
		return 'guest';
	}

	function onRoomUpdated() {
		if (isActive) {
			Profile.trigger('moderated', getState(Profile.role));
			Profile.fit();
		}
	}

	function toggleEvents(toggle) {

		Socket[toggle]('role.level.updated', updateRole);
		Socket[toggle]('role.ignored.updated', updateRole);
		Socket[toggle]('role.expired.updated', updateRole);
		Socket[toggle]('role.come_in.updated', updateRole);

	    Room[toggle]('room.level.updated', onRoomUpdated);

	}

	var isActive = false;

	Profile.on('show', function(role, isMy) {
		isActive = Boolean(Room.moderator && !isMy);
		$section.toggle(isActive);
		if (isActive) {
			Profile.trigger('moderated', null);
		}
	});

	Profile.on('ready', function(role) {
		if (isActive) {
			Profile.trigger('moderated', getState(role));
		}
	});

	function toggleSection(isModerator) {
		toggleEvents(isModerator ? 'on' : 'off');
        if (Profile.role) {
            if (isModerator) {
				isActive = isModerator && !Room.isMy(Profile.role);
				$section.toggle(isActive);
				if (isActive) {
					Profile.trigger('moderated', getState(Profile.role));
				}
            } else {
                isActive = false;
                $section.hide();
            }
            Profile.fit();
        }
	}

    Room.on('moderator.changed', toggleSection);

	// Wait for sections initialization below
	setTimeout(function() {
	    toggleSection(Room.moderator);
	}, 100);

})();


// Check level
Profile.isCivilian = function() {
    var socket = this.socket;
    if (socket) {
        return !(socket.level && socket.level >= 50);
    }
};

// Profile with request
(function() {

    var $request = $('.moder-request');

    $request.find('.moder-reject').on('click', function() {
        Profile.send({come_in: false});
    });

    $request.find('.moder-invite').on('click', function() {
        Profile.send({level: Room.data.level, come_in: null});
    });

    Profile.on('moderated', function(state) {
		$request.toggle(state === 'request');
    });

})();

// Current rank
(function() {

	var $rank = $('.moder-rank');

    var ranks = {
        50: 'Модератор',
        70: 'Администратор',
        80: 'Создатель комнаты'
    };

    Profile.on('moderated', function(state) {
	    if (state === 'rank') {
			$rank.text(ranks[Profile.role.level]);
			$rank.show();
	    } else {
			$rank.hide();
	    }
    });

})();

// Guest profile
(function() {

    var $guest = $('.moder-guest');

    var $ignore = $guest.find('.moder-ignore');
		$banish = $guest.find('.moder-banish');

    $ignore.on('click', function() {
        Profile.send({ignored: true});
        Profile.whip();
    });

    $banish.on('click', function() {
        Profile.send({
	        level: Profile.role.user_id ? 10 : 0,
	        come_in: false
		});
    });

    $guest.find('.moder-promote').on('click', function() {
        Profile.trigger('moderated', 'ranks');
		Profile.fit();
    });

    Profile.on('moderated', function(state) {
	    if (state === 'guest') {
		    var useIgnore = Room.data.level < 20;
			$ignore.toggle(useIgnore);
			$banish.toggle(!useIgnore);
			$guest.show();
	    } else {
			$guest.hide();
	    }
    });

})();

// Ignored profile
(function() {

	var $ignored = $('.moder-ignored');

    var $sanction = $ignored.find('.moder-sanction'),
        termValue = $sanction.find('.moder-term-value'),
        termOptions = $sanction.find('li');

    var terms = {
        15: 'на 15 минут',
        120: 'на 2 часа',
        720: 'на 12 часов'
    };

    var termsIndex = {
        15: 0,
        120: 1,
        720: 2
    };

    function getMinutes(since, date) {
        return Math.round((date - since) / 60000);
    }

    function canRelease(role) {
        return Boolean(Room.admin || !role.moderator_id || role.moderator_id === Room.myRole.role_id);
    }

    function showIgnored(role) {
        var date = new Date(role.ignored);
        var term = role.expired && getMinutes(date, new Date(role.expired));
        var past = getMinutes(date, Date.now());
        var cr = canRelease(role);
        var tr = past > 720;
        var expired = term ? past >= term : false;
        if (cr && !tr && !expired) {
            termValue.addClass('moder-term-editable');
            toggleTermOption(0, past > 15);
            toggleTermOption(1, past > 120);
            selectTerm(term);
        } else {
            termValue.removeClass('moder-term-editable');
        }
        $sanction.removeClass('moder-term-select');
        termValue.text(term ? terms[term] : (tr ? date.toHumanAgo() : 'пожизненно'));
        termValue.attr('title', String.mix('Начало игнора $1 в $2', date.toSmartDate().toLowerCase(), date.toHumanTime()));
        $ignored.toggleClass('moder-ignored-expired', expired);
        $ignored.find('.moder-release').toggle(cr || tr);
    }

    function toggleTermOption(index, past) {
        termOptions.eq(index).toggleClass('moder-term-past', past);
    }

    function selectTerm(term) {
        termOptions.removeClass('moder-term-selected');
        termOptions.eq(term ? termsIndex[term] : 3).addClass('moder-term-selected');
    }

    $ignored.find('.moder-release').on('click', function() {
        Profile.send({ignored: false});
    });

    $sanction.on('click', 'li:not(.moder-term-past)', function() {
        var term = this.getAttribute('data-term');
        if ($(this).hasClass('moder-term-selected')) {
            $sanction.removeClass('moder-term-select');
        } else {
            selectTerm(term && Number(term));
            Profile.send({expired: term ? Number(term) * 60 : null});
        }
    });

    $sanction.on('click', '.moder-term-editable', function() {
        $sanction.addClass('moder-term-select');
    });

    Profile.on('moderated', function(state, role) {
	    if (state === 'ignored') {
		    showIgnored(Profile.role)
			$ignored.show();
	    } else {
			$ignored.hide();
	    }
    });

})();

// Banished profile
(function() {

    var $banished = $('.moder-banished');

    $banished.find('.moder-release').on('click', function() {
        Profile.send({
	        level: Room.data.level,
	        come_in: null
		});
    });

    Profile.on('moderated', function(state) {
		$banished.toggle(state === 'banished');
    });

})();

// Ignore messages
(function() {

    var $erase = $('.moder-erase');

    var showFor = {
		ignored: true,
		banished: true
    };

    var targetMessage;

    function getMessage(target) {
        var speech = $(target).closest('.speech');
        if (speech.length) {
            return speech.find('.message').first();
        }
    }

    function onErased() {
	    targetMessage = null;
	    $erase.hide();
    }

    $erase.on('click', function() {
        var message_id = targetMessage.attr('data-id');
        Rest.messages.create(message_id + '/ignore_below').done(onErased);
    });

    Profile.on('show', function(role, isMy) {
		targetMessage = Profile.context.inTalk ? getMessage(Profile.context.target) : null;
	});

    Profile.on('moderated', function(state) {
	    if (showFor[state] && targetMessage) {
            var time = targetMessage.find('.msg-time').text();
            $erase.find('.erase-from').text(time);
            $erase.show();
	    } else {
		    $erase.hide();
	    }
    });

})();
