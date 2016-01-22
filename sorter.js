(function () {
	"use strict";

	function sort () {
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
		begin: {
			get: function () {
				return this.first.data.from;
			},
			enumerable: false
		},
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
				return this.last.data.to;
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
			},
			enumerable: false
		},

		getAsString: {
			value: function (nostrict) {
				this._spans = [];
				var format = this.format || '',
				    data = this.data,
				    used = {},
				    spans = this._spans;

				var r_phrase = '[\\w\\s\\.,:;!?\\$*+=\'\"\\[\\]\\{\\}\\(\\)]*',
				    r_case = ['=\\w+:', r_phrase].join(''),
				    r_away = ['\\~', r_phrase].join('');

				var str = format.replace(new RegExp(['(?:(\\W)(\\?\\w+):(?:(', r_case, ')*&:)*(', r_phrase, '))?\\W(%\\w+)\\b(?:(', r_phrase, ')&(', r_away, ')&)?'].join(''), 'g'), function (s, f) {

					function returnValue (key, value) {
						used[key] = true;
						spans.push({
							key: key,
							value: value.trim().replace(/\s+([\.,!?:;\]\)\}])/g, '$1').replace(/(\s)\s+/g, '$1')
						});
						return value;
					}

					if (/^\W\%\w+$/.test(s))
						return s.replace(/\%(\w+)$/, function (s, key, pos, str) {
							return returnValue(key, data[key]);
						});
					var key, causes = [], away, defVal = [];

					for (var i = 2, l = arguments.length - 2; i < l; ++i) {
						var argument = arguments[i];

						if (!key && /^\?\w+$/.test(argument)) {

							key = argument.substr(1);

						} else if (new RegExp(['^', r_case, '$'].join('')).test(argument)) {

							argument = argument.split(':');

							var tmp = [];

							for (var a = 1, n = argument.length; a < n; ++a)
								tmp.push(argument[a]);

							causes.push({
								value: argument[0].substr(1),
								exchange: tmp.join(':')
							});
						} else if (new RegExp(['^', r_away, '$'].join('')).test(argument)) {

							away = argument.substr(1) || '';

						} else if (new RegExp(['^', r_phrase, '$'].join('')).test(argument)) {

							defVal.push(argument);

						} else if (/^%\w+$/.test(argument)) {
							if (!key)
								key = argument.substr(1);
							defVal.push(data[key]);
						}
					}

					used[key] = true;

					defVal = defVal.join(' ');

					if (!data[key] && away)
						return returnValue(key, [f, away].join(''));

					if (causes.length)
						for (var i = 0, l = causes.length; i < l; ++i) {
							var c = causes[i];
							if (data[key] == c.value)
								return returnValue(key, [f, c.exchange].join(''));
						}

					return returnValue(key, [f, defVal].join(''));
				}).replace(/\s+([\.,!?:;\]\)\}])/g, '$1').replace(/(\s)\s+/g, '$1');

				if (nostrict) {
					for (var key in data) {
						if (used[key])
							continue;
						str = [str, [[[key.substr(0, 1).toUpperCase(), key.substr(1)].join(''), data[key]].join(' '), '.'].join('')].join(' ');
					}
				}

				return str;
			},
			enumerable: false
		},
		toString: {
			value: function (nostrict) {
				var str = this.getAsString(nostrict);

				delete this._spans;

				if (this.next)
					str = [str, this.next.toString(nostrict)].join('\n');

				return str;
			},
			enumerable: false
		},
		toDOM: {
			value: function (nostrict) {
				function _textNode (text) {
					return document.createTextNode(text);
				}

				function _spanNode (text, className) {
					var span = document.createElement('span');

					if (className)
						span.className = className;

					span.appendChild(_textNode(text));

					return span;
				}

				var frag = document.createDocumentFragment(),
				    p = document.createElement('p');
				    p.className = 'transport_card';

				var format = (this.format || ''),
				    str = this.getAsString(nostrict),
				    start = 0;

				console.log(format);
				console.log(this._spans);
				console.log(str);

				for (var i = 0, l = this._spans.length; i < l; ++i) {
					var spn = this._spans[i],
					    index = str.indexOf(spn.value, start);

					p.appendChild(_textNode(str.substring(start, index)));

					start = index + spn.value.length;
					p.appendChild(_spanNode(str.substring(index, start), spn.key));
				}

				p.appendChild(_textNode(str.substring(start)));



				//p.appendChild(_textNode(str));

				frag.appendChild(p);

				if (this.next)
					frag.appendChild(this.next.toDOM());
				return frag;

			},
			enumerable: false
		}
	});

	window.sortCards = sort;
	window.Card = Card;
})()