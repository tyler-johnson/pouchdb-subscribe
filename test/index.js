import test from "tape";
import PouchDB from "pouchdb";

PouchDB.plugin(require("./")());

test("loads the subscribe plugin", function(t) {
	t.plan(3);
	let db = new PouchDB("tmpdb", { adapter: "memory" });
	t.equals(typeof db.subscribe, "function", "has subscribe method");
	t.equals(typeof db.find, "function", "has find method");
	t.equals(typeof db.findOne, "function", "has findOne method");
});
