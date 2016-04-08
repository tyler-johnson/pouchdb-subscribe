import {iteratee} from "lodash";
import Trackr from "trackr";
// import normalizeQuery from "./utils/query.js";
import Mingo from "mingo";
import {Collection} from "backbone-collection";
import {EventEmitter} from "events";

export default class Cursor extends EventEmitter {
	constructor(db, query, options) {
		super();

		options = options || {};
		let self = this;
		let kpa = options.keepalive;
		let kpabool = typeof kpa === "boolean";
		let runSort = iteratee(options.sort, this);
		let subset = new Collection(null, {
			comparator: function(m) {
				return runSort(self._parseModel(m));
			}
		});

		this.s = {
			// the database associated with this cursor
			database: db,
			// whether or not to keep the connection alive after querying
			keepalive: kpabool ? kpa : Trackr.active,
			// function for converting documents before they come out
			transform: options.transform,
			// the cursor's query
			query: new Mingo.Query(query),
			// dependency to trigger when document list changes
			dep: new Trackr.Dependency(),
			// collection to hold documents in this cursor
			subset: subset,
			// boolean for if this cursor has been closed
			closed: false,
			// user options
			options: options
		};

		// notify of any change to the dataset
		let onChange = () => this.s.dep.changed();
		subset.on("update", onChange);
		subset.on("change", onChange);

		// proxy change events to the cursor
		subset.on("add", (m) => this.emit("add", m.toJSON()));
		subset.on("remove", (m) => this.emit("remove", m.toJSON()));
		subset.on("change", (m) => this.emit("change", m.toJSON(), m.previousAttributes()));

		// cursor will listen for changes
		if (this.s.keepalive) {
			// auto-close in a computation if not user specified
			if (!kpabool && Trackr.active) Trackr.onInvalidate(this.close.bind(this));

			// attach to document cache
			this._attach();
		}

		// update with the current documents
		this.refresh();
	}

	get database() { return this.s.database; }
	get subset() { return this.s.subset; }

	match(data) {
		return this.s.query.test(data);
	}

	// listen to document cache for changes and keep local collection up to date
	_attach() {
		let events = [];

		events.push([ "add", (model, col, opts) => {
			// only adds if it matches
			// could be in the collection anyway because this one made it
			if (this.match(model)) this.subset.add(model, opts);
		} ]);

		events.push([ "remove", (model, col, opts) => {
			this.subset.remove(model, opts);
		} ]);

		events.push([ "change", (model, opts) => {
			if (this.match(model)) this.subset.add(model, opts);
			else this.subset.remove(model, opts);
		} ]);

		events.forEach(e => this.database.subscription_doc_cache.on(e[0], e[1]));

		this.once("close", () => {
			events.forEach(e => this.database.subscription_doc_cache.off(e[0], e[1]));
		});
	}

	refresh() {
		this.subset.set(this.database.subscription_doc_cache.filter(this.match.bind(this)));
	}

	_parseModel(m) {
		var tr = this.s.transform;
		var doc =  m.toJSON();
		return typeof tr === "function" ? tr.call(this, doc) : doc;
	}

	close() {
		if (this.s.closed) return this;
		this.s.closed = true;
		this.subset.reset();
		this.emit("close");
		return this;
	}

	// handle data in the cursor now
	fetch() {
		this.s.dep.depend();
		return this.subset.map(this._parseModel, this);
	}

	count() {
		this.s.dep.depend();
		return this.subset.length;
	}

	forEach(fn, ctx) {
		this.fetch().forEach(fn, ctx || this);
		return this;
	}

	map(fn, ctx) {
		return this.fetch().map(fn, ctx || this);
	}
}
