(function () {
	"use strict";

	function sort () {console.log(arguments);
		var items = [];

		function _bound (o1, o2) {
			o1.last.next = o2;
			o2.prev = o1;
		}

		function _addCard (card) {
			for (var i = 0, l = items.length; i < l; ++i) {
				var item = items[i];

				if (card.from === item.end) {
					_bound(item, card);
					return i
				}
			}

			items.push(card);

			return i;
		}

		function _addAndResort (card) {
			var n = _addCard(card);

			for (var i = 0, l = items.length; i < l; ++i) {

				if (i === n)
					continue;

				var item = items[i];

				if (item.from === card.end) {
					_bound(card, item);
					items.splice(i, 1);
					return;
				}
			}
		}

		for (var i = 0, l = arguments.length; i < l; ++i)
			_addAndResort(arguments[i]);

		if (items.length > 1)
			throw "List corrupted";

		return items[0];
	}

	function Card (data, format) {

		if (!(data.from && data.to && data.vehicle && data.voyage))
			throw "Incorrect card";

		this.data = {};
		this.format = format;

		for (var key in data)
			this.data[key] = data[key];
	}

	Object.defineProperties(Card.prototype, {
		deep: {
			get: function () {
				if (!this.next)
					return 1;
				return this.next.deep + 1;
			},
			enumerable: false
		},
		end: {
			get: function () {
				if (!this.next)
					return this.data.to;
				return this.next.end;
			},
			enumerable: false
		},
		first: {
			get: function () {
				if (!this.prev)
					return this;
				return this.prev.first;
			},
			enumerable: false
		},
		from: {
			get: function () {
				return this.data.from;
			},
			enumerable: false
		},
		get: {
			value: function (deep) {
				if (!deep)
					return this;
				if (!this.next)
					return undefined;
				return this.next.get(--deep);
			},
			enumerable: false
		},
		last: {
			get: function () {
				if (!this.next)
					return this;
				return this.next.last;
			},
			enumerable: false
		},
		setProperty: {
			value: function (name, value) {
				this.data[name] = value;
				return this;
			},
			enumerable: false
		},
		setFormat: {
			value: function (format) {
				this.format = format;
				return this;
			}
		}
	});

	window.sortCards = sort;
	window.Card = Card;
})()