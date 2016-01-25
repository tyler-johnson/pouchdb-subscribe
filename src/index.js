import Subscription from "./subscription";
import Cursor from "./cursor";
import Backbone from "backbone";
import Trackr from "trackr";

var Model = Backbone.Model.extend({
	idAttribute: "_id",
	initialize: function() {
		this.subscriptions = new Set();
	}
});

var Collection = Backbone.Collection.extend({
	model: Model
});

export default function plugin() {
	return {
		subscription_doc_cache: new Collection(),
		subscribe: function(name, cb) {
			if (typeof name === "function") [cb,name] = [name,null];

			// create subscription
			let sub = new Subscription(this, name);

			// clear on invalidate if running reactively
			if (Trackr.active) Trackr.onInvalidate(sub.stop.bind(sub));

			// auto load the subscription
			sub.load(cb);

			return sub;
		},
		find: function(query, options) {
			return new Cursor(this, query, options);
		},
		findOne: function(query, options) {
			let docs = this.find(query, options).fetch();
			return docs[0] || null;
		}
	};
}

plugin.Subscription = Subscription;
plugin.Cursor = Cursor;
plugin.Collection = Collection;
