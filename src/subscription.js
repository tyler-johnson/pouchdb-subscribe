import {EventEmitter} from "events";
import {Collection} from "backbone-collection";

const CHANGE_EVENTS = ["change","complete","error"];

export default class Subscription extends EventEmitter {
	constructor(db, name) {
		super();

		// the database to subscribe to
		this.database = db;
		// changes feed filter name
		this.name = typeof name === "string" && name ? name : "*";
		// holds documents in the subscription
		this.docs = new Collection();
		// promise for current load
		this._loading = false;
		// whether of not ready
		this.ready = false;

		this.initialize();
	}

	initialize() {}

	get loading() {
		return Boolean(this._loading);
	}

	_onChange(res) {
		const doc = res.doc;
		let model;

		if (doc._deleted) {
			model = this.database.subscription_doc_cache.remove(doc);

			// remove all sub refs since this model is officially gone
			// this method will be called again for each sub, but won't get here
			if (model) {
				model.subscriptions.clear();
				model.set(doc);
			}
		} else {
			model = this.database.subscription_doc_cache.add(doc, { merge: true });
			model.subscriptions.add(this);
			this.docs.add(model);
		}
	}

	load() {
		if (this.ready) return Promise.resolve();
		if (this._loading) return this._loading;

		let cancel = false;
		const onStop = () => cancel = true;
		this.once("stop", onStop);
		const finish = () => {
			this._loading = false;
			this.removeListener("stop", onStop);
		};

		const onChange = this._onChange.bind(this);
		const chg_opts = {
			returnDocs: false,
			include_docs: true,
			since: 0
		};

		if (this.name && this.name !== "*") {
			chg_opts.filter = this.name;
		}

		// catch up changes first
		this._loading = Promise.resolve().then(() => {
			const chgs = this.database.changes(chg_opts);
			chgs.on("change", onChange);
			return chgs.then();
		})

		// listen for future changes to the database
		.then((res) => {
			// mark as loaded, cancelling if necessary
			finish();
			if (cancel) return this._clean();

			// create a pouchdb changefeed
			this.changes = this.database.changes({
				...chg_opts,
				live: true,
				since: res.last_seq
			});

			// listen for changes
			this.changes.on("change", onChange);

			// proxy change events
			CHANGE_EVENTS.forEach(evt => {
				this.changes.on(evt, this.emit.bind(this, evt));
			});

			// mark as ready
			this.ready = true;
			this.emit("ready");
		})

		// handle errors
		.catch((e) => {
			finish();
			this._clean();
			throw e;
		});

		return this._loading;
	}

	_clean() {
		// cancel any running changes
		if (this.changes) {
			this.changes.cancel();
			delete this.changes;
		}

		this.ready = false;

		// clean up documents associated with this subscription
		this.docs.each((doc) => {
			// remove subscription
			doc.subscriptions.delete(this);

			// remove from cache if no more subscriptions are attached
			if (!doc.subscriptions.size) {
				this.database.subscription_doc_cache.remove(doc);
			}
		});

		// empty the collection
		this.docs.reset();
	}

	stop() {
		this._clean();
		this.emit("stop");
		return this;
	}
}
