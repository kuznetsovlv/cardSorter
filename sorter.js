(function () {
	"use strict";

	// Константы
	var SUBST = '[\\w\\s\\.,:;!?\\$*+=\\%\'\"\\[\\]\\{\\}\\(\\)]*';

	var FORMAT = '?vehicle:=train:Take %vehicle %voyage from %from to %to.&:=bus:Take the %voyage %vehicle from %from to %to.&:=flight:From %from, take %vehicle %voyage to %to.&:Take %vehicle %voyage from %from to %to.&:~&?gate: Gate %gate.&:~& ?seat:Seat %seat&:~No seat assignment&.?baggage:=auto: Baggage will be automatically transferred from your last leg.&:Baggage drop at ticket counter %baggage.&:~&';

	//Метод сортировки
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

	//Вспомогательная функция, использующаяся для в методах представления для парсинга
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


	// Конструктор карточек
	function Card (data, format) {

		if (!(data.from && data.to && data.vehicle && data.voyage))
			throw "Incorrect card";

		this.data = {}; // Данные карточки
		this.format = format || FORMAT; // Формат представления

		//Это регулярное выражение используется в разных местах методов представления, поэтому я задал его, как свойство
		this.subestRegExp = new RegExp(['\\?(\\w+):', '((?:=\\w+:', SUBST, '&:)*)(?:(', SUBST, ')&:)(?:(~', SUBST, ')&)?'].join(''), 'g');

		// На случай, если объект с входными данными будет использоваться где-то еще
		for (var key in data)
			this.data[key] = data[key];
	}

	Object.defineProperties(Card.prototype, {
		begin: { /*Начало списка*/
			get: function () {
				return this.first.data.from;
			},
			enumerable: false
		},
		currentStep: { /*Текстовое представление только текущей карточки*/
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
		currenStepToDom: { /*Представление текущей карточки в качестве DOM*/
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
		deepness: { /*Колличество карточек, начиная с этой*/
			get: function () {
				return (this.next ? this.next.deepness : 0) + 1;
			},
			enumerable: false
		},
		end: { /*Конец построенной части маршрута, используется для сортировки*/
			get: function () {
				return this.last.data.to;
			},
			enumerable: false
		},
		first: { /*Самая первая карточка*/
			get: function () {
				return this.prev ? this.prev.first : this;
			},
			enumerable: false
		},
		from: { /*Текущий пункт отбытия, используется для сортировки*/
			get: function () {
				return this.data.from;
			},
			enumerable: false
		},
		fullPath: { /*Текстовое представление всего маршрута, начиная стекущего учатска*/
			get: function () {
				var str = this.currentStep;

				if (this.next)
					str = [str, this.next.fullPath].join('\n');

				return str;
			},
			enumerable: false
		},
		fullPathToDOM :{/*Представление всего маршрута, начиная с текущего участка в вид DOM*/
			value: function (type) {
				var frag = document.createDocumentFragment();

				frag.appendChild(this.currenStepToDom(type));
				if (this.next)
					frag.appendChild(this.next.fullPathToDOM(type));
				return frag;
			},
			enumerable: false
		},
		get: { /*Получить карточку, занимающую положение deep относительно данной*/
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
		last: { /*Самая последняя карточка*/
			get: function () {
				return this.next ? this.next.last : this;
			},
			enumerable: false
		},
		setProperty: {/*Установка свойства*/
			value: function (name, value) {
				this.data[name] = value;
				return this;
			},
			enumerable: false
		},
		setFormat: { /*Изменение формата*/
			value: function (format) {
				this.format = format || FORMAT;
				
				this.subestRegExp = new RegExp(['\\?(\\w+):', '((?:=\\w+:', SUBST, '&:)*)(?:(', SUBST, ')&:)(?:(~', SUBST, ')&)?'].join(''), 'g');

				return this;
			},
			enumerable: false
		},
	});

	// В window передаются только конструктор и метод сортировки
	window.sortCards = sort;
	window.Card = Card;
})()