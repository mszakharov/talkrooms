// Datepicker
$.Datepicker = function(selector, onChange) {

    var popup = $.popup(selector,
        function(target) {
            var middle = target.offset().left + target.outerWidth() / 2;
            var right = $window.width() - Math.round(middle) - 150;
            this.css('right', Math.max(right, 10)); // use right to handle iPad orientation change
            this.addClass('visible');
        },
        function() {
            this.removeClass('visible');
        }
    );

    var picker = {
        onChange: onChange || $.noop
    };

    var calendar = $.Datepicker.Calendar(popup);

    var monthRegex = /(?:^|[^а-я])(ян|фе|мар|ап|май|мая|июн|июл|ав|сен|ок|но|де)/i,
        monthAbbrs = {'ян':0, 'фе':1, 'мар':2, 'ап':3, 'май':4, 'мая':4, 'июн':5, 'июл':6, 'ав':7, 'сен':8, 'ок':9, 'но':10, 'де':11};

    var agoRegex = /^(?:сег|вч|по)/i,
        agoIndex = {'сег': 0, 'вч': 1, 'по': 2};

    function parseQuery(str) {
        var parsed = {};
        var ago = str.match(agoRegex);
        if (ago) {
            parsed.ago = agoIndex[ago[0].toLowerCase()];
        } else {
            parsed.date = matchDay(str);
            parsed.month = matchMonth(str);
            parsed.year = matchYear(str);
        }
        return parsed;
    }

    function isEqual(p1, p2) {
        for (var key in p1) {
            if (p1[key] !== p2[key]) return false;
        }
        return true;
    }

    function matchDay(str) {
        var match = str.match(/\b\d{1,2}\b/);
        if (match) {
            return Number(match[0]);
        }
    }

    function matchMonth(str) {
        var match = str.match(monthRegex);
        if (match) {
            return monthAbbrs[match[1].toLowerCase()];
        }
    }

    function matchYear(str) {
        var match = str.match(/\b\d{4}\b/);
        if (match) {
            return Number(match[0]);
        }
    }

    var field = popup.find('.dp-field');

    field.on('input', function() {
        var parsed = parseQuery(this.value);
        if (parsed) {
            calendar.match(parsed);
        }
        if (calendar.selected) {
            field.removeClass('dp-missing');
        } else {
            field.addClass('dp-missing');
        }
    });

    field.on('keyup', function(event) {
        if (event.which === 13) applySelected();
    });

    field.on('change', showSelected);

    function showSelected() {
        var day = calendar.selected;
        if (day) {
            var date = day.getDate();
            var text = date.toSmartDate();
            field.val(text.charAt(0).toUpperCase() + text.substr(1));
        }
    }

    function applySelected() {
        var day = calendar.selected;
        if (day && day !== calendar.current) {
            picker.onChange(day.getDate());
        }
        popup.hide();
    }

    calendar.content.on('click', '.dp-day', function() {
        calendar.select(this.dayIndex);
        showSelected();
        applySelected();
    });

    popup.find('.dp-close').on('click', function() {
        popup.hide();
    });

    picker.setRange = function(begin, end) {
        var d1 = calendar.days[0];
        var d2 = calendar.days[calendar.days.length - 1];
        if (!(d1 && d1.includes(begin) && d2.includes(end))) {
            calendar.reset(begin, end);
        }
    };

    picker.show = function(date, target, byTouch) {
        popup.show(target);
        calendar.update();
        calendar.setCurrent({
            date: date.getDate(),
            month: date.getMonth(),
            year: date.getFullYear()
        });
        field.attr('placeholder', date.toSmartDate());
        if (byTouch) {
            showSelected();
        } else {
            field.val('').focus();
        }
    };

    picker.hide = function() {
        popup.hide();
    };

    return picker;

};

// Datepicker calendar
$.Datepicker.Calendar = function(context) {

    var months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    var days = [];

    var container = context.find('.dp-calendar');

    var calendar = {
        days: days,
        content: context.find('.dpc-content')
    };

    function getDayFromMon(date) {
        return (date.getDay() || 7) - 1;
    }

    function findLastIndex(callback) {
        for (var i = days.length; i--;) {
            if (callback(days[i])) return i;
        }
    }

    function scrollToDay(day) {
        var top = day.node.offsetTop;
        var pos = container.scrollTop();
        if (top < pos - 10) {
            container.scrollTop(top - 10);
        } else if (top > pos + calendar.height - 47) {
            container.scrollTop(top - calendar.height + 47);
        }
    }

    calendar.update = function() {
        this.height = container.height();
    };

    calendar.select = function(index) {
        var day = index !== undefined ? days[index] : null;
        if (day === this.selected) {
            scrollToDay(day);
            return;
        }
        if (this.selected) {
            this.selected.node.classList.remove('dp-selected');
        }
        if (day) {
            day.node.classList.add('dp-selected');
            scrollToDay(day);
        }
        this.selected = day;
    },

    calendar.match = function(options) {
        var index,
            d = options.date,
            m = options.month,
            y = options.year;
        if (options.ago) {
            if (options.ago > days.length) {
                index = days.length - 1 - options.ago;
            }
        } else if (d || m !== undefined || y) {
            index = findLastIndex(function(day) {
                if (d && d !== day.date) return false;
                if (m !== undefined && m !== day.month) return false;
                if (y && y !== day.year) return false;
                return true;
            });
            // Wait for second digit of date
            if (index === undefined && d && d < 4 && m === undefined) {
                console.log(this);
                index = this.current.node.dayIndex;
            }
        } else {
            index = this.current.node.dayIndex;
        }
        this.select(index);
    };

    calendar.setCurrent = function(options) {
        this.current = days[days.length - 1];
        this.match(options);
        if (this.selected) {
            this.current = this.selected;
        }
    };

    calendar.reset = function(begin, end) {
        var fragment = document.createDocumentFragment();
        var year = end.getFullYear();
        var date = new Date(begin);
        date.setHours(0, 0, 0, 0);
        days.length = 0;
        var month;
        while (date.getTime() < end.getTime()) {
            var day = new Day(date);
            if (day.month !== month) {
                fragment.appendChild(renderMonth(date, year));
                for (var i = getDayFromMon(date); i--;) {
                    fragment.appendChild(emptyDay.cloneNode());
                }
                month = day.month;
            }
            day.node.dayIndex = days.push(day) - 1;
            fragment.appendChild(day.node);
            date.setHours(24);
        }
        this.content.empty().append(fragment);
    };

    function Day(date) {
        this.date = date.getDate();
        this.month = date.getMonth();
        this.year = date.getFullYear();
        this.node = renderDay(this.date, date.getDay() % 6 === 0);
    }

    Day.prototype.getDate = function(h, m) {
        return new Date(this.year, this.month, this.date, h || 0, m || 0);
    };

    Day.prototype.includes = function(date) {
        return this.getDate().toDateString() === date.toDateString();
    };

    var emptyDay = $('<div class="dp-day dp-hidden"></div>')[0];

    function renderDay(date, weekend) {
        var node = document.createElement('div');
        var classes = 'dp-day';
        if (weekend) {
            classes += ' dp-weekend';
        }
        node.className = classes;
        node.textContent = date;
        return node;
    }

    function renderMonth(date, curYear) {
        var m = date.getMonth();
        var y = date.getFullYear();
        var title = months[m] + (y === curYear ? '' : ' ' + y);
        return $.parseHTML('<div class="dp-month"><span class="dp-month-name">' + title + '<span></div>')[0];
    }

    return calendar;

};
