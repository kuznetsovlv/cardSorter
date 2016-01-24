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
		this.format = format || '?vehicle:=train:Take %vehicle %voyage from %from to %to.&:=bus:Take the %voyage %vehicle from %from to %to.&:=flight:From %from, take %vehicle %voyage to %to.&:Take %vehicle %voyage from %from to %to.&:~&?gate: Gate %gate.&:~& ?seat:Seat %seat&:~No seat assignment&.?baggage:=auto: Baggage will be automatically transferred from your last leg.&:Baggage drop at ticket counter %baggage.&:~&';

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
		currentStep: {
			get: function () {
				return this._preRepresent().str;
			},
			enumerable: false
		},
		currenStepToDom: {
			value: function (type) {

				var tag, data = this.data, regular = [];

				for (var key in data)
					regular.push(['(?:\\b', data[key], '\\b)'].join(''));
				regular = new RegExp(regular.join('|'), 'g');

				switch (type) {
					case 'list': tag = 'li'; break;
					case 'paragraph':
					default: tag = 'p'; break;
				}

				var line = document.createElement(tag);
				    line.className = 'transport_card';

				var prepared = this._preRepresent(),
				    str = prepared.str,
				    substitutions = prepared.substitutions,
				    indexes = [];

				function _spanKeys (text) {
					var frag = document.createDocumentFragment(),
					    result, j = 0;
					regular.lastIndex = 0;

					while ((result = regular.exec(text))) {
						var i = result.index;
						frag.appendChild(document.createTextNode(text.substring(j, i)));
						j = i + result[0].length;

						var span = document.createElement('span'),
						    substr = text.substring(i, j);
						span.appendChild(document.createTextNode(substr));

						for (var key in data)
							if (data[key] === substr) {
								span.className = key;
								break;
							}

						frag.appendChild(span);
					}

					frag.appendChild(document.createTextNode(text.substr(j)));

					return frag;
				}

				function _toSpan (text, className) {
					var span = document.createElement('span');

					if (className)
						span.className = className;

					span.appendChild(_spanKeys(text));

					return span;
				}

				for (var key in substitutions) {
					var subs = substitutions[key];
					if (!subs)
						continue;
					var i = str.indexOf(subs);
					indexes.push({index: i, key: key}, {index: i + subs.length, key: key});
				}

				indexes.sort(function (a, b) {return a.index - b.index});

				for (var i = 0, j = 0, l = indexes.length; i < l; ++i) {

					var o = indexes[i],
					    index = o.index,
					    substr = str.substring(j, index);
					if (i % 2) {
						if (substr)
							line.appendChild(_toSpan(substr, o.key));
					} else {
						line.appendChild(_spanKeys(substr));
					}
					j = index;
				}

				line.appendChild(_spanKeys(str.substring(j)));

				return line;

			},
			enumerable: false
		},
		deepness: {
			get: function () {
				if (!this.next)
					return 1;
				return this.next.deepness + 1;
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
		fullPath: {
			get: function () {
				var str = this._preRepresent().str;

				if (this.next)
					str = [str, this.next.fullPath].join('\n');

				return str;
			},
			enumerable: false
		},
		fullPathToDOM :{
			value: function (type) {
				var frag = document.createDocumentFragment();

				frag.appendChild(this.currenStepToDom(type));
				if (this.next)
					frag.appendChild(this.next.fullPathToDOM(type));
				return frag;
			},
			enumerable: false
		},
		get: {
			value: function (deep) {
				if (!deep)
					return this;
				if (deep > 0) {
					if (!this.next)
						return undefined;
					return this.next.get(--deep);
				}
				if (!this.prev)
					return undefined;
				return this.prev.get(++deep);
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
			value: function () {
				var format = this.format || '',
				    data = this.data,
				    substitutions = {},
				    txt = '[\\w\\s\\.,:;!?\\$*+=\'\"\\[\\]\\{\\}\\(\\)]*';
				var str = format.replace(/%(\w+)\b/g, function (found, key, pos, str) {
					return data[key] || '';
				}).replace(new RegExp(['\\?(\\w+):', '((?:=\\w+:', txt, '&:)*)(?:(', txt,, ')&:)(?:(~', txt, ')&)?'].join(''), 'g'), function (substr, key, causes, def, none) {
					
					if (!data[key]) {
						substitutions[key] = none.substr(1);
					} else {
						var causeList = {};

						causes = causes.split('&:');

						for (var i = 0, l = causes.length; i < l; ++i) {
							var c = causes[i].substr(1),
							    index = c.indexOf(':');
							causeList[c.substring(0, index)] = c.substr(++index);
						}
						substitutions[key] = causeList[data[key]] || def;
					}
					return substitutions[key] || '';
				});

				return {substitutions: substitutions, str: str};
			},
			enumerable: false
		}
	});

	window.sortCards = sort;
	window.Card = Card;
})()