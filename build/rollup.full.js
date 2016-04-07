import babel from "rollup-plugin-babel";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import json from "rollup-plugin-json";
import nodeGlobals from "rollup-plugin-node-globals";
import builtins from "node-libs-browser";
import {has} from "lodash";

const rollupEmptyModule = require.resolve("rollup-plugin-node-resolve/src/empty.js");

export default {
	onwarn: ()=>{},
	format: "umd",
	moduleName: "PouchDBSubscribe",
	plugins: [
		{
			resolveId: function(id) {
				if (id === "jquery") return rollupEmptyModule;

				if (has(builtins, id)) {
					return builtins[id] || rollupEmptyModule;
				}
			}
		},

		resolve({
			jsnext: false,
			main: true,
			browser: true,
			preferBuiltins: true
		}),

		json(),

		commonjs({
			include: [ "node_modules/**" ],
			exclude: [ "src/**", "node_modules/rollup-plugin-node-globals/**" ],
			extensions: [ ".js" ],
			namedExports: {
				events: [ "EventEmitter" ]
			}
		}),

		babel({
			exclude: [ "node_modules/**" ],
			include: [ "src/**" ],
			presets: [ "es2015-rollup" ],
			plugins: [
				"transform-object-rest-spread",
				"lodash"
			]
		}),

		nodeGlobals()
	]
};
