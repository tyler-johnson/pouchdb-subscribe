import {iteratee} from "lodash";
// import Trackr from "trackr";
import Mingo from "mingo";
import {Collection} from "backbone-collection";
import {EventEmitter} from "events";

export default class Cursor extends EventEmitter {
	constructor(db, query, options={}) {
		super();

		// the database associated with this cursor
		this.database = db;
		// function for converting documents before they come out
		this._transform = options.transform;
		// the cursor's query
		this._query = new Mingo.Query(query);
		// boolean for if this cursor is currently watching for changes
		this.closed = true;
		// user options
		this.options = options;

		// collection to hold documents in this cursor
		let runSort = iteratee(options.sort, this);
		let subset = this.subset = new Collection(null, {
			comparator: (m) => runSort(this._parseModel(m))
		});

		// proxy change events to the cursor
		subset.on("add", (m) => this.emit("add", m.toJSON()));
		subset.on("remove", (m) => this.emit("remove", m.toJSON()));
		subset.on("change", (m) => this.emit("change", m.toJSON(), m.previousAttributes()));

		// initialize
		this.initialize(options);

		// update with the current documents
		this.refresh();

		// continue to update for changes if desired
		if (options.keepalive) this.attach();
	}

	initialize() {}

	_match(model) {
		return this._query.test(model.toJSON());
	}

	// listen to document cache for changes and keep local collection up to date
	attach() {
		if (!this.closed) return this;
		this.closed = false;

		const events = [];

		events.push([ "add", (model, col, opts) => {
			// only adds if it matches
			// could be in the collection anyway because this one made it
			if (this._match(model)) this.subset.add(model, opts);
		} ]);

		events.push([ "remove", (model, col, opts) => {
			this.subset.remove(model, opts);
		} ]);

		events.push([ "change", (model, opts) => {
			if (this._match(model)) this.subset.add(model, opts);
			else this.subset.remove(model, opts);
		} ]);

		const doc_cache = this.database.subscription_doc_cache;
		events.forEach(([evt,fn]) => doc_cache.on(evt, fn));
		this.once("close", () => events.forEach(([evt,fn]) => doc_cache.off(evt, fn)));

		this.emit("attach");

		return this;
	}

	close() {
		if (this.closed) return this;
		this.closed = true;
		this.subset.reset();
		this.emit("close");
		return this;
	}

	refresh() {
		const match = this._match.bind(this);
		const docs = this.database.subscription_doc_cache.filter(match);
		this.subset.set(docs);
		this.emit("refresh");
		return this;
	}

	_parseModel(m) {
		const tr = this._transform;
		const doc = m.toJSON();
		return typeof tr === "function" ? tr.call(this, doc) : doc;
	}

	fetch() {
		return this.subset.map(this._parseModel, this);
	}

	count() {
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
