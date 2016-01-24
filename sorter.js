(function () {
	"use strict";

	var SUBST = '[\\w\\s\\.,:;!?\\$*+=\\%\'\"\\[\\]\\{\\}\\(\\)]*';

	var FORMAT = '?vehicle:=train:Take %vehicle %voyage from %from to %to.&:=bus:Take the %voyage %vehicle from %from to %to.&:=flight:From %from, take %vehicle %voyage to %to.&:Take %vehicle %voyage from %from to %to.&:~&?gate: Gate %gate.&:~& ?seat:Seat %seat&:~No seat assignment&.?baggage:=auto: Baggage will be automatically transferred from your last leg.&:Baggage drop at ticket counter %baggage.&:~&';

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

	function _causeList (causes) {
		var res = {};
		causes = causes.split('&:');
		for (var i = 0, l = causes.length; i < l; ++i) {
			var c = causes[i].substr(1),
			    index = c.indexOf(':');
			res[c.substring(0, index)] = c.substr(++index);
		}
		return res;
	}

	function Card (data, format) {

		if (!(data.from && data.to && data.vehicle && data.voyage))
			throw "Incorrect card";

		this.data = {};
		this.format = format || FORMAT;

		this.subestRegExp = new RegExp(['\\?(\\w+):', '((?:=\\w+:', SUBST, '&:)*)(?:(', SUBST, ')&:)(?:(~', SUBST, ')&)?'].join(''), 'g');

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
				var format = this.format || '',
				    data = this.data;

				return format.replace(/%(\w+)\b/g, function (found, key, pos, str) {
					return data[key] || '';
				}).replace(this.subestRegExp, function (substr, key, causes, def, none) {
					
					if (!data[key])
						return none.substr(1) || '';

					return _causeList(causes)[data[key]] || def || '';
				});
			},
			enumerable: false
		},
		currenStepToDom: {
			value: function (type) {

				var tag,
				    data = this.data,
				    format = this.format || '';

				function _spanKeys (text) {
					var frag = document.createDocumentFragment(),
					    result, j = 0,
					    keys = /%(\w+)/g;
					keys.lastIndex = 0;

					while (result = keys.exec(text)) {
						var i = result.index,
						    key = result[1];
						frag.appendChild(document.createTextNode(text.substring(j, i)));

						j = i + result[0].length;

						var span = document.createElement('span');
						span.appendChild(document.createTextNode(data[key]));

						span.className = key;

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

				switch (type) {
					case 'list': tag = 'li'; break;
					case 'paragraph':
					default: tag = 'p'; break;
				}

				var line = document.createElement(tag);
				    line.className = 'transport_card';

				var result, j = 0;
				this.subestRegExp.lastIndex = 0;
				while (result = this.subestRegExp.exec(format)) {
					var i = result.index,
					    key = result[1],
					    none = result[4].substr(1),
					    substitution;

					line.appendChild(_spanKeys(format.substring(j, i)));

					j = i + result[0].length;
					var str;
					if (!data[key]) {
						str = none || '';
					} else {
						str = _causeList(result[2])[data[key]] || result[3] || '';	
					}

					if (str)
						line.appendChild(_toSpan(str, key));
				}

				line.appendChild(_spanKeys(format.substring(j)));				

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
				var str = this.currentStep;

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
				this.format = format || FORMAT;
				
				this.subestRegExp = new RegExp(['\\?(\\w+):', '((?:=\\w+:', SUBST, '&:)*)(?:(', SUBST, ')&:)(?:(~', SUBST, ')&)?'].join(''), 'g');

				return this;
			},
			enumerable: false
		},
	});

	window.sortCards = sort;
	window.Card = Card;
})()