import {assign,once} from "lodash";
import {EventEmitter} from "events";
import {Collection} from "backbone-collection";
import Trackr from "trackr";

export default class Subscription extends EventEmitter {
	constructor(db, name) {
		super();

		// internal subscription state
		this.s = {
			// the database to subscribe to
			database: db,
			// changes feed filter name
			name: typeof name === "string" && name ? name : "*",
			// holds documents in the subscription
			docs: new Collection(),
			// promise for current load
			loading: false,
			// whether of not ready
			ready: false,
			// trackr dep for ready state
			ready_dep: new Trackr.Dependency()
		};
	}

	get database() { return this.s.database; }
	get name() { return this.s.name; }

	_onChange(res) {
		var doc = res.doc;
		var model;

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
			this.s.docs.add(model);
		}
	}

	load() {
		if (this.s.ready) return Promise.resolve();
		if (this.s.loading) return this.s.loading;

		let onStop;
		let cancel = false;
		let onChange = this._onChange.bind(this);
		let chg_opts = {
			returnDocs: false,
			include_docs: true,
			since: 0
		};

		if (this.name && this.name !== "*") {
			chg_opts.filter = this.name;
		}

		this.once("stop", onStop = () => cancel = true);

		this.s.loading = Promise.resolve().then(() => {
			// mark as loading inside promise context
			this.s.loading = true;

			// catch up changes first
			var chgs = this.database.changes(chg_opts);
			chgs.on("change", onChange);
			return chgs.then();
		}).then((res) => {
			// mark as loaded
			this.s.loading = false;
			this.removeListener("stop", onStop);
			if (cancel) return this._clean();

			// mark as ready
			this.s.ready = true;
			this.s.ready_dep.changed();
			this.emit("ready");

			// listen for future changes and clean up when closed up
			let chgs = this._changes = this.database.changes(assign({}, chg_opts, {
				live: true,
				since: res.last_seq
			}));

			let clean = once((function() {
				chgs.removeListener("complete", clean);
				chgs.removeListener("error", clean);
				chgs.cancel();
				if (this._changes === chgs) delete this._changes;
				this.stop();
			}).bind(this));

			chgs.on("change", onChange);
			chgs.on("complete", clean);
			chgs.on("error", clean);
		}).catch((e) => {
			this.s.loading = false;
			this._clean();
			throw e;
		});

		return this.s.loading;
	}

	_clean() {
		// cancel any running changes
		if (this._changes) this._changes.cancel();
		this.s.ready = false;

		// clean up documents associated with this subscription
		this.s.docs.each((doc) => {
			// remove subscription
			doc.subscriptions.delete(this);

			// remove from cache if no more subscriptions are attached
			if (!doc.subscriptions.size) {
				this.database.subscription_doc_cache.remove(doc);
			}
		});

		// empty the collection
		this.s.docs.reset();
	}

	stop() {
		this._clean();
		this.emit("stop");
		return this;
	}

	ready() {
		this.s.ready_dep.depend();
		return Boolean(this.s.ready);
	}
}
