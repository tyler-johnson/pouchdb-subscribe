import Subscription from "./subscription";
import Cursor from "./cursor";
import {Collection as BCollection} from "backbone-collection";
import {Model as BModel} from "backbone-model";

const Model = BModel.extend({
	idAttribute: "_id",
	initialize: function() {
		this.subscriptions = new Set();
	}
});

const Collection = BCollection.extend({
	model: Model
});

export default function plugin(opts={}) {
	const { Subscription:_Subscription=Subscription, Cursor:_Cursor=Cursor } = opts;

	return {
		subscription_doc_cache: new Collection(),
		Subscription: _Subscription,
		Cursor: _Cursor,
		subscribe: function(name, cb) {
			if (typeof name === "function") [cb,name] = [name,null];

			// create subscription
			let sub = new _Subscription(this, name);

			// auto load the subscription
			sub.load(cb);

			return sub;
		},
		find: function(query, options) {
			return new _Cursor(this, query, options);
		},
		findOne: function(query, options) {
			let docs = this.find(query, options).fetch();
			return docs[0] || null;
		}
	};
}

export {Subscription,Cursor,Collection};
