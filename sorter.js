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

		_preRepresent: {
			value: function (nostrict) {
				var format = this.format || '',
				    data = this.data,
				    used = {},
				    substitutions = {};

				var r_phrase = '[\\w\\s\\.,:;!?\\$*+=\'\"\\[\\]\\{\\}\\(\\)]*',
				    r_case = ['=\\w+:', r_phrase, '(?:%\\w+)?', r_phrase].join(''),
				    r_away = ['\\~', r_phrase].join('');

				function returnValue (key, value) {
					substitutions[key] = value;
					used[key] = true;
					return value;
				}

				var str = format.replace(new RegExp(['(?:(\\?\\w+):(?:(', r_case, ')*&:)*(', r_phrase, '))?(%\\w+)\\b(?:(', r_phrase, ')&(?:(', r_away, ')&)?)?'].join(''), 'g'), function (s) {

					if (/^\%\w+$/.test(s))
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

					defVal = defVal.join('');

					if (!data[key] && away)
						return returnValue(key, away);

					if (causes.length)
						for (var i = 0, l = causes.length; i < l; ++i) {
							var c = causes[i];
							if (data[key] == c.value)
								return returnValue(key, c.exchange.replace(new RegExp(['%', key].join(''), 'g'), data[key]));
						}

					return data[key] ? returnValue(key, defVal) : '';

				});

				if (nostrict) {
					for (var key in data) {
						if (used[key])
							continue;
						str = [str, [[[key.substr(0, 1).toUpperCase(), key.substr(1)].join(''), returnValue(key, data[key])].join(' '), '.'].join('')].join(' ');
					}
				}

				return {substitutions: substitutions, str: str};
			},
			enumerable: false
		},
		toString: {
			value: function (nostrict) {
				var str = this._preRepresent(nostrict).str;

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
				    tmp = this._preRepresent(nostrict),
				    str = tmp.str,
				    substitutions = tmp.substitutions,
				    start = 0,
				    indexes = [];

				for (var key in substitutions) {
					var subs = substitutions[key],
					    index = str.indexOf(subs);
					indexes.push({index: index, key: key}, {index: index + subs.length});
				}

				indexes.sort(function (a, b) {return a.index - b.index;});

				for (var i = 0, j = 0, l = indexes.length; i < l; ++i) {

					var o = indexes[i],
					    index = o.index;

					if (i % 2)
						p.appendChild(_spanNode(str.substring(j, index), o.key));
					else
						p.appendChild(_textNode(str.substring(j, index)));

					j = index;
				}

				p.appendChild(_textNode(str.substring(j)));

				frag.appendChild(p);

				if (this.next)
					frag.appendChild(this.next.toDOM(nostrict));
				return frag;

			},
			enumerable: false
		}
	});

	window.sortCards = sort;
	window.Card = Card;
})()